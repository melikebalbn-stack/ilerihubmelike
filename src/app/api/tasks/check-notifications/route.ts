import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TaskStatus, TaskEmailType } from '@/generated/prisma'
import { sendEmail } from '@/lib/email'

/**
 * POST /api/tasks/check-notifications
 * Checks all tasks and sends notifications based on reminder days
 * This endpoint is called by the cron scheduler (ADMIN only)
 */
export async function POST() {
  try {
    // Kimlik doğrulama kontrolü - sistem yönetimi işlemi
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Sadece ADMIN veya SUPER_ADMIN erişebilir
    const userRole = session.user.role || 'EMPLOYEE'
    if (!['ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    let notificationsSent = 0
    let errors = 0

    // Get notification email recipients (use calibration notification emails)
    const notificationEmails = await prisma.calibrationNotificationEmail.findMany({
      where: { isActive: true },
    })

    if (notificationEmails.length === 0) {
      console.log('⚠️ No notification email recipients configured')
      return NextResponse.json({
        success: true,
        message: 'No notification recipients configured',
        stats: { notificationsSent: 0, errors: 0 },
      })
    }

    const adminRecipients = notificationEmails.map((e) => ({
      email: e.email,
      name: e.name || e.email,
    }))

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

        // Send reminder notification
        const subject = generateReminderSubject(task, daysUntilDue)
        const body = generateReminderBody(task, daysUntilDue)

        try {
          // Send to admin recipients
          const result = await sendEmail(adminRecipients, subject, body)

          if (result.success) {
            notificationsSent++
            console.log(`✅ Sent reminder for task: ${task.title} (${daysUntilDue} days)`)

            await prisma.taskEmailLog.create({
              data: {
                taskId: task.id,
                emailType: 'REMINDER',
                subject,
                body: `Reminder sent: ${daysUntilDue} days until due`,
                status: 'SENT',
                recipientEmails: adminRecipients.map((r) => r.email).join(', '),
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

        // Send to responsible person if assigned
        if (task.responsiblePersonEmail) {
          try {
            const personalSubject = `⚠️ Görev Hatırlatması: ${task.title}`
            const personalBody = generatePersonalReminderBody(task, daysUntilDue)
            const personalRecipients = [{
              email: task.responsiblePersonEmail,
              name: task.responsiblePerson || task.responsiblePersonEmail,
            }]

            const personalResult = await sendEmail(personalRecipients, personalSubject, personalBody)

            if (personalResult.success) {
              notificationsSent++
              console.log(`✅ Sent personal reminder to ${task.responsiblePerson}`)
            }
          } catch (error) {
            console.error(`❌ Error sending personal reminder:`, error)
          }
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

          try {
            const result = await sendEmail(adminRecipients, overdueSubject, overdueBody)

            if (result.success) {
              notificationsSent++
              console.log(`✅ Sent overdue notification for task: ${task.title}`)

              await prisma.taskEmailLog.create({
                data: {
                  taskId: task.id,
                  emailType: 'OVERDUE',
                  subject: overdueSubject,
                  body: `Overdue notification sent: ${Math.abs(daysUntilDue)} days overdue`,
                  status: 'SENT',
                  recipientEmails: adminRecipients.map((r) => r.email).join(', '),
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

    return NextResponse.json({
      success: true,
      message: `Task notification check completed`,
      stats: {
        tasksChecked: tasks.length,
        notificationsSent,
        errors,
        recipientCount: adminRecipients.length,
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
    priority: string
    notes: string | null
  },
  daysUntilDue: number
): string {
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
${task.responsiblePerson ? `• Sorumlu: ${task.responsiblePerson}` : ''}
${task.notes ? `• Notlar: ${task.notes}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${daysUntilDue <= 7 ? '⚠️ UYARI: Bitiş tarihi yaklaşıyor! Lütfen gerekli aksiyonları alınız.' : 'Lütfen görevin zamanında tamamlanmasını sağlayınız.'}

--
Bu e-posta otomatik olarak ILERIHub Planlı Görevler Sistemi tarafından gönderilmiştir.
© 2025 İleri Group - System Development Team
  `.trim()
}

/**
 * Generate personal reminder email body
 */
function generatePersonalReminderBody(
  task: {
    title: string
    description: string | null
    dueDate: Date
    responsiblePerson: string | null
    notes: string | null
  },
  daysUntilDue: number
): string {
  const daysText =
    daysUntilDue === 0 ? 'Bugün son gün!' :
    daysUntilDue === 1 ? 'Yarın son gün!' :
    `${daysUntilDue} gün kaldı`

  return `
Sayın ${task.responsiblePerson || 'Yetkili'},

Sorumluluğunuzdaki aşağıdaki görevin bitiş tarihi yaklaşmaktadır.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 Görev Bilgileri:

• Görev: ${task.title}
${task.description ? `• Açıklama: ${task.description}` : ''}
• Bitiş Tarihi: ${task.dueDate.toLocaleDateString('tr-TR')}
• ⏱️ ${daysText}
${task.notes ? `• Notlar: ${task.notes}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ Lütfen görevin zamanında tamamlanması için gerekli işlemleri başlatınız.

Herhangi bir sorunuz varsa lütfen ilgili departman ile iletişime geçiniz.

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
    priority: string
  },
  daysOverdue: number
): string {
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
${task.responsiblePerson ? `• Sorumlu: ${task.responsiblePerson}` : ''}

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
 * Manual trigger for testing - same as POST
 */
export async function GET() {
  return POST()
}
