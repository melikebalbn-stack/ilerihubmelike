import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TaskStatus, TaskEmailType } from '@/generated/prisma'
import { sendEscalationNotification, EscalationEmailData, EmailRecipient } from '@/lib/email'
import { getAllLDAPUsers } from '@/lib/ldap'

// Eskalasyon kontrolü - Cron job tarafından çağrılır (ADMIN+ veya x-cron-secret)
export async function GET(request: NextRequest) {
  try {
    const cronSecret = request.headers.get('x-cron-secret')
    const isCron = !!cronSecret && cronSecret === process.env.CRON_SECRET

    if (!isCron) {
      const session = await getServerSession(authOptions)
      if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const userRole = session.user.role || 'EMPLOYEE'
      if (!['ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
        return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
      }
    }
    console.log('🔄 Eskalasyon kontrolü başlıyor...')

    const now = new Date()
    let managerEscalations = 0
    let executiveEscalations = 0

    // Eskalasyon ayarlarını al (yoksa varsayılan değerler kullan)
    const settings = await prisma.taskEscalationSettings.findFirst({
      where: { isActive: true },
    })

    const managerDays = settings?.managerEscalationDays ?? 1
    const executiveDays = settings?.executiveEscalationDays ?? 5

    // Gecikmiş ve henüz yöneticiye bildirilmemiş görevleri bul (1 gün+)
    const tasksForManagerEscalation = await prisma.plannedTask.findMany({
      where: {
        isActive: true,
        status: TaskStatus.OVERDUE,
        managerNotifiedAt: null,
        responsiblePersonEmail: { not: null },
        dueDate: {
          lte: new Date(now.getTime() - managerDays * 24 * 60 * 60 * 1000), // X gün önce
        },
      },
      include: {
        category: true,
      },
    })

    // Gecikmiş ve henüz üst yönetime bildirilmemiş görevleri bul (5 gün+)
    const tasksForExecutiveEscalation = await prisma.plannedTask.findMany({
      where: {
        isActive: true,
        status: TaskStatus.OVERDUE,
        executiveNotifiedAt: null,
        managerNotifiedAt: { not: null }, // Önce yönetici bilgilendirilmiş olmalı
        dueDate: {
          lte: new Date(now.getTime() - executiveDays * 24 * 60 * 60 * 1000), // X gün önce
        },
      },
      include: {
        category: true,
      },
    })

    // LDAP kullanıcılarını al (yönetici bilgisi için)
    const ldapUsers = await getAllLDAPUsers()

    // Üst yönetim e-posta listesini al
    const executiveEmails = await prisma.taskExecutiveEmail.findMany({
      where: { isActive: true },
    })

    // 1. Yöneticiye eskalasyon
    for (const task of tasksForManagerEscalation) {
      const daysOverdue = Math.floor(
        (now.getTime() - task.dueDate.getTime()) / (24 * 60 * 60 * 1000)
      )

      // Sorumlu kişinin yöneticisini bul
      const responsibleUser = ldapUsers.find(
        (u) => u.email?.toLowerCase() === task.responsiblePersonEmail?.toLowerCase()
      )

      if (!responsibleUser?.managerDN) {
        console.log(`⚠️ Görev ${task.id}: Sorumlu kişinin yöneticisi bulunamadı`)
        continue
      }

      // Yöneticiyi bul
      const manager = ldapUsers.find(
        (u) => u.distinguishedName.toLowerCase() === responsibleUser.managerDN?.toLowerCase()
      )

      if (!manager?.email) {
        console.log(`⚠️ Görev ${task.id}: Yöneticinin e-postası bulunamadı`)
        continue
      }

      const emailData: EscalationEmailData = {
        taskId: task.id,
        taskTitle: task.title,
        taskDescription: task.description,
        dueDate: task.dueDate,
        responsiblePerson: task.responsiblePerson,
        responsiblePersonEmail: task.responsiblePersonEmail,
        responsibleDepartment: task.responsibleDepartment,
        category: task.category?.name,
        priority: task.priority,
        daysOverdue,
      }

      const recipients: EmailRecipient[] = [
        { email: manager.email, name: manager.displayName },
      ]

      // E-posta gönder
      const result = await sendEscalationNotification('MANAGER', emailData, recipients)

      if (result.success) {
        // Görev kaydını güncelle
        await prisma.plannedTask.update({
          where: { id: task.id },
          data: {
            escalationLevel: 1,
            managerNotifiedAt: now,
            escalatedAt: now,
          },
        })

        // E-posta log kaydı
        await prisma.taskEmailLog.create({
          data: {
            taskId: task.id,
            recipientEmails: manager.email,
            emailType: TaskEmailType.ESCALATION_MANAGER,
            subject: `⚠️ ESKALASYON: Ekibinizde Gecikmiş Görev - ${task.title}`,
            body: `Yönetici eskalasyonu: ${task.title}`,
            status: 'SENT',
          },
        })

        managerEscalations++
        console.log(`✅ Yönetici eskalasyonu gönderildi: ${task.title} -> ${manager.email}`)
      } else {
        console.error(`❌ Yönetici eskalasyonu başarısız: ${task.title}`, result.error)
      }
    }

    // 2. Üst yönetime eskalasyon
    for (const task of tasksForExecutiveEscalation) {
      const daysOverdue = Math.floor(
        (now.getTime() - task.dueDate.getTime()) / (24 * 60 * 60 * 1000)
      )

      if (executiveEmails.length === 0) {
        console.log('⚠️ Üst yönetim e-posta listesi boş')
        break
      }

      // Sorumlu kişinin yöneticisini bul (e-postaya eklemek için)
      const responsibleUser = ldapUsers.find(
        (u) => u.email?.toLowerCase() === task.responsiblePersonEmail?.toLowerCase()
      )
      const manager = responsibleUser?.managerDN
        ? ldapUsers.find(
            (u) => u.distinguishedName.toLowerCase() === responsibleUser.managerDN?.toLowerCase()
          )
        : null

      const emailData: EscalationEmailData = {
        taskId: task.id,
        taskTitle: task.title,
        taskDescription: task.description,
        dueDate: task.dueDate,
        responsiblePerson: task.responsiblePerson,
        responsiblePersonEmail: task.responsiblePersonEmail,
        responsibleDepartment: task.responsibleDepartment,
        category: task.category?.name,
        priority: task.priority,
        daysOverdue,
        managerName: manager?.displayName,
      }

      const recipients: EmailRecipient[] = executiveEmails.map((e) => ({
        email: e.email,
        name: e.name || e.email,
      }))

      // E-posta gönder
      const result = await sendEscalationNotification('EXECUTIVE', emailData, recipients)

      if (result.success) {
        // Görev kaydını güncelle
        await prisma.plannedTask.update({
          where: { id: task.id },
          data: {
            escalationLevel: 2,
            executiveNotifiedAt: now,
            escalatedAt: now,
          },
        })

        // E-posta log kaydı
        await prisma.taskEmailLog.create({
          data: {
            taskId: task.id,
            recipientEmails: executiveEmails.map((e) => e.email).join(', '),
            emailType: TaskEmailType.ESCALATION_EXECUTIVE,
            subject: `🚨 KRİTİK ESKALASYON: 5 Günü Aşan Gecikmiş Görev - ${task.title}`,
            body: `Üst yönetim eskalasyonu: ${task.title}`,
            status: 'SENT',
          },
        })

        executiveEscalations++
        console.log(`✅ Üst yönetim eskalasyonu gönderildi: ${task.title}`)
      } else {
        console.error(`❌ Üst yönetim eskalasyonu başarısız: ${task.title}`, result.error)
      }
    }

    console.log(`🔄 Eskalasyon kontrolü tamamlandı: ${managerEscalations} yönetici, ${executiveEscalations} üst yönetim`)

    return NextResponse.json({
      success: true,
      managerEscalations,
      executiveEscalations,
      checkedAt: now.toISOString(),
    })
  } catch (error) {
    console.error('Eskalasyon kontrolü hatası:', error)
    return NextResponse.json(
      { error: 'Eskalasyon kontrolü sırasında bir hata oluştu' },
      { status: 500 }
    )
  }
}
