import { NextRequest, NextResponse, after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sorumlulariKurumsallastir } from '@/lib/tasks/kurumsal-adres'
import { TaskStatus, TaskPriority } from '@/generated/prisma'
import { getAllSubordinates } from '@/lib/ldap'
import { requireSession } from '@/lib/auth/require-session'
import { requireUser } from '@/lib/auth/require-user'
import { atamaBildirimiGonder, sorumlulariCoz, yeniEklenenler } from '@/lib/tasks/atama-bildirimi'
import {
  GOREV_DURUM_YETKI_HATASI,
  gorevDurumDegistirebilir,
} from '@/lib/tasks/gorev-tamamlama-yetki'

// GET - Tek bir görevi getir
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-tasks: requireSession — sade auth, DB hit yok
    const { error } = await requireSession()
    if (error) return error

    const { id } = await params

    const task = await prisma.plannedTask.findUnique({
      where: { id },
      include: {
        category: true,
        emailLogs: {
          orderBy: { sentAt: 'desc' },
          take: 10,
        },
      },
    })

    if (!task) {
      return NextResponse.json(
        { error: 'Görev bulunamadı' },
        { status: 404 }
      )
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error('Görev alınırken hata:', error)
    return NextResponse.json(
      { error: 'Görev alınırken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// PUT - Görevi güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-tasks: requireUser + session (distinguishedName LDAP-only)
    const { session, user, error } = await requireUser()
    if (error) return error

    const { id } = await params
    const body = await request.json()

    const {
      title,
      description,
      categoryId,
      dueDate,
      startDate,
      completedDate,
      isRecurring,
      recurrenceType,
      recurrenceInterval,
      reminderDays,
      responsiblePerson,
      responsiblePersonEmail,
      responsibleDepartment,
      responsiblePersons, // Yeni: Çoklu kişiler [{name, email}]
      responsibleDepartments, // Yeni: Çoklu departmanlar [string]
      notificationEmails,
      status,
      priority,
      notes,
      attachments,
      // Eskalasyon alanları
      escalationEnabled,
      escalationCategory,
      escalationPriority,
    } = body

    // Görevin var olup olmadığını kontrol et
    const existingTask = await prisma.plannedTask.findUnique({
      where: { id },
    })

    if (!existingTask) {
      return NextResponse.json(
        { error: 'Görev bulunamadı' },
        { status: 404 }
      )
    }

    // ── DURUM DEĞİŞTİRME YETKİSİ (07.10.2026 — liste kapsamıyla hizalandı) ────
    // Karar gorevDurumDegistirebilir()'de (saf, testli). Burada yalnız girdiler
    // toplanır. Kontrol SADECE durum değişiminde yapılır; LDAP sorgusu da yalnız
    // diğer tüm yollar kapalı kalırsa atılır (eskiden her PUT'ta atılıyordu).
    if (status && status !== existingTask.status) {
      const kullaniciKaydi = await prisma.user.findUnique({
        where: { id: user.id },
        select: { employeeId: true, personnelId: true },
      })
      const bolumler = existingTask.responsibleDepartment
        ? await prisma.departmentDefinition.findMany({
            where: { isActive: true },
            select: { id: true, name: true, mudurId: true, mudurYardimcisiId: true },
          })
        : []

      const girdi = {
        kullanici: {
          email: user.email,
          sicilNo: kullaniciKaydi?.employeeId ?? null,
          personnelId: kullaniciKaydi?.personnelId ?? null,
          rol: user.role,
        },
        gorev: {
          responsiblePersonEmail: existingTask.responsiblePersonEmail,
          responsiblePersons: existingTask.responsiblePersons,
          responsibleDepartment: existingTask.responsibleDepartment,
        },
        bolumler,
        astEpostalari: [] as string[],
      }

      let karar = gorevDurumDegistirebilir(girdi)
      const userDN = session.user.distinguishedName
      if (!karar.izinli && userDN) {
        try {
          karar = gorevDurumDegistirebilir({ ...girdi, astEpostalari: await getAllSubordinates(userDN) })
        } catch (err) {
          // LDAP erişilemezse amir yolu kapanır, diğer yollar zaten denendi.
          console.error('Ast kontrolü yapılırken hata:', err)
        }
      }

      if (!karar.izinli) {
        return NextResponse.json({ error: GOREV_DURUM_YETKI_HATASI }, { status: 403 })
      }
    }

    // Eğer durum COMPLETED olarak değişiyorsa, completedDate'i otomatik ayarla
    let finalCompletedDate = completedDate ? new Date(completedDate) : null
    if (status === TaskStatus.COMPLETED && !finalCompletedDate) {
      finalCompletedDate = new Date()
    }

    // ADRES KURUMSAL KAYNAKTAN — POST ile AYNI kural (kurumsal-adres.ts).
    // Güncelleme yolu da korunmalı; aksi hâlde kayıt düzenlenince kişisel adres
    // geri yazılabilirdi.
    const kurumsalSorumlular =
      responsiblePersons && responsiblePersons.length > 0
        ? await sorumlulariKurumsallastir(responsiblePersons)
        : []

    // Çoklu kişiler varsa JSON string olarak kaydet
    const responsiblePersonsJson = kurumsalSorumlular.length > 0
      ? JSON.stringify(kurumsalSorumlular)
      : undefined

    // Geriye uyumluluk: Eğer çoklu kişi varsa, ilk kişiyi eski alanlara da yaz
    let finalResponsiblePerson = responsiblePerson
    let finalResponsiblePersonEmail = responsiblePersonEmail
    if (kurumsalSorumlular.length > 0) {
      finalResponsiblePerson = kurumsalSorumlular[0].name
      finalResponsiblePersonEmail = kurumsalSorumlular[0].email ?? null
    }

    // Çoklu departmanlar
    let finalResponsibleDepartments = responsibleDepartments
    let finalResponsibleDepartment = responsibleDepartment
    if (responsibleDepartments && responsibleDepartments.length > 0) {
      finalResponsibleDepartment = responsibleDepartments[0]
    }

    // ATAMA BİLDİRİMİ için ÖNCEKİ sorumlular — update'ten SONRA okunamaz.
    const oncekiKayit = await prisma.plannedTask.findUnique({
      where: { id },
      select: { responsiblePersons: true },
    })
    const oncekiSorumlular = sorumlulariCoz(oncekiKayit?.responsiblePersons)

    const task = await prisma.plannedTask.update({
      where: { id },
      data: {
        title,
        description,
        categoryId: categoryId || null,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        startDate: startDate ? new Date(startDate) : null,
        completedDate: finalCompletedDate,
        isRecurring,
        recurrenceType: recurrenceType || null,
        recurrenceInterval: recurrenceInterval || null,
        reminderDays: reminderDays || undefined,
        responsiblePerson: finalResponsiblePerson,
        responsiblePersonEmail: finalResponsiblePersonEmail,
        responsibleDepartment: finalResponsibleDepartment,
        responsiblePersons: responsiblePersonsJson,
        responsibleDepartments: finalResponsibleDepartments,
        notificationEmails: notificationEmails || undefined,
        status: status as TaskStatus | undefined,
        priority: priority as TaskPriority | undefined,
        notes,
        attachments,
        // Eskalasyon alanları
        escalationEnabled: escalationEnabled !== undefined ? escalationEnabled : undefined,
        escalationCategory: escalationCategory !== undefined ? escalationCategory : undefined,
        escalationPriority: escalationPriority !== undefined ? escalationPriority : undefined,
      },
      include: {
        category: true,
      },
    })

    // ── ATAMA BİLDİRİMİ — YALNIZ YENİ EKLENENLER, YANITTAN SONRA ────────
    // Mevcut sorumlular her güncellemede tekrar bildirim ALMAZ; fark
    // yeniEklenenler() ile hesaplanır (sicil öncelikli eşleştirme).
    //
    // `after()` (Next 15.1.6'da stable): yanıt gönderildikten SONRA koşar.
    // Await edilseydi kaydet düğmesi bildirim süresince kilitli kalır ve
    // kullanıcı tekrar basmaya çalışırdı — POST'takiyle aynı çift-gönderim
    // riski. Hata görev güncellemesini ETKİLEMEZ, yalnız loglanır.
    const yeniler = yeniEklenenler(oncekiSorumlular, sorumlulariCoz(task.responsiblePersons))
    if (yeniler.length > 0) {
      after(async () => {
        try {
          await atamaBildirimiGonder(
            { id: task.id, title: task.title, dueDate: task.dueDate },
            yeniler,
          )
        } catch (err) {
          console.error('[gorev-update] bildirim adımı başarısız:', err)
        }
      })
    }

    // NOT: Tekrarlayan görevler için yeni periyotlar artık timeline modal'ından manuel olarak oluşturuluyor
    // Eski otomatik oluşturma mantığı kaldırıldı

    // Eğer bu görev bir 5S bulgusuna bağlıysa ve tamamlandıysa, bulguyu da güncelle
    if (status === TaskStatus.COMPLETED) {
      const linkedFinding = await prisma.fiveSFinding.findFirst({
        where: { plannedTaskId: id }
      })

      if (linkedFinding) {
        await prisma.fiveSFinding.update({
          where: { id: linkedFinding.id },
          data: {
            status: 'COMPLETED',
            completedDate: new Date()
          }
        })

        // Denetimin tüm bulgularının tamamlanıp tamamlanmadığını kontrol et
        const audit = await prisma.fiveSAudit.findUnique({
          where: { id: linkedFinding.auditId },
          include: {
            findings: true
          }
        })

        if (audit) {
          const allCompleted = audit.findings.every(f => f.status === 'COMPLETED')
          if (allCompleted && audit.findings.length > 0) {
            await prisma.fiveSAudit.update({
              where: { id: audit.id },
              data: { actionPlanStatus: 'COMPLETED' }
            })
          }
        }
      }
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error('Görev güncellenirken hata:', error)
    return NextResponse.json(
      { error: 'Görev güncellenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// DELETE - Görevi sil (soft delete)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-tasks: requireSession — sade auth (admin kontrolü yok mevcut)
    const { error } = await requireSession()
    if (error) return error

    const { id } = await params

    const task = await prisma.plannedTask.update({
      where: { id },
      data: {
        isActive: false,
      },
    })

    return NextResponse.json(task)
  } catch (error) {
    console.error('Görev silinirken hata:', error)
    return NextResponse.json(
      { error: 'Görev silinirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
