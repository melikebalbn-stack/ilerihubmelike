import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { TaskStatus, TaskEmailType } from '@/generated/prisma'
import { sendEmail } from '@/lib/email'
import { requireUser } from '@/lib/auth/require-user'
import {
  bolumBilgisiGerekirMi,
  bolumSorumluSatiri,
  gorevBolumleri,
  gorevHatirlatmaAlicilariAdli,
  kurumsalAlicilar,
  sorumluSatiri,
  type GorevAlicisi,
} from '@/lib/tasks/hatirlatma-alicilari'
import { gorevBolumunuEslestir } from '@/lib/tasks/gorev-tamamlama-yetki'

/**
 * Sorumlusu çözülemeyen görevlerin özet raporu BU adrese gider — görev başına
 * ayrı mail YOK (Melih kararı, 08.10.2026).
 */
const COZULEMEYEN_RAPOR_ADRESI = 'melih.dilben@ilerigroup.com'

/**
 * POST /api/tasks/check-notifications
 * Checks all tasks and sends notifications based on reminder days
 * Auth: Session (ADMIN+) VEYA x-cron-secret (sistem cron için)
 */
export async function POST(request: NextRequest) {
  try {
    const cronSecret = request.headers.get('x-cron-secret')
    const isCron = !!cronSecret && cronSecret === process.env.CRON_SECRET

    if (!isCron) {
      // PR-Y2.5-tasks: requireUser → admin check
      const { user, error } = await requireUser()
      if (error) return error
      const userRole = user.role || 'EMPLOYEE'
      if (!['ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
        return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
      }
    }
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    let notificationsSent = 0
    let errors = 0

    // ALICI = YALNIZ görevin sorumluları (lib/tasks/hatirlatma-alicilari).
    //
    // KALDIRILDI (08.10.2026): alıcı listesi `CalibrationNotificationEmail`
    // tablosundan geliyordu — KALİBRASYON bildirim listesi planlı görev
    // hatırlatmasına bağlanmış. Prod'da 6 aktif satır / 3 tekil adres vardı
    // (her adres mükerrer), sonuç: görevle ilgisiz üç kişiye, her birine iki
    // kez yazılmış mail; sorumluya ise AYRI bir mail. Artık tek mail, tek
    // kaynak, CC yok, admin/sistem rolü alıcı değil.
    const cozulemeyenler: { title: string; dueDate: Date; sebep: string }[] = []

    // Bölüm adı → DepartmentDefinition eşleştirmesi için tek sorgu (28 satır).
    // NEDEN SEZGİSEL: PlannedTask.responsibleDepartment LDAP türevi
    // Department.name tutuyor, Personnel ise DepartmentDefinition FK'sına bağlı
    // ve adlar birebir tutmuyor (08.10 ölçümü: 6 bölüm adından yalnız "Yönetim"
    // birebir eşleşiyor; "İnsan Varlıkları" → "İnsan Varlıkları Müdürlüğü"
    // ancak ön ekle bulunuyor). Kural gorevBolumunuEslestir'de, fail-closed.
    const tanimliBolumler = await prisma.departmentDefinition.findMany({
      where: { isActive: true },
      select: { id: true, name: true, mudurId: true, mudurYardimcisiId: true },
    })

    /**
     * Bölüme atanmış görevin alıcıları: eşleşen bölümlerin TÜM aktif
     * personelinin KURUMSAL adresleri. Hiç bölüm eşleşmezse null döner ve
     * görev özet rapora düşer.
     */
    async function bolumAlicilari(
      gorev: { responsibleDepartment: string | null; responsibleDepartments: string[] },
    ): Promise<{ alicilar: GorevAlicisi[]; eslesen: string[]; eslesmeyen: string[] } | null> {
      const adlar = gorevBolumleri(gorev)
      const eslesen: { id: string; name: string }[] = []
      const eslesmeyen: string[] = []
      for (const ad of adlar) {
        const dd = gorevBolumunuEslestir(ad, tanimliBolumler)
        if (dd) eslesen.push({ id: dd.id, name: dd.name })
        else eslesmeyen.push(ad)
      }
      if (eslesen.length === 0) return null
      const kisiler = await prisma.user.findMany({
        where: { isActive: true, personnel: { aktif: true, departmentId: { in: eslesen.map((e) => e.id) } } },
        select: { email: true, name: true, personnel: { select: { adSoyad: true } } },
      })
      const alicilar = kurumsalAlicilar(
        kisiler.map((k) => ({ email: k.email, ad: k.personnel?.adSoyad ?? k.name })),
      )
      return { alicilar, eslesen: eslesen.map((e) => e.name), eslesmeyen }
    }

    // Get active tasks that are not completed or cancelled
    const tasks = await prisma.plannedTask.findMany({
      where: {
        isActive: true,
        status: {
          notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED],
        },
      },
      include: {
        category: true,
      },
    })

    // Process each task
    for (const task of tasks) {
      const dueDate = new Date(task.dueDate)
      dueDate.setHours(0, 0, 0, 0)

      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      // Check if we need to send a reminder
      const reminderDays = task.reminderDays.length > 0 ? task.reminderDays : [30, 7, 1]

      // Check for exact match with reminder days
      if (reminderDays.includes(daysUntilDue)) {
        // Check if we already sent this notification today
        const existingLog = await prisma.taskEmailLog.findFirst({
          where: {
            taskId: task.id,
            emailType: 'REMINDER',
            sentAt: {
              gte: now,
            },
          },
        })

        if (existingLog) {
          console.log(`⏭️ Already sent reminder for task ${task.title} today`)
          continue
        }

        // TEK mail, TEK alıcı kümesi: görevin sorumluları. Eskiden iki ayrı
        // gönderim vardı (admin listesi + "kişisel"); ikisi birleştirildi.
        let alicilar: GorevAlicisi[] = gorevHatirlatmaAlicilariAdli(task)
        // Kişi sorumlusu yok ama bölüme atanmışsa: komple bölüme BİLGİ maili.
        let bolumMaili = false
        if (alicilar.length === 0 && bolumBilgisiGerekirMi(task)) {
          const bolum = await bolumAlicilari(task)
          if (bolum && bolum.alicilar.length > 0) {
            alicilar = bolum.alicilar
            bolumMaili = true
          } else {
            cozulemeyenler.push({
              title: task.title,
              dueDate: task.dueDate,
              sebep: bolum
                ? `bölüm eşleşti (${bolum.eslesen.join(', ')}) ama kurumsal adresli aktif personel yok`
                : `bölüm adı organizasyonda bulunamadı: ${gorevBolumleri(task).join(', ')}`,
            })
            continue
          }
        }
        if (alicilar.length === 0) {
          // Mail GÖNDERİLMEZ; görev başına ayrı mail yerine tek özet rapora girer.
          cozulemeyenler.push({
            title: task.title,
            dueDate: task.dueDate,
            sebep: 'sorumlu e-postası yok ya da çözülemedi',
          })
          continue
        }

        const subject = generateReminderSubject(task, daysUntilDue)
        const body = bolumMaili
          ? generateBolumBilgiBody(task, daysUntilDue)
          : generateReminderBody(task, daysUntilDue)

        try {
          const result = await sendEmail(alicilar, subject, body)

          if (result.success) {
            notificationsSent++
            console.log(`✅ Sent ${bolumMaili ? 'DEPARTMENT' : 'reminder'} for task: ${task.title} (${daysUntilDue} days) → ${alicilar.length} alıcı`)

            await prisma.taskEmailLog.create({
              data: {
                taskId: task.id,
                emailType: 'REMINDER',
                subject,
                body: `Reminder sent: ${daysUntilDue} days until due`,
                status: 'SENT',
                recipientEmails: alicilar.map((r) => r.email).join(', '),
              },
            })
          } else {
            errors++
            console.error(`❌ Failed to send reminder: ${result.error}`)
          }
        } catch (error) {
          errors++
          console.error('❌ Error sending reminder:', error)
        }
      }

      // Check for overdue tasks (negative days)
      if (daysUntilDue < 0 && task.status !== TaskStatus.OVERDUE) {
        // Update task status to OVERDUE
        await prisma.plannedTask.update({
          where: { id: task.id },
          data: { status: TaskStatus.OVERDUE },
        })

        // Check if we already sent overdue notification
        const existingOverdueLog = await prisma.taskEmailLog.findFirst({
          where: {
            taskId: task.id,
            emailType: 'OVERDUE',
          },
        })

        if (!existingOverdueLog) {
          const overdueSubject = `🚨 GECİKMİŞ GÖREV: ${task.title}`
          const overdueBody = generateOverdueBody(task, Math.abs(daysUntilDue))

          let gecikmisAlicilar: GorevAlicisi[] = gorevHatirlatmaAlicilariAdli(task)
          if (gecikmisAlicilar.length === 0 && bolumBilgisiGerekirMi(task)) {
            const bolum = await bolumAlicilari(task)
            if (bolum) gecikmisAlicilar = bolum.alicilar
          }
          if (gecikmisAlicilar.length === 0) {
            cozulemeyenler.push({
              title: task.title,
              dueDate: task.dueDate,
              sebep: 'GECİKMİŞ — sorumlu e-postası yok ya da çözülemedi',
            })
          } else {
            try {
              const result = await sendEmail(gecikmisAlicilar, overdueSubject, overdueBody)

              if (result.success) {
                notificationsSent++
                console.log(`✅ Sent overdue notification for task: ${task.title} → ${gecikmisAlicilar.map((a) => a.email).join(', ')}`)

                await prisma.taskEmailLog.create({
                  data: {
                    taskId: task.id,
                    emailType: 'OVERDUE',
                    subject: overdueSubject,
                    body: `Overdue notification sent: ${Math.abs(daysUntilDue)} days overdue`,
                    status: 'SENT',
                    recipientEmails: gecikmisAlicilar.map((r) => r.email).join(', '),
                  },
                })
              }
            } catch (error) {
              errors++
              console.error('❌ Error sending overdue notification:', error)
            }
          }
        }
      }
    }

    // ── SORUMLUSU ÇÖZÜLEMEYEN GÖREVLER: TEK özet mail ──
    // Görev başına mail atılmaz; aksi hâlde sorunlu her görev için ayrı bildirim
    // yağardı. Liste boşsa mail hiç gönderilmez.
    if (cozulemeyenler.length > 0) {
      const satirlar = cozulemeyenler
        .map((c) => `• ${c.title} — bitiş ${c.dueDate.toLocaleDateString('tr-TR')} — ${c.sebep}`)
        .join('\n')
      const ozetGovde = [
        'Aşağıdaki planlı görevler için hatırlatma maili GÖNDERİLEMEDİ: sorumlu kişinin',
        'e-posta adresi çözülemedi. Görevlerin sorumlu alanını düzeltmek gerekiyor.',
        '',
        satirlar,
        '',
        '--',
        'ILERIHub Planlı Görevler — otomatik özet (hatırlatma cron\'u, günde bir kez)',
      ].join('\n')
      try {
        await sendEmail(
          [{ email: COZULEMEYEN_RAPOR_ADRESI, name: 'ILERIHub' }],
          `Planlı görev: ${cozulemeyenler.length} görevin sorumlusu çözülemedi`,
          ozetGovde,
        )
        console.log(`📋 Sorumlusu çözülemeyen ${cozulemeyenler.length} görev için özet rapor gönderildi`)
      } catch (error) {
        console.error('❌ Özet rapor gönderilemedi:', error)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Task notification check completed`,
      stats: {
        tasksChecked: tasks.length,
        notificationsSent,
        errors,
        sorumlusuCozulemeyen: cozulemeyenler.length,
      },
    })
  } catch (error) {
    console.error('Error checking task notifications:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check notifications',
      },
      { status: 500 }
    )
  }
}

/**
 * Generate reminder email subject
 */
function generateReminderSubject(
  task: { title: string; category: { name: string } | null },
  daysUntilDue: number
): string {
  const categoryPrefix = task.category ? `[${task.category.name}] ` : ''
  if (daysUntilDue === 0) {
    return `⚠️ ${categoryPrefix}BUGÜN: ${task.title}`
  } else if (daysUntilDue === 1) {
    return `⚠️ ${categoryPrefix}YARIN: ${task.title}`
  } else {
    return `📅 ${categoryPrefix}Görev Hatırlatması: ${task.title} (${daysUntilDue} gün kaldı)`
  }
}

/**
 * Generate reminder email body
 */
function generateReminderBody(
  task: {
    title: string
    description: string | null
    category: { name: string } | null
    dueDate: Date
    responsiblePerson: string | null
    responsiblePersonEmail: string | null
    responsiblePersons: string | null
    priority: string
    notes: string | null
  },
  daysUntilDue: number
): string {
  // "Sorumlu:" satırı TO listesiyle AYNI kaynaktan (sorumluSatiri) gelir —
  // eskiden yalnız responsiblePerson metni yazılıyordu ve TO'daki kalibrasyon
  // listesiyle hiç tutmuyordu.
  const sorumlular = sorumluSatiri(task)
  const now = new Date()
  const dateStr = now.toLocaleDateString('tr-TR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const priorityLabels: Record<string, string> = {
    LOW: 'Düşük',
    NORMAL: 'Normal',
    HIGH: 'Yüksek',
    CRITICAL: 'Kritik',
  }

  const daysText =
    daysUntilDue === 0 ? 'Bugün son gün!' :
    daysUntilDue === 1 ? 'Yarın son gün!' :
    `${daysUntilDue} gün kaldı`

  return `
📅 Planlı Görev Hatırlatması
Tarih: ${dateStr}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 Görev Bilgileri:

• Görev: ${task.title}
${task.category ? `• Kategori: ${task.category.name}` : ''}
${task.description ? `• Açıklama: ${task.description}` : ''}
• Bitiş Tarihi: ${task.dueDate.toLocaleDateString('tr-TR')}
• ⏱️ ${daysText}
• Öncelik: ${priorityLabels[task.priority] || task.priority}
${sorumlular ? `• Sorumlu: ${sorumlular}` : ''}
${task.notes ? `• Notlar: ${task.notes}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${daysUntilDue <= 7 ? '⚠️ UYARI: Bitiş tarihi yaklaşıyor! Lütfen gerekli aksiyonları alınız.' : 'Lütfen görevin zamanında tamamlanmasını sağlayınız.'}

--
Bu e-posta otomatik olarak ILERIHub Planlı Görevler Sistemi tarafından gönderilmiştir.
© 2025 İleri Group - System Development Team
  `.trim()
}

/**
 * Bölüme atanmış görev — BİLGİ gövdesi.
 *
 * Kişiye atanmış görevin gövdesinden ayrı tutuldu: burada "sorumluluğunuzdaki
 * görev" ya da "siz tamamlayın" dili YOK. Mail bölümün tüm personeline gidiyor;
 * herkese "senin görevin" demek yanlış olurdu. "Sorumlu:" satırı kişi adı değil
 * BÖLÜM adını taşır (bolumSorumluSatiri) — TO ile tutarlı.
 */
function generateBolumBilgiBody(
  task: {
    title: string
    description: string | null
    category: { name: string } | null
    dueDate: Date
    responsibleDepartment: string | null
    responsibleDepartments: string[]
    priority: string
    notes: string | null
  },
  daysUntilDue: number,
): string {
  const daysText =
    daysUntilDue === 0 ? 'Son gün bugün' : daysUntilDue === 1 ? 'Son gün yarın' : `${daysUntilDue} gün kaldı`

  return `
📅 Bölüm Görevi — Bilgilendirme

Aşağıdaki planlı görev bölümünüze atanmıştır; kişi bazlı bir sorumlu
tanımlanmamıştır. Bu mesaj bilgilendirme amaçlıdır.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 Görev Bilgileri:

• Görev: ${task.title}
${task.category ? `• Kategori: ${task.category.name}` : ''}
${task.description ? `• Açıklama: ${task.description}` : ''}
• Bitiş Tarihi: ${task.dueDate.toLocaleDateString('tr-TR')}
• ⏱️ ${daysText}
• Sorumlu: ${bolumSorumluSatiri(task)}
${task.notes ? `• Notlar: ${task.notes}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Görevin takibi bölüm içinde yapılacaktır. Kişi bazlı sorumlu atanmasını
isterseniz görevi ILERIHub üzerinden güncelleyebilirsiniz.

--
Bu e-posta otomatik olarak ILERIHub Planlı Görevler Sistemi tarafından gönderilmiştir.
© 2025 İleri Group - System Development Team
  `.trim()
}

/**
 * Generate overdue email body
 */
function generateOverdueBody(
  task: {
    title: string
    description: string | null
    category: { name: string } | null
    dueDate: Date
    responsiblePerson: string | null
    responsiblePersonEmail: string | null
    responsiblePersons: string | null
    priority: string
  },
  daysOverdue: number
): string {
  const sorumlular = sorumluSatiri(task)
  const now = new Date()
  const dateStr = now.toLocaleDateString('tr-TR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return `
🚨 GECİKMİŞ GÖREV BİLDİRİMİ
Tarih: ${dateStr}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ UYARI: Aşağıdaki görevin bitiş tarihi geçmiştir!

📌 Görev Bilgileri:

• Görev: ${task.title}
${task.category ? `• Kategori: ${task.category.name}` : ''}
${task.description ? `• Açıklama: ${task.description}` : ''}
• Bitiş Tarihi: ${task.dueDate.toLocaleDateString('tr-TR')}
• ⏱️ ${daysOverdue} gün geçti!
${sorumlular ? `• Sorumlu: ${sorumlular}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❗ ACİL AKSİYON GEREKLİ

Bu görev gecikmiş durumda. Lütfen en kısa sürede tamamlayınız veya ilgili kişilerle iletişime geçiniz.

--
Bu e-posta otomatik olarak ILERIHub Planlı Görevler Sistemi tarafından gönderilmiştir.
© 2025 İleri Group - System Development Team
  `.trim()
}

/**
 * GET /api/tasks/check-notifications
 * Manual trigger for testing — POST'un aynısı.
 * Sistem cron GET ile çağırır, x-cron-secret header forward edilir.
 */
export async function GET(request: NextRequest) {
  return POST(request)
}
