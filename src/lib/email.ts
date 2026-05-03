import { CalibrationEmailType, TaskEmailType } from '@/generated/prisma'
import nodemailer from 'nodemailer'
import { generateVisitReportPDFBuffer, VisitReportForPDF } from '@/lib/pdf/visit-report-pdf-server'

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
  body: string,
  html?: string
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
      html: html ?? body.replace(/\n/g, '<br>'),
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

// ==========================================
// Ziyaret Raporu E-posta Sistemi
// ==========================================

export interface VisitReportParticipant {
  name: string
  title?: string
  company: 'ILERI_GROUP' | 'VISITED_COMPANY'
}

export interface VisitReportActionItem {
  description: string
  responsible?: string
  dueDate?: string
  status?: string
}

export interface VisitReportEmailData {
  reportNumber: string
  visitDate: string
  endDate?: string
  visitTime: string
  companyName: string
  visitType: string
  location?: string
  project?: string
  meetingSummary: string
  additionalNotes?: string
  nextSteps?: string
  ourPeople: VisitReportParticipant[]
  theirPeople: VisitReportParticipant[]
  actionItems: VisitReportActionItem[]
  createdByName: string
}

const visitTypeLabels: Record<string, string> = {
  CUSTOMER: 'Müşteri Ziyareti',
  SUPPLIER: 'Tedarikçi Ziyareti',
  FAIR: 'Fuar/Etkinlik',
  TECHNICAL: 'Teknik Görüşme',
  AUDIT: 'Denetim/Audit',
  TRAINING: 'Eğitim',
  OTHER: 'Diğer',
}

const actionStatusLabels: Record<string, string> = {
  PENDING: 'Bekliyor',
  IN_PROGRESS: 'Devam Ediyor',
  COMPLETED: 'Tamamlandı',
}

/**
 * Ziyaret raporu e-posta şablonu
 */
export function generateVisitReportEmailContent(
  data: VisitReportEmailData
): { subject: string; body: string; html: string } {
  const visitTypeText = visitTypeLabels[data.visitType] || data.visitType

  // Plain text version
  const body = `
ZİYARET RAPORU
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Rapor No: ${data.reportNumber}
🏢 Firma: ${data.companyName}
📅 Tarih: ${data.visitDate}${data.endDate ? ` - ${data.endDate}` : ''}
🕐 Saat: ${data.visitTime}
📍 Tür: ${visitTypeText}
${data.location ? `📌 Konum: ${data.location}` : ''}
${data.project ? `🎯 İlgili Proje: ${data.project}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KATILIMCILAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

İleri Group'tan:
${data.ourPeople.filter(p => p.name).map(p => `  • ${p.name}${p.title ? ` - ${p.title}` : ''}`).join('\n') || '  (Belirtilmemiş)'}

${data.companyName}'den:
${data.theirPeople.filter(p => p.name).map(p => `  • ${p.name}${p.title ? ` - ${p.title}` : ''}`).join('\n') || '  (Belirtilmemiş)'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GÖRÜŞME ÖZETİ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${data.meetingSummary}

${data.actionItems.filter(a => a.description).length > 0 ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AKSİYON MADDELERİ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${data.actionItems.filter(a => a.description).map((a, i) => `
${i + 1}. ${a.description}
   Sorumlu: ${a.responsible || 'Belirtilmemiş'}
   Tarih: ${a.dueDate || 'Belirtilmemiş'}
   Durum: ${actionStatusLabels[a.status || 'PENDING'] || a.status}
`).join('')}` : ''}

${data.additionalNotes ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EK NOTLAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${data.additionalNotes}
` : ''}

${data.nextSteps ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SONRAKİ ADIMLAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${data.nextSteps}
` : ''}

--
Bu rapor ${data.createdByName} tarafından oluşturulmuştur.
ILERIHub - Ziyaret Raporu Yönetim Sistemi
© 2026 İleri Group - System Development Team
  `.trim()

  // HTML version with better formatting
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
    .container { max-width: 700px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 30px; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 8px 0 0; opacity: 0.9; }
    .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-top: 10px; }
    .content { padding: 30px; }
    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 25px; }
    .info-box { background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #2563eb; }
    .info-box label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-box p { margin: 5px 0 0; font-weight: 600; color: #1e293b; }
    .section { margin-bottom: 25px; }
    .section h2 { font-size: 16px; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 15px; }
    .participants { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
    .participant-list { background: #f8fafc; padding: 15px; border-radius: 8px; }
    .participant-list h3 { font-size: 14px; margin: 0 0 10px; color: #475569; }
    .participant-list.our { border-left: 4px solid #22c55e; }
    .participant-list.their { border-left: 4px solid #f97316; }
    .participant { display: flex; align-items: center; margin-bottom: 8px; }
    .participant::before { content: '•'; margin-right: 8px; font-weight: bold; }
    .participant-list.our .participant::before { color: #22c55e; }
    .participant-list.their .participant::before { color: #f97316; }
    .summary-box { background: #f8fafc; padding: 20px; border-radius: 8px; white-space: pre-wrap; line-height: 1.6; }
    .action-item { background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 10px; display: flex; gap: 15px; }
    .action-number { width: 30px; height: 30px; background: #8b5cf6; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; }
    .action-content { flex: 1; }
    .action-meta { display: flex; gap: 15px; margin-top: 8px; font-size: 12px; color: #64748b; }
    .action-status { background: #e2e8f0; padding: 2px 8px; border-radius: 10px; }
    .next-steps { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); padding: 20px; border-radius: 8px; border-left: 4px solid #2563eb; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Ziyaret Raporu</h1>
      <p>${data.companyName}</p>
      <span class="badge">${visitTypeText}</span>
    </div>

    <div class="content">
      <div class="info-grid">
        <div class="info-box">
          <label>Rapor No</label>
          <p>${data.reportNumber}</p>
        </div>
        <div class="info-box">
          <label>Tarih</label>
          <p>${data.visitDate}${data.endDate ? ` - ${data.endDate}` : ''}</p>
        </div>
        <div class="info-box">
          <label>Saat</label>
          <p>${data.visitTime}</p>
        </div>
        ${data.location ? `
        <div class="info-box">
          <label>Konum</label>
          <p>${data.location}</p>
        </div>
        ` : ''}
      </div>

      ${data.project ? `
      <div class="section">
        <div class="info-box" style="border-left-color: #8b5cf6;">
          <label>İlgili Proje</label>
          <p>${data.project}</p>
        </div>
      </div>
      ` : ''}

      <div class="section">
        <h2>👥 Katılımcılar</h2>
        <div class="participants">
          <div class="participant-list our">
            <h3>İleri Group</h3>
            ${data.ourPeople.filter(p => p.name).map(p => `
            <div class="participant">
              <strong>${p.name}</strong>${p.title ? ` - ${p.title}` : ''}
            </div>
            `).join('') || '<p style="color:#94a3b8;">Belirtilmemiş</p>'}
          </div>
          <div class="participant-list their">
            <h3>Görüşülen Firma</h3>
            ${data.theirPeople.filter(p => p.name).map(p => `
            <div class="participant">
              <strong>${p.name}</strong>${p.title ? ` - ${p.title}` : ''}
            </div>
            `).join('') || '<p style="color:#94a3b8;">Belirtilmemiş</p>'}
          </div>
        </div>
      </div>

      <div class="section">
        <h2>📝 Görüşme Özeti</h2>
        <div class="summary-box">${data.meetingSummary}</div>
      </div>

      ${data.actionItems.filter(a => a.description).length > 0 ? `
      <div class="section">
        <h2>✅ Aksiyon Maddeleri</h2>
        ${data.actionItems.filter(a => a.description).map((a, i) => `
        <div class="action-item">
          <div class="action-number">${i + 1}</div>
          <div class="action-content">
            <strong>${a.description}</strong>
            <div class="action-meta">
              ${a.responsible ? `<span>👤 ${a.responsible}</span>` : ''}
              ${a.dueDate ? `<span>📅 ${a.dueDate}</span>` : ''}
              <span class="action-status">${actionStatusLabels[a.status || 'PENDING'] || a.status}</span>
            </div>
          </div>
        </div>
        `).join('')}
      </div>
      ` : ''}

      ${data.additionalNotes ? `
      <div class="section">
        <h2>📌 Ek Notlar</h2>
        <div class="summary-box">${data.additionalNotes}</div>
      </div>
      ` : ''}

      ${data.nextSteps ? `
      <div class="section">
        <h2>🚀 Sonraki Adımlar</h2>
        <div class="next-steps">${data.nextSteps}</div>
      </div>
      ` : ''}
    </div>

    <div class="footer">
      Bu rapor <strong>${data.createdByName}</strong> tarafından oluşturulmuştur.<br>
      ILERIHub - Ziyaret Raporu Yönetim Sistemi<br>
      © 2026 İleri Group - System Development Team
    </div>
  </div>
</body>
</html>
  `.trim()

  return {
    subject: `📋 Ziyaret Raporu: ${data.companyName} (${data.reportNumber})`,
    body,
    html,
  }
}

/**
 * Send visit report email with PDF attachment
 */
export async function sendVisitReportEmail(
  data: VisitReportEmailData,
  recipients: EmailRecipient[],
  reportForPDF?: VisitReportForPDF
): Promise<{ success: boolean; error?: string }> {
  const { subject, body } = generateVisitReportEmailContent(data)

  const smtp = getTransporter()

  // Generate PDF if report data is provided
  let pdfBuffer: Buffer | null = null
  if (reportForPDF) {
    try {
      pdfBuffer = generateVisitReportPDFBuffer(reportForPDF)
      console.log(`📄 PDF oluşturuldu: ${data.reportNumber} (${pdfBuffer.length} bytes)`)
    } catch (pdfError) {
      console.error('⚠️ PDF oluşturulamadı, e-posta eksiz gönderilecek:', pdfError)
    }
  }

  // If SMTP is not configured, use simulation mode
  if (!smtp) {
    console.log('📧 [VISIT REPORT EMAIL SIMULATION] ========================')
    console.log('To:', recipients.map((r) => `${r.name} <${r.email}>`).join(', '))
    console.log('Subject:', subject)
    console.log('PDF Attachment:', pdfBuffer ? `${data.reportNumber}.pdf (${pdfBuffer.length} bytes)` : 'None')
    console.log('Body (text):')
    console.log(body)
    console.log('============================================')

    await new Promise((resolve) => setTimeout(resolve, 100))
    return { success: true }
  }

  // Real SMTP sending with PDF attachment
  try {
    const toAddresses = recipients.map((r) => `${r.name} <${r.email}>`).join(', ')

    const mailOptions: nodemailer.SendMailOptions = {
      from: process.env.SMTP_FROM || `ILERIHub <${process.env.SMTP_USER}>`,
      to: toAddresses,
      subject,
      text: body,
    }

    // Add PDF attachment if available
    if (pdfBuffer) {
      mailOptions.attachments = [
        {
          filename: `${data.reportNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ]
    }

    const info = await smtp.sendMail(mailOptions)

    console.log('✅ Ziyaret raporu e-postası gönderildi:', info.messageId, pdfBuffer ? '(PDF ekli)' : '(eksiz)')
    return { success: true }
  } catch (error) {
    console.error('❌ Ziyaret raporu e-posta gönderme hatası:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
