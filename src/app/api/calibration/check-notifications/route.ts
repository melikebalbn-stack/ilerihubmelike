import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CalibrationStatus, CalibrationEmailType, NotificationRuleType } from '@/generated/prisma'
import { sendEmail, generateEmailContent, CalibrationEmailData } from '@/lib/email'

/**
 * POST /api/calibration/check-notifications
 * Checks all devices and sends notifications based on configured rules
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
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)

    // Get current day of week (0=Sunday, 1=Monday, ...)
    const dayOfWeek = now.getDay()
    const isMonday = dayOfWeek === 1

    let notificationsSent = 0
    let errors = 0
    let rulesProcessed = 0

    // Get active notification rules
    const rules = await prisma.calibrationNotificationRule.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    })

    // Get notification email recipients
    const notificationEmails = await prisma.calibrationNotificationEmail.findMany({
      where: { isActive: true },
    })

    if (notificationEmails.length === 0) {
      console.log('⚠️ No notification email recipients configured')
      return NextResponse.json({
        success: true,
        message: 'No notification recipients configured',
        stats: { rulesProcessed: 0, notificationsSent: 0, errors: 0 },
      })
    }

    const recipients = notificationEmails.map((e) => ({
      email: e.email,
      name: e.name || e.email,
    }))

    // Process each rule
    for (const rule of rules) {
      rulesProcessed++

      // For EXPIRED rules with weekly repeat, only run on Mondays
      if (rule.type === NotificationRuleType.EXPIRED && rule.repeatWeekly && !isMonday) {
        console.log(`⏭️ Skipping weekly rule (not Monday): ${rule.type} ${rule.days} days`)
        continue
      }

      // Calculate the target date based on rule
      let targetDate: Date
      let emailType: CalibrationEmailType

      if (rule.type === NotificationRuleType.EXPIRING) {
        // EXPIRING + BEFORE: X gün kala
        targetDate = new Date(now.getTime() + rule.days * 24 * 60 * 60 * 1000)
        emailType = 'EXPIRING_SOON'
      } else {
        // EXPIRED + AFTER: X gün sonra
        targetDate = new Date(now.getTime() - rule.days * 24 * 60 * 60 * 1000)
        emailType = rule.repeatWeekly ? 'REMINDER' : 'EXPIRED'
      }

      // Find devices matching this rule
      let devices
      if (rule.type === NotificationRuleType.EXPIRING) {
        // Find devices expiring within the specified days
        const targetStart = new Date(now)
        targetStart.setHours(0, 0, 0, 0)
        const targetEnd = new Date(targetDate)
        targetEnd.setHours(23, 59, 59, 999)

        devices = await prisma.calibrationDevice.findMany({
          where: {
            isActive: true,
            status: CalibrationStatus.EXPIRING,
            nextCalibrationDate: {
              gte: targetStart,
              lte: targetEnd,
            },
          },
        })
      } else {
        // Find devices expired for at least the specified days
        if (rule.repeatWeekly) {
          // For weekly repeat, get all expired devices
          devices = await prisma.calibrationDevice.findMany({
            where: {
              isActive: true,
              status: CalibrationStatus.EXPIRED,
              nextCalibrationDate: {
                lt: now,
              },
            },
          })
        } else {
          // For non-repeat, get devices expired exactly X days ago
          const targetStart = new Date(targetDate)
          targetStart.setHours(0, 0, 0, 0)
          const targetEnd = new Date(targetDate)
          targetEnd.setHours(23, 59, 59, 999)

          devices = await prisma.calibrationDevice.findMany({
            where: {
              isActive: true,
              status: CalibrationStatus.EXPIRED,
              nextCalibrationDate: {
                gte: targetStart,
                lte: targetEnd,
              },
            },
          })
        }
      }

      console.log(`📋 Rule: ${rule.type} ${rule.days} days - Found ${devices.length} devices`)

      if (devices.length === 0) continue

      // Group devices for batch email
      const deviceList = devices.map((d) => ({
        deviceId: d.deviceId,
        deviceName: d.name,
        nextCalibrationDate: d.nextCalibrationDate,
        responsiblePerson: d.responsiblePerson || 'Atanmamış',
        responsiblePersonEmail: d.responsiblePersonEmail,
        daysRemaining: Math.ceil(
          (d.nextCalibrationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        ),
      }))

      // Generate and send batch email to admin recipients
      const subject = generateBatchEmailSubject(emailType, devices.length)
      const body = generateBatchEmailBody(emailType, deviceList, rule)

      try {
        const result = await sendEmail(recipients, subject, body)

        if (result.success) {
          notificationsSent++
          console.log(`✅ Sent ${emailType} notification for ${devices.length} devices to admins`)

          // Log emails for each device
          const recipientEmailList = recipients.map((r) => r.email).join(', ')
          for (const device of devices) {
            await prisma.calibrationEmailLog.create({
              data: {
                deviceId: device.id,
                emailType,
                subject,
                body: `Batch notification for rule: ${rule.type} ${rule.days} days`,
                status: 'SENT',
                recipientEmails: recipientEmailList,
              },
            })
          }
        } else {
          errors++
          console.error(`❌ Failed to send notification: ${result.error}`)
        }
      } catch (error) {
        errors++
        console.error('❌ Error sending batch notification:', error)
      }

      // Send individual emails to responsible persons (only for EXPIRING rules, 7 days before)
      if (rule.type === NotificationRuleType.EXPIRING && rule.days === 7) {
        for (const device of deviceList) {
          if (device.responsiblePersonEmail) {
            try {
              const personalSubject = `⚠️ Kalibrasyon Hatırlatması: ${device.deviceName} (${device.deviceId})`
              const personalBody = generatePersonalEmailBody(device)
              const personalRecipients = [{ email: device.responsiblePersonEmail, name: device.responsiblePerson }]

              const personalResult = await sendEmail(personalRecipients, personalSubject, personalBody)

              if (personalResult.success) {
                notificationsSent++
                console.log(`✅ Sent personal notification to ${device.responsiblePerson} (${device.responsiblePersonEmail})`)

                // Find the device by deviceId to get the actual id
                const dbDevice = devices.find(d => d.deviceId === device.deviceId)
                if (dbDevice) {
                  await prisma.calibrationEmailLog.create({
                    data: {
                      deviceId: dbDevice.id,
                      emailType: 'EXPIRING_SOON',
                      subject: personalSubject,
                      body: `Personal notification to responsible person`,
                      status: 'SENT',
                      recipientEmails: device.responsiblePersonEmail,
                    },
                  })
                }
              } else {
                console.error(`❌ Failed to send personal notification to ${device.responsiblePersonEmail}: ${personalResult.error}`)
              }
            } catch (error) {
              console.error(`❌ Error sending personal notification to ${device.responsiblePersonEmail}:`, error)
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
        recipientCount: recipients.length,
      },
    })
  } catch (error) {
    console.error('Error checking calibration notifications:', error)
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
 * Generate personal email body for responsible person
 */
function generatePersonalEmailBody(device: {
  deviceId: string
  deviceName: string
  nextCalibrationDate: Date
  responsiblePerson: string
  daysRemaining: number
}): string {
  const now = new Date()
  const dateStr = now.toLocaleDateString('tr-TR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const daysText = device.daysRemaining > 0
    ? `${device.daysRemaining} gün kaldı`
    : device.daysRemaining === 0
      ? 'Bugün doluyor'
      : `${Math.abs(device.daysRemaining)} gün geçti`

  return `
Sayın ${device.responsiblePerson},

Sorumluluğunuzdaki aşağıdaki cihazın kalibrasyon süresi yaklaşmaktadır.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 Cihaz Bilgileri:

• Cihaz ID: ${device.deviceId}
• Cihaz Adı: ${device.deviceName}
• Kalibrasyon Bitiş Tarihi: ${device.nextCalibrationDate.toLocaleDateString('tr-TR')}
• ⏱️ ${daysText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ Lütfen cihazın kalibrasyonu için gerekli işlemleri başlatınız.

Herhangi bir sorunuz varsa lütfen Kalite Departmanı ile iletişime geçiniz.

--
Bu e-posta otomatik olarak ILERIHub Kalibrasyon Yönetim Sistemi tarafından gönderilmiştir.
© 2025 İleri Group - System Development Team
  `.trim()
}

/**
 * Generate batch email subject
 */
function generateBatchEmailSubject(type: CalibrationEmailType, count: number): string {
  switch (type) {
    case 'EXPIRING_SOON':
      return `⚠️ Kalibrasyon Uyarısı: ${count} cihazın süresi yaklaşıyor`
    case 'EXPIRED':
      return `🚨 ACİL: ${count} cihazın kalibrasyon süresi doldu`
    case 'REMINDER':
      return `🔔 Haftalık Hatırlatma: ${count} cihaz kalibrasyon bekliyor`
    default:
      return `Kalibrasyon Bildirimi: ${count} cihaz`
  }
}

/**
 * Generate batch email body
 */
function generateBatchEmailBody(
  type: CalibrationEmailType,
  devices: Array<{
    deviceId: string
    deviceName: string
    nextCalibrationDate: Date
    responsiblePerson: string
    responsiblePersonEmail?: string | null
    daysRemaining: number
  }>,
  rule: { type: string; days: number; repeatWeekly: boolean }
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
      header = `📅 Kalibrasyon Süresi Yaklaşan Cihazlar (${rule.days} gün kala)`
      urgency = 'Lütfen aşağıdaki cihazların kalibrasyonlarını zamanında yaptırınız.'
      break
    case 'EXPIRED':
      header = `🚨 Kalibrasyon Süresi Dolan Cihazlar (${rule.days} gün sonra)`
      urgency = '⚠️ UYARI: Kalibrasyonu geçmiş cihazlar kullanıma uygun değildir. ACİL işlem gereklidir!'
      break
    case 'REMINDER':
      header = `🔔 Haftalık Kalibrasyon Hatırlatması`
      urgency = 'Aşağıdaki cihazların kalibrasyonları hala beklemektedir.'
      break
    default:
      header = 'Kalibrasyon Bildirimi'
      urgency = ''
  }

  const deviceLines = devices
    .map((d, i) => {
      const daysText =
        d.daysRemaining > 0
          ? `${d.daysRemaining} gün kaldı`
          : d.daysRemaining === 0
            ? 'Bugün doluyor'
            : `${Math.abs(d.daysRemaining)} gün geçti`

      return `${i + 1}. ${d.deviceName} (${d.deviceId})
   📍 Sorumlu: ${d.responsiblePerson}
   📅 Kalibrasyon Tarihi: ${d.nextCalibrationDate.toLocaleDateString('tr-TR')}
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

Toplam: ${devices.length} cihaz

--
Bu e-posta otomatik olarak ILERIHub Kalibrasyon Yönetim Sistemi tarafından gönderilmiştir.
© 2025 İleri Group - System Development Team
  `.trim()
}

/**
 * GET /api/calibration/check-notifications
 * Manual trigger for testing - same as POST
 */
export async function GET() {
  return POST()
}
