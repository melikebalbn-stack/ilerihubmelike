import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { TaskStatus, TaskPriority, TaskEmailType } from '@/generated/prisma'
import { sendTaskNotification, TaskEmailData, EmailRecipient } from '@/lib/email'
import { getAllSubordinates } from '@/lib/ldap'
import { requireUser } from '@/lib/auth/require-user'

// Departman adını AD OU adına çevir
async function getDepartmentAdOuName(departmentName: string): Promise<string | null> {
  const dept = await prisma.department.findFirst({
    where: { name: departmentName },
    select: { adOuName: true },
  })
  return dept?.adOuName || null
}

// GET - Görevleri listele (görünürlük kurallarına göre)
export async function GET(request: NextRequest) {
  try {
    // PR-TASKS-SECURITY: requireUser ZORUNLU + session (ou/distinguishedName LDAP-only)
    // Önceki "if (session?.user)" optional auth — auth'sız tüm task listesi sızdırıyordu
    const { session, user, error } = await requireUser()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const categoryId = searchParams.get('categoryId')
    // viewMode: 'my' (benim görevlerim), 'department' (departman), 'subordinates' (astlarım), 'all' (tümü - sadece admin)
    const viewMode = searchParams.get('viewMode') || 'my'

    const where: any = {
      isActive: true,
    }

    // Görünürlük filtreleme — auth artık zorunlu
    {
      const userEmail = user.email
      const userOU = session.user.ou
      const userDN = session.user.distinguishedName
      const userRole = user.role

      // Kullanıcının departman adını bul
      let userDeptName: string | null = null
      if (userOU) {
        const dept = await prisma.department.findFirst({
          where: { adOuName: userOU },
          select: { name: true },
        })
        userDeptName = dept?.name || null
      }

      // viewMode'a göre filtrele
      switch (viewMode) {
        case 'my':
          // Bana atanan görevler (tek kişi + çoklu kişi + departman)
          if (userEmail) {
            const myConditions: any[] = [
              // Doğrudan bana atanan (tek kişi)
              { responsiblePersonEmail: { equals: userEmail, mode: 'insensitive' } },
              // Çoklu kişi atamasında benim email'im geçiyor
              { responsiblePersons: { contains: userEmail, mode: 'insensitive' } },
            ]
            // Departmanıma atanan görevler de "benim görevlerim"de görünsün
            if (userDeptName) {
              myConditions.push(
                { responsibleDepartment: { equals: userDeptName, mode: 'insensitive' } }
              )
            }
            where.OR = myConditions
          } else {
            return NextResponse.json([])
          }
          break

        case 'department':
          // Sadece departmanıma atanan görevler
          if (userDeptName) {
            where.responsibleDepartment = { equals: userDeptName, mode: 'insensitive' }
          } else {
            return NextResponse.json([])
          }
          break

        case 'subordinates':
          // Astlarımın görevleri (yöneticiler için)
          if (userDN) {
            try {
              const subordinateEmails = await getAllSubordinates(userDN)
              if (subordinateEmails.length > 0) {
                where.responsiblePersonEmail = { in: subordinateEmails, mode: 'insensitive' }
              } else {
                return NextResponse.json([])
              }
            } catch (error) {
              console.error('Astlar alınamadı:', error)
              return NextResponse.json([])
            }
          } else {
            return NextResponse.json([])
          }
          break

        case 'all':
          // Tüm görevler - sadece ADMIN ve SUPER_ADMIN için
          if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
            // Admin değilse kendi görevlerini göster
            if (userEmail) {
              where.responsiblePersonEmail = { equals: userEmail, mode: 'insensitive' }
            } else {
              return NextResponse.json([])
            }
          }
          // Admin ise filtre yok, tüm görevler
          break

        default:
          // Varsayılan: kendi görevleri
          if (userEmail) {
            where.responsiblePersonEmail = { equals: userEmail, mode: 'insensitive' }
          }
      }
    }

    // Arama filtresi
    if (search) {
      const searchFilter = {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { responsiblePerson: { contains: search, mode: 'insensitive' } },
        ],
      }

      // Mevcut where.OR varsa AND ile birleştir
      if (where.OR) {
        where.AND = [{ OR: where.OR }, searchFilter]
        delete where.OR
      } else {
        where.OR = searchFilter.OR
      }
    }

    if (status && status !== 'all') {
      where.status = status as TaskStatus
    }

    if (priority && priority !== 'all') {
      where.priority = priority as TaskPriority
    }

    if (categoryId && categoryId !== 'all') {
      where.categoryId = categoryId
    }

    const tasks = await prisma.plannedTask.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: [
        { dueDate: 'asc' },
        { priority: 'desc' },
      ],
    })

    // Durum güncellemelerini kontrol et
    const now = new Date()
    const tasksToUpdate: { id: string; status: TaskStatus }[] = []

    for (const task of tasks) {
      // Eğer görev tamamlanmamış ve tarihi geçmişse OVERDUE yap
      if (
        task.dueDate < now &&
        task.status !== TaskStatus.COMPLETED &&
        task.status !== TaskStatus.CANCELLED &&
        task.status !== TaskStatus.OVERDUE
      ) {
        tasksToUpdate.push({ id: task.id, status: TaskStatus.OVERDUE })
        task.status = TaskStatus.OVERDUE
      }
    }

    // Batch update
    if (tasksToUpdate.length > 0) {
      await prisma.$transaction(
        tasksToUpdate.map((update) =>
          prisma.plannedTask.update({
            where: { id: update.id },
            data: { status: update.status },
          })
        )
      )
    }

    return NextResponse.json(tasks)
  } catch (error) {
    console.error('Görevler alınırken hata:', error)
    return NextResponse.json(
      { error: 'Görevler alınırken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// POST - Yeni görev ekle
export async function POST(request: NextRequest) {
  try {
    // PR-TASKS-SECURITY: requireUser ZORUNLU
    // Önceki kod session import edip hiç kullanmıyordu — auth'sız task oluşturma açıktı
    const { user, error } = await requireUser()
    if (error) return error

    const body = await request.json()

    const {
      title,
      description,
      categoryId,
      dueDate,
      startDate,
      isRecurring,
      recurrenceType,
      recurrenceInterval,
      reminderDays,
      responsiblePerson,
      responsibleDepartment,
      responsiblePersons, // Yeni: Çoklu kişiler [{name, email}]
      responsibleDepartments, // Yeni: Çoklu departmanlar [string]
      notificationEmails,
      priority,
      notes,
      attachments,
      // Eskalasyon alanları
      escalationEnabled,
      escalationCategory,
      escalationPriority,
    } = body
    // PR-Y2.5-tasks: input boundary normalization — DB email lowercase invariant
    let { responsiblePersonEmail } = body
    if (typeof responsiblePersonEmail === 'string' && responsiblePersonEmail.trim() !== '') {
      responsiblePersonEmail = responsiblePersonEmail.toLowerCase()
    }

    if (!title || !dueDate) {
      return NextResponse.json(
        { error: 'Görev adı ve bitiş tarihi zorunludur' },
        { status: 400 }
      )
    }

    // Durumu belirle
    const now = new Date()
    const dueDateObj = new Date(dueDate)
    let status: TaskStatus = TaskStatus.PENDING

    if (dueDateObj < now) {
      status = TaskStatus.OVERDUE
    }

    // Çoklu kişiler varsa JSON string olarak kaydet
    const responsiblePersonsJson = responsiblePersons && responsiblePersons.length > 0
      ? JSON.stringify(responsiblePersons)
      : null

    // Geriye uyumluluk: Eğer çoklu kişi yoksa eski alanları kullan
    // Eğer çoklu kişi varsa, ilk kişiyi eski alanlara da yaz
    let finalResponsiblePerson = responsiblePerson
    let finalResponsiblePersonEmail = responsiblePersonEmail
    if (responsiblePersons && responsiblePersons.length > 0) {
      finalResponsiblePerson = responsiblePersons[0].name
      finalResponsiblePersonEmail = responsiblePersons[0].email
    }

    // Çoklu departmanlar varsa kullan, yoksa eski alanı array'e çevir
    let finalResponsibleDepartments = responsibleDepartments || []
    if (finalResponsibleDepartments.length === 0 && responsibleDepartment) {
      finalResponsibleDepartments = [responsibleDepartment]
    }

    const task = await prisma.plannedTask.create({
      data: {
        title,
        description,
        categoryId: categoryId || null,
        dueDate: dueDateObj,
        startDate: startDate ? new Date(startDate) : null,
        isRecurring: isRecurring || false,
        recurrenceType: recurrenceType || null,
        recurrenceInterval: recurrenceInterval || null,
        reminderDays: reminderDays || [],
        responsiblePerson: finalResponsiblePerson,
        responsiblePersonEmail: finalResponsiblePersonEmail,
        responsibleDepartment: finalResponsibleDepartments[0] || responsibleDepartment || null,
        responsiblePersons: responsiblePersonsJson,
        responsibleDepartments: finalResponsibleDepartments,
        notificationEmails: notificationEmails || [],
        priority: priority || TaskPriority.NORMAL,
        status,
        notes,
        attachments,
        // Eskalasyon alanları
        escalationEnabled: escalationEnabled || false,
        escalationCategory: escalationCategory || null,
        escalationPriority: escalationPriority || null,
      },
      include: {
        category: true,
      },
    })

    // E-posta bildirimlerini gönder
    const emailsToSend: string[] = [...(notificationEmails || [])]

    // Çoklu sorumlu kişilerin e-postalarını ekle
    if (responsiblePersons && responsiblePersons.length > 0) {
      for (const person of responsiblePersons) {
        if (person.email && !emailsToSend.includes(person.email)) {
          emailsToSend.push(person.email)
        }
      }
    } else if (responsiblePersonEmail && !emailsToSend.includes(responsiblePersonEmail)) {
      // Eski format: tek kişi
      emailsToSend.push(responsiblePersonEmail)
    }

    // Departmana atanan görevlerde departman üyelerine bildirim gönder
    if (finalResponsibleDepartments.length > 0) {
      try {
        for (const deptName of finalResponsibleDepartments) {
          // Departmanın AD OU adını bul
          const dept = await prisma.department.findFirst({
            where: { name: deptName },
            select: { adOuName: true },
          })
          const ouName = dept?.adOuName || deptName

          // Bu departmandaki kullanıcıları DB'den çek
          const deptUsers = await prisma.user.findMany({
            where: {
              isActive: true,
              OR: [
                { department: { equals: deptName, mode: 'insensitive' } },
                { department: { equals: ouName, mode: 'insensitive' } },
                { officeLocation: { equals: ouName, mode: 'insensitive' } },
              ],
            },
            select: { email: true, name: true },
          })

          for (const deptUser of deptUsers) {
            if (deptUser.email && !emailsToSend.includes(deptUser.email)) {
              emailsToSend.push(deptUser.email)
            }
          }
        }
      } catch (deptError) {
        console.error('Departman kullanıcıları alınamadı:', deptError)
      }
    }

    // Ayarlardaki global bildirim e-postalarını da ekle
    const globalNotificationEmails = await prisma.taskNotificationEmail.findMany({
      where: { isActive: true },
    })

    for (const globalEmail of globalNotificationEmails) {
      if (!emailsToSend.includes(globalEmail.email)) {
        emailsToSend.push(globalEmail.email)
      }
    }

    if (emailsToSend.length > 0) {
      const recipients: EmailRecipient[] = emailsToSend.map(email => ({
        email,
        name: email === responsiblePersonEmail ? (responsiblePerson || email) : email,
      }))

      const emailData: TaskEmailData = {
        taskId: task.id,
        taskTitle: title,
        taskDescription: description,
        dueDate: dueDateObj,
        responsiblePerson,
        responsibleDepartment,
        category: task.category?.name,
        priority: priority || 'NORMAL',
      }

      // E-posta gönder (arka planda, response'u bekleme)
      sendTaskNotification('CREATED', emailData, recipients)
        .then(async (result) => {
          // E-posta log'unu kaydet
          await prisma.taskEmailLog.create({
            data: {
              taskId: task.id,
              recipientEmails: emailsToSend.join(', '),
              emailType: TaskEmailType.REMINDER, // CREATED yok, REMINDER kullanıyoruz
              subject: `📋 Yeni Görev Oluşturuldu: ${title}`,
              body: `Görev oluşturuldu: ${title}`,
              status: result.success ? 'SENT' : 'FAILED',
              errorMessage: result.error,
            },
          })
          console.log(`📧 Görev bildirimi gönderildi: ${title} -> ${emailsToSend.join(', ')}`)
        })
        .catch((error) => {
          console.error('E-posta gönderme hatası:', error)
        })
    }

    // In-app bildirim oluştur (bildirim zili)
    try {
      // Bildirim gönderilecek kullanıcıları bul (email listesinden)
      const notifyEmails = new Set<string>()

      // Sorumlu kişiler
      if (responsiblePersons && responsiblePersons.length > 0) {
        for (const person of responsiblePersons) {
          if (person.email) notifyEmails.add(person.email.toLowerCase())
        }
      } else if (finalResponsiblePersonEmail) {
        notifyEmails.add(finalResponsiblePersonEmail.toLowerCase())
      }

      // Departman üyeleri
      if (finalResponsibleDepartments.length > 0) {
        for (const deptName of finalResponsibleDepartments) {
          const dept = await prisma.department.findFirst({
            where: { name: deptName },
            select: { adOuName: true },
          })
          const ouName = dept?.adOuName || deptName

          const deptUsers = await prisma.user.findMany({
            where: {
              isActive: true,
              OR: [
                { department: { equals: deptName, mode: 'insensitive' } },
                { department: { equals: ouName, mode: 'insensitive' } },
                { officeLocation: { equals: ouName, mode: 'insensitive' } },
              ],
            },
            select: { email: true },
          })

          for (const u of deptUsers) {
            if (u.email) notifyEmails.add(u.email.toLowerCase())
          }
        }
      }

      // Görev oluşturanı bildirimden çıkar
      const creatorEmail = user.email
      notifyEmails.delete(creatorEmail)

      if (notifyEmails.size > 0) {
        // Email'lerden user ID'lerini bul
        const usersToNotify = await prisma.user.findMany({
          where: {
            email: { in: Array.from(notifyEmails), mode: 'insensitive' },
            isActive: true,
          },
          select: { id: true },
        })

        if (usersToNotify.length > 0) {
          await prisma.notification.createMany({
            data: usersToNotify.map(u => ({
              userId: u.id,
              title: `Yeni Görev: ${title}`,
              message: description
                ? `${description.substring(0, 150)}${description.length > 150 ? '...' : ''}`
                : `Size yeni bir görev atandı: ${title}`,
              type: 'INFO' as const,
              link: `/tasks?highlight=${task.id}`,
            })),
          })
        }
      }
    } catch (notifError) {
      console.error('In-app bildirim oluşturma hatası:', notifError)
    }

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error('Görev eklenirken hata:', error)
    return NextResponse.json(
      { error: 'Görev eklenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
