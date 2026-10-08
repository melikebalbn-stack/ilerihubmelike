import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { TaskStatus, TaskEmailType } from '@/generated/prisma'
import { sendEmail } from '@/lib/email'
import { requireUser } from '@/lib/auth/require-user'
import {
  gorevHatirlatmaAlicilariAdli,
  sorumluSatiri,
  type GorevAlicisi,
} from '@/lib/tasks/hatirlatma-alicilari'

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
        const alicilar: GorevAlicisi[] = gorevHatirlatmaAlicilariAdli(task)
        if (alicilar.length === 0) {
          // Mail GÖNDERİLMEZ; görev başına ayrı mail yerine tek özet rapora girer.
          cozulemeyenler.push({
            title: task.title,
            dueDate: task.dueDate,
            sebep: task.responsibleDepartment
              ? `yalnız bölüme atanmış (${task.responsibleDepartment}), kişi sorumlusu yok`
              : 'sorumlu e-postası yok ya da çözülemedi',
          })
          continue
        }

        const subject = generateReminderSubject(task, daysUntilDue)
        const body = generateReminderBody(task, daysUntilDue)

        try {
          const result = await sendEmail(alicilar, subject, body)

          if (result.success) {
            notificationsSent++
            console.log(`✅ Sent reminder for task: ${task.title} (${daysUntilDue} days) → ${alicilar.map((a) => a.email).join(', ')}`)

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

          const gecikmisAlicilar: GorevAlicisi[] = gorevHatirlatmaAlicilariAdli(task)
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
