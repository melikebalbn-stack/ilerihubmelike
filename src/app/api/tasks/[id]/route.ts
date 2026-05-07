import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { TaskStatus, TaskPriority } from '@/generated/prisma'
import { getAllSubordinates } from '@/lib/ldap'
import { requireSession } from '@/lib/auth/require-session'
import { requireUser } from '@/lib/auth/require-user'

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

    // Yetki kontrolü: Görevi kim güncelleyebilir/tamamlayabilir?
    const userEmail = user.email
    const userRole = user.role
    const userDN = session.user.distinguishedName

    // Admin ve Super Admin her şeyi yapabilir
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN'

    // Görevin sorumlusu mu?
    const isResponsible = existingTask.responsiblePersonEmail?.toLowerCase() === userEmail

    // Bölüm müdürü mü? (Sorumlu kişinin yöneticisi mi?)
    let isManager = false
    if (userDN && existingTask.responsiblePersonEmail) {
      try {
        const subordinateEmails = await getAllSubordinates(userDN)
        isManager = subordinateEmails.some(
          email => email.toLowerCase() === existingTask.responsiblePersonEmail?.toLowerCase()
        )
      } catch (error) {
        console.error('Ast kontrolü yapılırken hata:', error)
      }
    }

    // Durum değişikliği için yetki kontrolü
    if (status && status !== existingTask.status) {
      if (!isAdmin && !isResponsible && !isManager) {
        return NextResponse.json(
          { error: 'Bu görevi güncelleme yetkiniz yok. Sadece görev sorumlusu, bölüm müdürü veya yönetici bu işlemi yapabilir.' },
          { status: 403 }
        )
      }
    }

    // Eğer durum COMPLETED olarak değişiyorsa, completedDate'i otomatik ayarla
    let finalCompletedDate = completedDate ? new Date(completedDate) : null
    if (status === TaskStatus.COMPLETED && !finalCompletedDate) {
      finalCompletedDate = new Date()
    }

    // Çoklu kişiler varsa JSON string olarak kaydet
    const responsiblePersonsJson = responsiblePersons && responsiblePersons.length > 0
      ? JSON.stringify(responsiblePersons)
      : undefined

    // Geriye uyumluluk: Eğer çoklu kişi varsa, ilk kişiyi eski alanlara da yaz
    let finalResponsiblePerson = responsiblePerson
    let finalResponsiblePersonEmail = responsiblePersonEmail
    if (responsiblePersons && responsiblePersons.length > 0) {
      finalResponsiblePerson = responsiblePersons[0].name
      finalResponsiblePersonEmail = responsiblePersons[0].email
    }

    // Çoklu departmanlar
    let finalResponsibleDepartments = responsibleDepartments
    let finalResponsibleDepartment = responsibleDepartment
    if (responsibleDepartments && responsibleDepartments.length > 0) {
      finalResponsibleDepartment = responsibleDepartments[0]
    }

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
