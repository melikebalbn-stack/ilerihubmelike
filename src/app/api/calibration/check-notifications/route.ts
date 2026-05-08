import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CalibrationStatus, CalibrationEmailType, NotificationRuleType } from '@/generated/prisma'
import { sendEmail } from '@/lib/email'
import { requireUser } from '@/lib/auth/require-user'

type DeviceAlert = {
  deviceId: string
  deviceName: string
  alertDate: Date // nextCalibrationDate veya nextVerificationDate
  responsiblePerson: string
  responsiblePersonEmail?: string | null
  daysRemaining: number
  alertType: 'calibration' | 'verification' // Kalibrasyon mu doğrulama mı
}

/**
 * POST /api/calibration/check-notifications
 * Checks all devices and sends notifications based on configured rules
 * Hem kalibrasyon hem doğrulama tarihlerini kontrol eder
 *
 * Auth: Session VEYA x-cron-secret header (sistem cron için)
 */
export async function POST(request: NextRequest) {
  try {
    // Sistem cron bypass: x-cron-secret header eşleşirse session zorunlu değil
    const cronSecret = request.headers.get('x-cron-secret')
    const isCron = !!cronSecret && cronSecret === process.env.CRON_SECRET

    if (!isCron) {
      // PR-Y2.5-calibration: requireUser → user.role/department + session.user.ou
      const { session, user, error } = await requireUser()
      if (error) return error

      const { canEditCalibration } = await import('@/lib/calibration-auth')
      if (!canEditCalibration(user.role, session.user.ou, user.department, session.user.permissions)) {
        return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
      }
    }

    const now = new Date()
    const dayOfWeek = now.getDay()
    const isMonday = dayOfWeek === 1

    let notificationsSent = 0
    let errors = 0
    let rulesProcessed = 0

    // Aktif kuralları al
    const rules = await prisma.calibrationNotificationRule.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    })

    // Bildirim alıcılarını kategoriye göre al
    const allNotificationEmails = await prisma.calibrationNotificationEmail.findMany({
      where: { isActive: true },
    })

    const expiringRecipients = allNotificationEmails
      .filter(e => e.category === 'EXPIRING')
      .map(e => ({ email: e.email, name: e.name || e.email }))

    const expiredRecipients = allNotificationEmails
      .filter(e => e.category === 'EXPIRED')
      .map(e => ({ email: e.email, name: e.name || e.email }))

    if (expiringRecipients.length === 0 && expiredRecipients.length === 0) {
      console.log('⚠️ No notification email recipients configured')
      return NextResponse.json({
        success: true,
        message: 'No notification recipients configured',
        stats: { rulesProcessed: 0, notificationsSent: 0, errors: 0 },
      })
    }

    // Tüm aktif cihazları çek
    const allDevices = await prisma.calibrationDevice.findMany({
      where: { isActive: true },
    })

    // Her kural için kontrol et
    for (const rule of rules) {
      rulesProcessed++

      // Haftalık tekrar kuralları sadece Pazartesi çalışır
      if (rule.type === NotificationRuleType.EXPIRED && rule.repeatWeekly && !isMonday) {
        console.log(`⏭️ Skipping weekly rule (not Monday): ${rule.type} ${rule.days} days`)
        continue
      }

      let emailType: CalibrationEmailType
      if (rule.type === NotificationRuleType.EXPIRING) {
        emailType = 'EXPIRING_SOON'
      } else {
        emailType = rule.repeatWeekly ? 'REMINDER' : 'EXPIRED'
      }

      // Cihazları tara - hem kalibrasyon hem doğrulama tarihlerini kontrol et
      const alertDevices: DeviceAlert[] = []

      for (const device of allDevices) {
        const calType = device.calibrationType || 'Kalibrasyon'

        // Kalibrasyon tarihi kontrolü (Kalibrasyon veya Kal/Doğ tiplerinde)
        if (calType === 'Kalibrasyon' || calType === 'Kal/Doğ' || !device.calibrationType) {
          const nextDate = device.nextCalibrationDate
          if (nextDate) {
            const daysRemaining = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            const match = checkRuleMatch(rule, daysRemaining, now, nextDate)
            if (match) {
              alertDevices.push({
                deviceId: device.deviceId,
                deviceName: device.name,
                alertDate: nextDate,
                responsiblePerson: device.responsiblePerson || 'Atanmamış',
                responsiblePersonEmail: device.responsiblePersonEmail,
                daysRemaining,
                alertType: 'calibration',
              })
            }
          }
        }

        // Doğrulama tarihi kontrolü (Doğrulama veya Kal/Doğ tiplerinde)
        if (calType === 'Doğrulama' || calType === 'Kal/Doğ') {
          const nextDate = device.nextVerificationDate
          if (nextDate) {
            const daysRemaining = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            const match = checkRuleMatch(rule, daysRemaining, now, nextDate)
            if (match) {
              alertDevices.push({
                deviceId: device.deviceId,
                deviceName: device.name,
                alertDate: nextDate,
                responsiblePerson: device.responsiblePerson || 'Atanmamış',
                responsiblePersonEmail: device.responsiblePersonEmail,
                daysRemaining,
                alertType: 'verification',
              })
            }
          }
        }
      }

      console.log(`📋 Rule: ${rule.type} ${rule.days} days - Found ${alertDevices.length} alerts`)

      if (alertDevices.length === 0) continue

      // Kalibrasyon ve doğrulama uyarılarını ayır
      const calAlerts = alertDevices.filter(d => d.alertType === 'calibration')
      const verAlerts = alertDevices.filter(d => d.alertType === 'verification')

      // Kural tipine göre alıcı listesini belirle
      const ruleRecipients = rule.type === NotificationRuleType.EXPIRING
        ? expiringRecipients
        : expiredRecipients

      if (ruleRecipients.length === 0) {
        console.log(`⏭️ No recipients for ${rule.type} category, skipping`)
        continue
      }

      // Kalibrasyon uyarıları için batch email
      if (calAlerts.length > 0) {
        const subject = generateBatchEmailSubject(emailType, calAlerts.length, 'Kalibrasyon')
        const body = generateBatchEmailBody(emailType, calAlerts, rule, 'Kalibrasyon')

        try {
          const result = await sendEmail(ruleRecipients, subject, body)
          if (result.success) {
            notificationsSent++
            console.log(`✅ Sent calibration ${emailType} notification for ${calAlerts.length} devices`)
            await logEmails(calAlerts, allDevices, emailType, subject, ruleRecipients)
          } else {
            errors++
            console.error(`❌ Failed to send calibration notification: ${result.error}`)
          }
        } catch (error) {
          errors++
          console.error('❌ Error sending calibration batch notification:', error)
        }
      }

      // Doğrulama uyarıları için batch email
      if (verAlerts.length > 0) {
        const subject = generateBatchEmailSubject(emailType, verAlerts.length, 'Doğrulama')
        const body = generateBatchEmailBody(emailType, verAlerts, rule, 'Doğrulama')

        try {
          const result = await sendEmail(ruleRecipients, subject, body)
          if (result.success) {
            notificationsSent++
            console.log(`✅ Sent verification ${emailType} notification for ${verAlerts.length} devices`)
            await logEmails(verAlerts, allDevices, emailType, subject, ruleRecipients)
          } else {
            errors++
            console.error(`❌ Failed to send verification notification: ${result.error}`)
          }
        } catch (error) {
          errors++
          console.error('❌ Error sending verification batch notification:', error)
        }
      }

      // Sorumlu kişilere bireysel e-posta gönder (tüm EXPIRING kurallarında)
      if (rule.type === NotificationRuleType.EXPIRING) {
        for (const alert of alertDevices) {
          if (alert.responsiblePersonEmail) {
            try {
              const typeLabel = alert.alertType === 'calibration' ? 'Kalibrasyon' : 'Doğrulama'
              const personalSubject = `⚠️ ${typeLabel} Hatırlatması: ${alert.deviceName} (${alert.deviceId})`
              const personalBody = generatePersonalEmailBody(alert)
              const personalRecipients = [{ email: alert.responsiblePersonEmail, name: alert.responsiblePerson }]

              const personalResult = await sendEmail(personalRecipients, personalSubject, personalBody)

              if (personalResult.success) {
                notificationsSent++
                console.log(`✅ Sent personal ${typeLabel} notification to ${alert.responsiblePerson}`)

                const dbDevice = allDevices.find(d => d.deviceId === alert.deviceId)
                if (dbDevice) {
                  await prisma.calibrationEmailLog.create({
                    data: {
                      deviceId: dbDevice.id,
                      emailType: 'EXPIRING_SOON',
                      subject: personalSubject,
                      body: `Personal ${typeLabel.toLowerCase()} notification to responsible person`,
                      status: 'SENT',
                      recipientEmails: alert.responsiblePersonEmail,
                    },
                  })
                }
              } else {
                console.error(`❌ Failed to send personal notification to ${alert.responsiblePersonEmail}: ${personalResult.error}`)
              }
            } catch (error) {
              console.error(`❌ Error sending personal notification to ${alert.responsiblePersonEmail}:`, error)
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Notification check completed`,
      stats: {
        rulesProcessed,
        notificationsSent,
        errors,
        expiringRecipientCount: expiringRecipients.length,
        expiredRecipientCount: expiredRecipients.length,
      },
    })
  } catch (error) {
    console.error('Error checking calibration notifications:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to check notifications' },
      { status: 500 }
    )
  }
}

/**
 * Kuralın bir tarih ile eşleşip eşleşmediğini kontrol et
 */
function checkRuleMatch(
  rule: { type: string; days: number; repeatWeekly: boolean },
  daysRemaining: number,
  now: Date,
  nextDate: Date
): boolean {
  if (rule.type === 'EXPIRING') {
    // Süresi yaklaşan: nextDate gelecekte ve rule.days gün veya daha az kalmış
    return daysRemaining > 0 && daysRemaining <= rule.days
  } else {
    // Süresi geciken: nextDate geçmişte
    if (rule.repeatWeekly) {
      // Haftalık tekrar: tüm geçmiş tarihli cihazlar
      return nextDate < now
    } else {
      // Tam eşleşme: tam olarak rule.days gün geçmiş
      const daysExpired = Math.abs(daysRemaining)
      return daysRemaining <= 0 && daysExpired >= rule.days && daysExpired < rule.days + 1
    }
  }
}

/**
 * E-posta loglarını kaydet
 */
async function logEmails(
  alerts: DeviceAlert[],
  allDevices: any[],
  emailType: CalibrationEmailType,
  subject: string,
  recipients: { email: string; name: string }[]
) {
  const recipientEmailList = recipients.map((r) => r.email).join(', ')
  for (const alert of alerts) {
    const dbDevice = allDevices.find(d => d.deviceId === alert.deviceId)
    if (dbDevice) {
      await prisma.calibrationEmailLog.create({
        data: {
          deviceId: dbDevice.id,
          emailType,
          subject,
          body: `Batch notification - ${alert.alertType}`,
          status: 'SENT',
          recipientEmails: recipientEmailList,
        },
      })
    }
  }
}

/**
 * Sorumlu kişi için bireysel e-posta gövdesi
 */
function generatePersonalEmailBody(alert: DeviceAlert): string {
  const now = new Date()
  const typeLabel = alert.alertType === 'calibration' ? 'Kalibrasyon' : 'Doğrulama'

  const daysText = alert.daysRemaining > 0
    ? `${alert.daysRemaining} gün kaldı`
    : alert.daysRemaining === 0
      ? 'Bugün doluyor'
      : `${Math.abs(alert.daysRemaining)} gün geçti`

  return `
Sayın ${alert.responsiblePerson},

Sorumluluğunuzdaki aşağıdaki cihazın ${typeLabel.toLowerCase()} süresi yaklaşmaktadır.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 Cihaz Bilgileri:

• Cihaz ID: ${alert.deviceId}
• Cihaz Adı: ${alert.deviceName}
• ${typeLabel} Bitiş Tarihi: ${alert.alertDate.toLocaleDateString('tr-TR')}
• ⏱️ ${daysText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ Lütfen cihazın ${typeLabel.toLowerCase()}su için gerekli işlemleri başlatınız.

Herhangi bir sorunuz varsa lütfen Kalite Departmanı ile iletişime geçiniz.

--
Bu e-posta otomatik olarak ILERIHub Kalibrasyon Yönetim Sistemi tarafından gönderilmiştir.
© 2025 İleri Group - System Development Team
  `.trim()
}

/**
 * Batch e-posta konusu
 */
function generateBatchEmailSubject(type: CalibrationEmailType, count: number, label: string): string {
  switch (type) {
    case 'EXPIRING_SOON':
      return `⚠️ ${label} Uyarısı: ${count} cihazın süresi yaklaşıyor`
    case 'EXPIRED':
      return `🚨 ACİL: ${count} cihazın ${label.toLowerCase()} süresi doldu`
    case 'REMINDER':
      return `🔔 Haftalık Hatırlatma: ${count} cihaz ${label.toLowerCase()} bekliyor`
    default:
      return `${label} Bildirimi: ${count} cihaz`
  }
}

/**
 * Batch e-posta gövdesi
 */
function generateBatchEmailBody(
  type: CalibrationEmailType,
  alerts: DeviceAlert[],
  rule: { type: string; days: number; repeatWeekly: boolean },
  label: string
): string {
  const now = new Date()
  const dateStr = now.toLocaleDateString('tr-TR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  let header: string
  let urgency: string

  switch (type) {
    case 'EXPIRING_SOON':
      header = `📅 ${label} Süresi Yaklaşan Cihazlar (${rule.days} gün kala)`
      urgency = `Lütfen aşağıdaki cihazların ${label.toLowerCase()}larını zamanında yaptırınız.`
      break
    case 'EXPIRED':
      header = `🚨 ${label} Süresi Dolan Cihazlar`
      urgency = `⚠️ UYARI: ${label}su geçmiş cihazlar kullanıma uygun değildir. ACİL işlem gereklidir!`
      break
    case 'REMINDER':
      header = `🔔 Haftalık ${label} Hatırlatması`
      urgency = `Aşağıdaki cihazların ${label.toLowerCase()}ları hala beklemektedir.`
      break
    default:
      header = `${label} Bildirimi`
      urgency = ''
  }

  const deviceLines = alerts
    .map((d, i) => {
      const daysText =
        d.daysRemaining > 0
          ? `${d.daysRemaining} gün kaldı`
          : d.daysRemaining === 0
            ? 'Bugün doluyor'
            : `${Math.abs(d.daysRemaining)} gün geçti`

      return `${i + 1}. ${d.deviceName} (${d.deviceId})
   📍 Sorumlu: ${d.responsiblePerson}
   📅 ${label} Tarihi: ${d.alertDate.toLocaleDateString('tr-TR')}
   ⏱️  ${daysText}`
    })
    .join('\n\n')

  return `
${header}
Tarih: ${dateStr}

${urgency}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${deviceLines}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Toplam: ${alerts.length} cihaz

--
Bu e-posta otomatik olarak ILERIHub Kalibrasyon Yönetim Sistemi tarafından gönderilmiştir.
© 2025 İleri Group - System Development Team
  `.trim()
}

/**
 * GET /api/calibration/check-notifications
 * Manual trigger — POST'un aynısı.
 */
export async function GET(request: NextRequest) {
  return POST(request)
}
