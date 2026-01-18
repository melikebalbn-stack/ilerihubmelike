import { CalibrationEmailType, TaskEmailType } from '@/generated/prisma'
import nodemailer from 'nodemailer'

export interface EmailRecipient {
  email: string
  name: string
}

export interface CalibrationEmailData {
  deviceId: string
  deviceName: string
  nextCalibrationDate: Date
  responsiblePerson: string
  daysRemaining?: number
}

/**
 * Email template generator for calibration notifications
 */
export function generateEmailContent(
  type: CalibrationEmailType,
  data: CalibrationEmailData
): { subject: string; body: string } {
  switch (type) {
    case 'EXPIRING_SOON':
      return {
        subject: `⚠️ Kalibrasyon Uyarısı: ${data.deviceName} (${data.deviceId})`,
        body: `
Sayın ${data.responsiblePerson},

Sorumlusu olduğunuz "${data.deviceName}" (${data.deviceId}) cihazının kalibrasyon süresi ${data.daysRemaining} gün içinde dolacaktır.

📅 Sonraki Kalibrasyon Tarihi: ${data.nextCalibrationDate.toLocaleDateString('tr-TR')}

Lütfen kalibrasyon işlemini zamanında yaptırınız.

--
Bu e-posta otomatik olarak ILERIHub Kalibrasyon Yönetim Sistemi tarafından gönderilmiştir.
© 2026 İleri Group - System Development Team
        `.trim(),
      }

    case 'EXPIRED':
      return {
        subject: `🚨 ACİL: Kalibrasyon Süresi Doldu - ${data.deviceName} (${data.deviceId})`,
        body: `
Sayın ${data.responsiblePerson},

Sorumlusu olduğunuz "${data.deviceName}" (${data.deviceId}) cihazının kalibrasyon süresi dolmuştur!

📅 Kalibrasyon Tarihi Geçti: ${data.nextCalibrationDate.toLocaleDateString('tr-TR')}
⏱️  Gecikme: ${Math.abs(data.daysRemaining || 0)} gün

⚠️ UYARI: Kalibrasyonu geçmiş cihazlar kullanıma uygun değildir.

Lütfen ACİL olarak kalibrasyon işlemini başlatınız.

--
Bu e-posta otomatik olarak ILERIHub Kalibrasyon Yönetim Sistemi tarafından gönderilmiştir.
© 2026 İleri Group - System Development Team
        `.trim(),
      }

    case 'REMINDER':
      return {
        subject: `🔔 Hatırlatma: Kalibrasyon Gerekli - ${data.deviceName} (${data.deviceId})`,
        body: `
Sayın ${data.responsiblePerson},

Bu e-posta bir hatırlatmadır.

"${data.deviceName}" (${data.deviceId}) cihazının kalibrasyonu hala beklemektedir.

📅 Kalibrasyon Tarihi: ${data.nextCalibrationDate.toLocaleDateString('tr-TR')}

Lütfen kalibrasyon işlemini başlatınız.

--
Bu e-posta otomatik olarak ILERIHub Kalibrasyon Yönetim Sistemi tarafından gönderilmiştir.
© 2026 İleri Group - System Development Team
        `.trim(),
      }

    case 'COMPLETED':
      return {
        subject: `✅ Kalibrasyon Tamamlandı - ${data.deviceName} (${data.deviceId})`,
        body: `
Sayın ${data.responsiblePerson},

"${data.deviceName}" (${data.deviceId}) cihazının kalibrasyonu tamamlanmıştır.

📅 Sonraki Kalibrasyon Tarihi: ${data.nextCalibrationDate.toLocaleDateString('tr-TR')}

Teşekkür ederiz.

--
Bu e-posta otomatik olarak ILERIHub Kalibrasyon Yönetim Sistemi tarafından gönderilmiştir.
© 2026 İleri Group - System Development Team
        `.trim(),
      }

    default:
      return {
        subject: 'Kalibrasyon Bildirimi',
        body: 'Bildirim içeriği',
      }
  }
}

// SMTP Transporter (Nodemailer)
let transporter: nodemailer.Transporter | null = null

function getTransporter() {
  if (!transporter) {
    // Check if SMTP is configured
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      console.warn('⚠️ SMTP not configured. Email will be simulated.')
      return null
    }

    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })
  }
  return transporter
}

/**
 * Email sending service with SMTP support
 * Falls back to simulation if SMTP is not configured
 */
export async function sendEmail(
  to: EmailRecipient[],
  subject: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  const smtp = getTransporter()

  // If SMTP is not configured, use simulation mode
  if (!smtp) {
    console.log('📧 [EMAIL SIMULATION] ========================')
    console.log('To:', to.map((r) => `${r.name} <${r.email}>`).join(', '))
    console.log('Subject:', subject)
    console.log('Body:')
    console.log(body)
    console.log('============================================')

    await new Promise((resolve) => setTimeout(resolve, 100))
    return { success: true }
  }

  // Real SMTP sending
  try {
    const toAddresses = to.map((r) => `${r.name} <${r.email}>`).join(', ')

    const info = await smtp.sendMail({
      from: process.env.SMTP_FROM || `ILERIHub <${process.env.SMTP_USER}>`,
      to: toAddresses,
      subject,
      text: body,
      html: body.replace(/\n/g, '<br>'),
    })

    console.log('✅ E-posta gönderildi:', info.messageId)
    return { success: true }
  } catch (error) {
    console.error('❌ E-posta gönderme hatası:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Send calibration notification emails
 */
export async function sendCalibrationNotification(
  type: CalibrationEmailType,
  data: CalibrationEmailData,
  recipients: EmailRecipient[]
): Promise<{ success: boolean; error?: string }> {
  const { subject, body } = generateEmailContent(type, data)
  return sendEmail(recipients, subject, body)
}

// ==========================================
// Planlı Görevler E-posta Sistemi
// ==========================================

export interface TaskEmailData {
  taskId: string
  taskTitle: string
  taskDescription?: string | null
  dueDate: Date
  responsiblePerson?: string | null
  responsibleDepartment?: string | null
  category?: string | null
  priority: string
  daysRemaining?: number
}

/**
 * Email template generator for task notifications
 */
export function generateTaskEmailContent(
  type: 'CREATED' | 'REMINDER' | 'OVERDUE' | 'COMPLETED',
  data: TaskEmailData
): { subject: string; body: string } {
  const priorityLabels: Record<string, string> = {
    LOW: 'Düşük',
    NORMAL: 'Normal',
    HIGH: 'Yüksek',
    CRITICAL: 'Kritik',
  }

  const priorityText = priorityLabels[data.priority] || data.priority

  // Görev linki oluştur
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'
  const taskUrl = `${baseUrl}/tasks?highlight=${data.taskId}`

  switch (type) {
    case 'CREATED':
      return {
        subject: `📋 Yeni Görev Oluşturuldu: ${data.taskTitle}`,
        body: `
Merhaba,

Yeni bir planlı görev oluşturulmuştur.

📋 Görev: ${data.taskTitle}
${data.taskDescription ? `📝 Açıklama: ${data.taskDescription}` : ''}
📅 Bitiş Tarihi: ${data.dueDate.toLocaleDateString('tr-TR')}
⚡ Öncelik: ${priorityText}
${data.category ? `🏷️ Kategori: ${data.category}` : ''}
${data.responsiblePerson ? `👤 Sorumlu Kişi: ${data.responsiblePerson}` : ''}
${data.responsibleDepartment ? `🏢 Sorumlu Departman: ${data.responsibleDepartment}` : ''}

🔗 Görevi Görüntüle: ${taskUrl}

Lütfen görevi takip ediniz.

--
Bu e-posta otomatik olarak ILERIHub Planlı Görevler Sistemi tarafından gönderilmiştir.
© 2026 İleri Group - System Development Team
        `.trim(),
      }

    case 'REMINDER':
      return {
        subject: `🔔 Görev Hatırlatması: ${data.taskTitle} (${data.daysRemaining} gün kaldı)`,
        body: `
Merhaba,

Aşağıdaki görevin bitiş tarihi yaklaşmaktadır.

📋 Görev: ${data.taskTitle}
${data.taskDescription ? `📝 Açıklama: ${data.taskDescription}` : ''}
📅 Bitiş Tarihi: ${data.dueDate.toLocaleDateString('tr-TR')}
⏱️ Kalan Süre: ${data.daysRemaining} gün
⚡ Öncelik: ${priorityText}
${data.responsiblePerson ? `👤 Sorumlu Kişi: ${data.responsiblePerson}` : ''}

🔗 Görevi Görüntüle: ${taskUrl}

Lütfen görevi tamamlamayı unutmayınız.

--
Bu e-posta otomatik olarak ILERIHub Planlı Görevler Sistemi tarafından gönderilmiştir.
© 2026 İleri Group - System Development Team
        `.trim(),
      }

    case 'OVERDUE':
      return {
        subject: `🚨 ACİL: Görev Gecikti - ${data.taskTitle}`,
        body: `
Merhaba,

Aşağıdaki görevin bitiş tarihi geçmiştir!

📋 Görev: ${data.taskTitle}
${data.taskDescription ? `📝 Açıklama: ${data.taskDescription}` : ''}
📅 Bitiş Tarihi: ${data.dueDate.toLocaleDateString('tr-TR')}
⏱️ Gecikme: ${Math.abs(data.daysRemaining || 0)} gün
⚡ Öncelik: ${priorityText}
${data.responsiblePerson ? `👤 Sorumlu Kişi: ${data.responsiblePerson}` : ''}

🔗 Görevi Görüntüle: ${taskUrl}

⚠️ UYARI: Bu görev acil olarak tamamlanmalıdır!

--
Bu e-posta otomatik olarak ILERIHub Planlı Görevler Sistemi tarafından gönderilmiştir.
© 2026 İleri Group - System Development Team
        `.trim(),
      }

    case 'COMPLETED':
      return {
        subject: `✅ Görev Tamamlandı: ${data.taskTitle}`,
        body: `
Merhaba,

Aşağıdaki görev başarıyla tamamlanmıştır.

📋 Görev: ${data.taskTitle}
${data.taskDescription ? `📝 Açıklama: ${data.taskDescription}` : ''}
📅 Tamamlanma Tarihi: ${new Date().toLocaleDateString('tr-TR')}
${data.responsiblePerson ? `👤 Tamamlayan: ${data.responsiblePerson}` : ''}

🔗 Görevi Görüntüle: ${taskUrl}

Teşekkür ederiz.

--
Bu e-posta otomatik olarak ILERIHub Planlı Görevler Sistemi tarafından gönderilmiştir.
© 2026 İleri Group - System Development Team
        `.trim(),
      }

    default:
      return {
        subject: 'Görev Bildirimi',
        body: 'Bildirim içeriği',
      }
  }
}

/**
 * Send task notification emails
 */
export async function sendTaskNotification(
  type: 'CREATED' | 'REMINDER' | 'OVERDUE' | 'COMPLETED',
  data: TaskEmailData,
  recipients: EmailRecipient[]
): Promise<{ success: boolean; error?: string }> {
  const { subject, body } = generateTaskEmailContent(type, data)
  return sendEmail(recipients, subject, body)
}

// ==========================================
// Eskalasyon E-posta Sistemi
// ==========================================

export interface EscalationEmailData {
  taskId: string
  taskTitle: string
  taskDescription?: string | null
  dueDate: Date
  responsiblePerson?: string | null
  responsiblePersonEmail?: string | null
  responsibleDepartment?: string | null
  category?: string | null
  priority: string
  daysOverdue: number
  managerName?: string | null
}

/**
 * Eskalasyon e-posta şablonları
 */
export function generateEscalationEmailContent(
  type: 'MANAGER' | 'EXECUTIVE',
  data: EscalationEmailData
): { subject: string; body: string } {
  const priorityLabels: Record<string, string> = {
    LOW: 'Düşük',
    NORMAL: 'Normal',
    HIGH: 'Yüksek',
    CRITICAL: 'Kritik',
  }

  const priorityText = priorityLabels[data.priority] || data.priority
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'
  const taskUrl = `${baseUrl}/tasks?highlight=${data.taskId}`

  switch (type) {
    case 'MANAGER':
      return {
        subject: `⚠️ ESKALASYON: Ekibinizde Gecikmiş Görev - ${data.taskTitle}`,
        body: `
Sayın Yönetici,

Ekibinizde aşağıdaki görev zamanında tamamlanamamıştır ve eskalasyon sürecine alınmıştır.

📋 Görev: ${data.taskTitle}
${data.taskDescription ? `📝 Açıklama: ${data.taskDescription}` : ''}
📅 Bitiş Tarihi: ${data.dueDate.toLocaleDateString('tr-TR')}
⏱️ Gecikme: ${data.daysOverdue} gün
⚡ Öncelik: ${priorityText}
${data.category ? `🏷️ Kategori: ${data.category}` : ''}
👤 Sorumlu Kişi: ${data.responsiblePerson || 'Belirtilmemiş'}
${data.responsiblePersonEmail ? `📧 E-posta: ${data.responsiblePersonEmail}` : ''}
${data.responsibleDepartment ? `🏢 Departman: ${data.responsibleDepartment}` : ''}

🔗 Görevi Görüntüle: ${taskUrl}

⚠️ Bu görev 5 gün içinde tamamlanmazsa üst yönetime bilgi verilecektir.

Lütfen ilgili personel ile iletişime geçerek görevin tamamlanmasını sağlayınız.

--
Bu e-posta otomatik olarak ILERIHub Eskalasyon Sistemi tarafından gönderilmiştir.
© 2026 İleri Group - System Development Team
        `.trim(),
      }

    case 'EXECUTIVE':
      return {
        subject: `🚨 KRİTİK ESKALASYON: 5 Günü Aşan Gecikmiş Görev - ${data.taskTitle}`,
        body: `
Sayın Üst Yönetim,

Aşağıdaki görev 5 günü aşan kritik bir gecikme durumundadır ve dikkatinize sunulmaktadır.

📋 Görev: ${data.taskTitle}
${data.taskDescription ? `📝 Açıklama: ${data.taskDescription}` : ''}
📅 Bitiş Tarihi: ${data.dueDate.toLocaleDateString('tr-TR')}
⏱️ Gecikme: ${data.daysOverdue} gün
⚡ Öncelik: ${priorityText}
${data.category ? `🏷️ Kategori: ${data.category}` : ''}

👤 Sorumlu Kişi: ${data.responsiblePerson || 'Belirtilmemiş'}
${data.responsiblePersonEmail ? `📧 E-posta: ${data.responsiblePersonEmail}` : ''}
${data.responsibleDepartment ? `🏢 Departman: ${data.responsibleDepartment}` : ''}
${data.managerName ? `👔 Yönetici: ${data.managerName}` : ''}

🔗 Görevi Görüntüle: ${taskUrl}

⚠️ Bu kritik gecikme operasyonel süreçleri etkileyebilir.

--
Bu e-posta otomatik olarak ILERIHub Eskalasyon Sistemi tarafından gönderilmiştir.
© 2026 İleri Group - System Development Team
        `.trim(),
      }

    default:
      return {
        subject: 'Eskalasyon Bildirimi',
        body: 'Bildirim içeriği',
      }
  }
}

/**
 * Send escalation notification emails
 */
export async function sendEscalationNotification(
  type: 'MANAGER' | 'EXECUTIVE',
  data: EscalationEmailData,
  recipients: EmailRecipient[]
): Promise<{ success: boolean; error?: string }> {
  const { subject, body } = generateEscalationEmailContent(type, data)
  return sendEmail(recipients, subject, body)
}
