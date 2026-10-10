import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { TaskStatus, TaskEmailType } from '@/generated/prisma'
import {
  sendEscalationNotification,
  EscalationEmailData,
  EmailRecipient,
  EskalasyonBasamagi,
} from '@/lib/email'
import { getAllLDAPUsers } from '@/lib/ldap'
import { yoneticiZinciri, ustYonetimdeMi } from '@/lib/tasks/eskalasyon-zinciri'
import { requireUser } from '@/lib/auth/require-user'

// Eskalasyon kontrolü - Cron job tarafından çağrılır (ADMIN+ veya x-cron-secret)
export async function GET(request: NextRequest) {
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
    console.log('🔄 Eskalasyon kontrolü başlıyor...')

    const now = new Date()
    let managerEscalations = 0
    let ustYoneticiEskalasyonlari = 0
    let executiveEscalations = 0
    const yoneticisizGorevler: string[] = []

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

      // Sorumlu kişinin yönetici zinciri (AD `manager` alanı, aşağıdan yukarı)
      const zincir = yoneticiZinciri(ldapUsers, task.responsiblePersonEmail)
      const manager = zincir[0]

      if (!manager) {
        // AD'de yönetici yok → bu görev hiç eskale edilemiyor. Sessiz kalmasın:
        // sayıyı ve görev id'sini yanıtta döndürüyoruz ki cron çıktısında görünsün.
        console.log(`⚠️ Görev ${task.id}: Sorumlu kişinin AD'de yöneticisi bulunamadı`)
        yoneticisizGorevler.push(task.id)
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
        ustBasamakGun: executiveDays,
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

    // 2. basamak: yöneticinin yöneticisi (genelde müdür).
    // Üst yönetim YALNIZ zincir tükenince devreye girer — bkz. eskalasyon-zinciri.ts.
    for (const task of tasksForExecutiveEscalation) {
      const daysOverdue = Math.floor(
        (now.getTime() - task.dueDate.getTime()) / (24 * 60 * 60 * 1000)
      )

      const zincir = yoneticiZinciri(ldapUsers, task.responsiblePersonEmail)
      const manager = zincir[0] ?? null // 1. basamakta bilgilendirilen yönetici
      const ustYonetici = zincir[1] ?? null // bir üst basamak

      const ustYonetimListesi = executiveEmails.map((e) => e.email)
      // Bir üst basamak zaten üst yönetimdeyse ayrı bir mail atmanın anlamı yok.
      const basamak: EskalasyonBasamagi =
        ustYonetici && !ustYonetimdeMi(ustYonetici, ustYonetimListesi)
          ? 'UST_YONETICI'
          : 'EXECUTIVE'

      if (basamak === 'EXECUTIVE' && executiveEmails.length === 0) {
        console.log(`⚠️ Görev ${task.id}: zincir tükendi ama üst yönetim e-posta listesi boş`)
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
        managerName: manager?.displayName,
        altYoneticiAdi: manager?.displayName,
      }

      const recipients: EmailRecipient[] =
        basamak === 'UST_YONETICI' && ustYonetici
          ? [{ email: ustYonetici.email, name: ustYonetici.displayName }]
          : executiveEmails.map((e) => ({ email: e.email, name: e.name || e.email }))

      // 2. basamakta bir alt basamaktaki yönetici bilgi (CC) alıcısı olur.
      const cc: EmailRecipient[] =
        basamak === 'UST_YONETICI' && manager
          ? [{ email: manager.email, name: manager.displayName }]
          : []

      // E-posta gönder
      const result = await sendEscalationNotification(basamak, emailData, recipients, cc)

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

        // E-posta log kaydı. TaskEmailType bir DB enum'u; 2. basamak için yeni
        // değer eklemek migration gerektirdiğinden ESCALATION_EXECUTIVE kullanılır,
        // basamak ayrımı konu satırından ve recipientEmails'ten okunur.
        await prisma.taskEmailLog.create({
          data: {
            taskId: task.id,
            recipientEmails: [...recipients, ...cc].map((r) => r.email).join(', '),
            emailType: TaskEmailType.ESCALATION_EXECUTIVE,
            subject:
              basamak === 'UST_YONETICI'
                ? `⚠️ ESKALASYON (2. basamak): ${daysOverdue} Gündür Gecikmiş Görev - ${task.title}`
                : `🚨 KRİTİK ESKALASYON: ${daysOverdue} Günü Aşan Gecikmiş Görev - ${task.title}`,
            body:
              basamak === 'UST_YONETICI'
                ? `Üst yönetici eskalasyonu: ${task.title}`
                : `Üst yönetim eskalasyonu (zincir tükendi): ${task.title}`,
            status: 'SENT',
          },
        })

        if (basamak === 'UST_YONETICI') ustYoneticiEskalasyonlari++
        else executiveEscalations++
        console.log(
          `✅ ${basamak === 'UST_YONETICI' ? 'Üst yönetici' : 'Üst yönetim'} eskalasyonu gönderildi: ${task.title} -> ${recipients.map((r) => r.email).join(', ')}`
        )
      } else {
        console.error(`❌ 2. basamak eskalasyonu başarısız: ${task.title}`, result.error)
      }
    }

    console.log(
      `🔄 Eskalasyon kontrolü tamamlandı: ${managerEscalations} yönetici, ${ustYoneticiEskalasyonlari} üst yönetici, ${executiveEscalations} üst yönetim` +
        (yoneticisizGorevler.length ? ` · ${yoneticisizGorevler.length} görev AD'de yöneticisiz` : '')
    )

    return NextResponse.json({
      success: true,
      managerEscalations,
      ustYoneticiEskalasyonlari,
      executiveEscalations,
      yoneticisizGorevler,
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
