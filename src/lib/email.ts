import { CalibrationEmailType, TaskEmailType } from '@/generated/prisma'
import nodemailer from 'nodemailer'
import { generateVisitReportPDFBuffer, VisitReportForPDF } from '@/lib/pdf/visit-report-pdf-server'

export interface EmailRecipient {
  email: string
  name: string
}

// Inline (CID) veya dosya eki. CID gömme için { path|content, cid } verilir.
export interface EmailAttachment {
  filename: string
  path?: string
  content?: Buffer | string
  cid?: string
  contentType?: string
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
  html?: string,
  attachments?: EmailAttachment[]
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
      ...(attachments && attachments.length ? { attachments } : {}),
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

// ==========================================
// IT Ticket Bildirim E-posta Sistemi (PR-TKT-NTF-1A)
// ==========================================

/**
 * Yeni IT ticket'ı oluşturulduğunda IT ekibine gönderilecek mail içeriği.
 * @param ticket Ticket bilgileri (POST handler'dan gelen prisma.ticket.create sonucu)
 * @param recipientName Mail'in gideceği kişinin adı (kişiselleştirme için)
 */
export function generateTicketCreatedEmailContent(
  ticket: {
    id: string
    ticketNumber: string
    subject: string
    description: string
    priority: string // LOW | MEDIUM | HIGH | CRITICAL (TicketPriority enum)
    category: string // kategori adı
    requesterName: string
    requesterDept: string
    createdAt: Date
  },
  recipientName: string,
): { subject: string; body: string; html: string } {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hub.ilerigroup.com'
  const ticketUrl = `${appUrl}/it-support?ticket=${ticket.ticketNumber}`
  const isCritical = ticket.priority === 'CRITICAL' || ticket.priority === 'TICKET_CRITICAL'

  const priorityLabel: Record<string, string> = {
    LOW: 'Düşük',
    MEDIUM: 'Orta',
    NORMAL: 'Normal',
    HIGH: 'Yüksek',
    CRITICAL: 'Acil',
    TICKET_LOW: 'Düşük',
    TICKET_HIGH: 'Yüksek',
    TICKET_CRITICAL: 'Acil',
  }

  // HTML escape — XSS koruma
  const esc = (s: string): string =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')

  const subject = `${isCritical ? '🔴 ACİL — ' : ''}[ILERIHub] Yeni IT Talebi: ${ticket.ticketNumber}`

  const body = `Merhaba ${recipientName},

Yeni bir IT destek talebi açıldı.

Talep No   : ${ticket.ticketNumber}
Başlık     : ${ticket.subject}
Açan       : ${ticket.requesterName} (${ticket.requesterDept})
Kategori   : ${ticket.category}
Öncelik    : ${priorityLabel[ticket.priority] || ticket.priority}
Açılış     : ${new Date(ticket.createdAt).toLocaleString('tr-TR')}

Açıklama:
${ticket.description}

Talebi görüntülemek için: ${ticketUrl}

—
ILERIHub Bildirim Sistemi`

  const headerBg = isCritical ? '#fee2e2' : '#dbeafe'
  const headerBorder = isCritical ? '#fca5a5' : '#93c5fd'
  const headerText = isCritical ? '#991b1b' : '#1e40af'
  const labelText = isCritical ? '🔴 ACİL — YENİ IT TALEBİ' : 'YENİ IT TALEBİ'

  const html = `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#0f172a;">
  <div style="max-width:600px;margin:24px auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:${headerBg};padding:20px 24px;border-bottom:1px solid ${headerBorder};">
      <div style="font-size:11px;color:${headerText};text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;font-weight:600;">${labelText}</div>
      <div style="font-size:18px;font-weight:600;color:#0f172a;">${esc(ticket.ticketNumber)} — ${esc(ticket.subject)}</div>
    </div>
    <div style="padding:24px;">
      <div style="margin-bottom:18px;color:#475569;font-size:14px;">Merhaba ${esc(recipientName)},<br>Yeni bir IT destek talebi açıldı. Detaylar aşağıdadır.</div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">
        <tr><td style="padding:6px 0;color:#64748b;width:120px;">Açan</td><td style="padding:6px 0;color:#0f172a;font-weight:500;">${esc(ticket.requesterName)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Departman</td><td style="padding:6px 0;color:#0f172a;">${esc(ticket.requesterDept)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Kategori</td><td style="padding:6px 0;color:#0f172a;">${esc(ticket.category)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Öncelik</td><td style="padding:6px 0;color:#0f172a;font-weight:${isCritical ? '600' : '400'};">${priorityLabel[ticket.priority] || ticket.priority}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Açılış</td><td style="padding:6px 0;color:#0f172a;">${new Date(ticket.createdAt).toLocaleString('tr-TR')}</td></tr>
      </table>
      <div style="padding:14px 16px;background:#f8fafc;border-left:3px solid #cbd5e1;border-radius:4px;font-size:14px;color:#334155;white-space:pre-wrap;line-height:1.5;">${esc(ticket.description)}</div>
      <div style="text-align:center;margin-top:24px;">
        <a href="${ticketUrl}" style="display:inline-block;background:#3b82f6;color:#ffffff;padding:11px 28px;border-radius:6px;text-decoration:none;font-weight:500;font-size:14px;">Talebi Görüntüle</a>
      </div>
    </div>
    <div style="background:#f8fafc;padding:14px 24px;text-align:center;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0;">
      ILERIHub Bildirim Sistemi · İleri Group
    </div>
  </div>
</body>
</html>`

  return { subject, body, html }
}

// ════════════════════════════════════════════════════════════
// PERFORMANS DEĞERLENDİRME EMAIL TEMPLATELERI (PR-HR-NOTIF)
// ════════════════════════════════════════════════════════════

type CycleSummary = {
  id: string
  name: string
  year: number
  yearEndReviewEnd: Date | null
}

type ReviewSummary = {
  id: string
  cycleId: string
  cycleName: string
  employeeName: string
  employeeEmail: string
  deadline: Date
}

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
}

/**
 * CYCLE_LAUNCH — Yeni performans değerlendirme cycle'ı IN_PROGRESS'e geçti.
 * Recipient: employee + manager + İK ekibi.
 */
export function generateReviewCycleLaunchEmail(
  cycle: CycleSummary,
  recipientName: string,
): { subject: string; body: string; html: string } {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hub.ilerigroup.com'
  const url = `${appUrl}/strategic-hr/performance?cycle=${cycle.id}`
  const deadlineStr = cycle.yearEndReviewEnd ? fmtDate(cycle.yearEndReviewEnd) : 'belirlenmedi'
  const subject = `Performans Değerlendirme Dönemi Başladı: ${cycle.name}`

  const body = `Sayın ${recipientName},

${cycle.year} performans değerlendirme dönemi (${cycle.name}) başlatıldı.
Son tamamlanma tarihi: ${deadlineStr}

ILERIHub > Stratejik İK > Performans sayfasından değerlendirmenizi başlatabilirsiniz:
${url}

İleri Group İnsan Varlıkları`

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f9fafb;">
<table cellpadding="0" cellspacing="0" border="0" width="500" align="center" style="background:#fff;border:2px solid #1e40af;margin:20px auto;">
<tr><td style="padding:14px 18px;border-bottom:1px solid #e5e7eb;">
<span style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">İLERİ GROUP</span><br>
<span style="font-size:17px;font-weight:bold;color:#1e40af;">Performans Değerlendirme Başladı</span>
</td></tr>
<tr><td style="padding:18px;color:#374151;font-size:14px;line-height:22px;">
Sayın <b>${escapeHTML(recipientName)}</b>,<br><br>
<b>${escapeHTML(cycle.name)}</b> dönemi başlatıldı.<br>
Son tamamlanma tarihi: <b>${escapeHTML(deadlineStr)}</b><br><br>
Değerlendirmenizi sayfa üzerinden tamamlayabilirsiniz.
</td></tr>
<tr><td style="padding:12px 18px;border-top:1px solid #e5e7eb;">
<a href="${url}" style="display:inline-block;background:#1e40af;color:#fff;padding:9px 18px;text-decoration:none;font-size:13px;font-weight:bold;">Değerlendirmeyi Aç</a>
</td></tr>
<tr><td style="padding:10px 18px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;">İnsan Varlıkları Departmanı · ILERIHub Bildirim Sistemi</td></tr>
</table>
</body></html>`

  return { subject, body, html }
}

/**
 * DEADLINE_7 / DEADLINE_0 — Review tamamlanmamış, hatırlatma.
 * daysRemaining: 7 veya 0 (son gün).
 * Recipient: employee + manager (review status'a göre).
 */
export function generateReviewReminderEmail(
  review: ReviewSummary,
  daysRemaining: number,
  recipientName: string,
): { subject: string; body: string; html: string } {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hub.ilerigroup.com'
  const url = `${appUrl}/strategic-hr/performance?cycle=${review.cycleId}`
  const deadlineStr = fmtDate(review.deadline)
  const urgent = daysRemaining === 0
  const subject = urgent
    ? `SON GÜN: Performans Değerlendirme Tamamlanmalı (${review.cycleName})`
    : `Hatırlatma: ${daysRemaining} gün içinde performans değerlendirme tamamlanmalı`

  const body = `Sayın ${recipientName},

${review.cycleName} dönemindeki performans değerlendirmesi henüz tamamlanmadı.
Son tarih: ${deadlineStr}${urgent ? ' (BUGÜN)' : ` (${daysRemaining} gün kaldı)`}

ILERIHub > Stratejik İK > Performans sayfasından tamamlayabilirsiniz:
${url}

İleri Group İnsan Varlıkları`

  const borderColor = urgent ? '#dc2626' : '#f59e0b'
  const labelText = urgent ? 'SON GÜN UYARISI' : 'HATIRLATMA'
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f9fafb;">
<table cellpadding="0" cellspacing="0" border="0" width="500" align="center" style="background:#fff;border:2px solid ${borderColor};margin:20px auto;">
<tr><td style="padding:14px 18px;border-bottom:1px solid #e5e7eb;">
<span style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">İLERİ GROUP</span><br>
<span style="font-size:17px;font-weight:bold;color:${borderColor};">${labelText}</span>
</td></tr>
<tr><td style="padding:18px;color:#374151;font-size:14px;line-height:22px;">
Sayın <b>${escapeHTML(recipientName)}</b>,<br><br>
<b>${escapeHTML(review.cycleName)}</b> dönemi performans değerlendirmeniz henüz tamamlanmadı.<br>
Son tarih: <b>${escapeHTML(deadlineStr)}</b>${urgent ? ' (<b>BUGÜN</b>)' : ` (${daysRemaining} gün kaldı)`}
</td></tr>
<tr><td style="padding:12px 18px;border-top:1px solid #e5e7eb;">
<a href="${url}" style="display:inline-block;background:${borderColor};color:#fff;padding:9px 18px;text-decoration:none;font-size:13px;font-weight:bold;">Değerlendirmeyi Tamamla</a>
</td></tr>
<tr><td style="padding:10px 18px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;">İnsan Varlıkları Departmanı · ILERIHub Bildirim Sistemi</td></tr>
</table>
</body></html>`

  return { subject, body, html }
}

/**
 * OVERDUE — Review deadline geçti, hala tamamlanmadı.
 * Recipient: manager + İK escalation (employee ana sorumlu ama manager+İK takip eder).
 */
export function generateReviewOverdueEmail(
  review: ReviewSummary,
  daysOverdue: number,
  recipientName: string,
): { subject: string; body: string; html: string } {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hub.ilerigroup.com'
  const url = `${appUrl}/strategic-hr/performance?cycle=${review.cycleId}`
  const deadlineStr = fmtDate(review.deadline)
  const subject = `GECİKMİŞ: ${review.employeeName} performans değerlendirme (${daysOverdue} gün geçti)`

  const body = `Sayın ${recipientName},

${review.employeeName} (${review.employeeEmail}) için ${review.cycleName} dönemi
performans değerlendirmesi ${daysOverdue} gündür gecikmiş durumda.

Son tarih (geçti): ${deadlineStr}

Acil tamamlanması için ilgililerle iletişime geçilmesi gerekiyor.
${url}

İleri Group İnsan Varlıkları`

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f9fafb;">
<table cellpadding="0" cellspacing="0" border="0" width="500" align="center" style="background:#fff;border:2px solid #991b1b;margin:20px auto;">
<tr><td style="padding:14px 18px;border-bottom:1px solid #e5e7eb;background:#fef2f2;">
<span style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">İLERİ GROUP · ESCALATION</span><br>
<span style="font-size:17px;font-weight:bold;color:#991b1b;">GECİKMİŞ DEĞERLENDİRME</span>
</td></tr>
<tr><td style="padding:18px;color:#374151;font-size:14px;line-height:22px;">
Sayın <b>${escapeHTML(recipientName)}</b>,<br><br>
<b>${escapeHTML(review.employeeName)}</b> için <b>${escapeHTML(review.cycleName)}</b> dönemi
performans değerlendirmesi <b>${daysOverdue} gündür gecikmiş</b> durumda.<br><br>
Son tarih (geçti): <b>${escapeHTML(deadlineStr)}</b>
</td></tr>
<tr><td style="padding:12px 18px;border-top:1px solid #e5e7eb;">
<a href="${url}" style="display:inline-block;background:#991b1b;color:#fff;padding:9px 18px;text-decoration:none;font-size:13px;font-weight:bold;">Aksiyon Al</a>
</td></tr>
<tr><td style="padding:10px 18px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;">İnsan Varlıkları Departmanı · ILERIHub Bildirim Sistemi</td></tr>
</table>
</body></html>`

  return { subject, body, html }
}

// ════════════════════════════════════════════════════════════
// ACME CERT EXPIRE ALERT (PR-ACME-MONITOR)
// ════════════════════════════════════════════════════════════

export type AcmeAlertData = {
  domain: string
  daysRemaining: number
  threshold: number
  validTo: Date
  issuer: string
}

/**
 * ACME cert expire alert email gönderir.
 * Severity threshold'a göre konu + renk.
 */
export async function sendAcmeAlert(
  data: AcmeAlertData,
  recipients: EmailRecipient[],
): Promise<{ success: boolean; error?: string }> {
  if (recipients.length === 0) {
    return { success: false, error: 'No recipients' }
  }

  const { domain, daysRemaining, threshold, validTo, issuer } = data

  const expired = daysRemaining < 0
  const critical = daysRemaining <= 1
  const warning = daysRemaining <= 7

  const severity = expired
    ? { tag: 'SÜRESİ DOLDU', color: '#000000', bg: '#fef2f2' }
    : critical
      ? { tag: 'KRİTİK', color: '#991b1b', bg: '#fef2f2' }
      : warning
        ? { tag: 'UYARI', color: '#c2410c', bg: '#fff7ed' }
        : { tag: 'BİLGİ', color: '#1d4ed8', bg: '#eff6ff' }

  const subject = expired
    ? `[ACME] ${domain} sertifikası SÜRESİ DOLDU (${Math.abs(daysRemaining)} gün önce)`
    : `[ACME] ${domain} sertifikası ${daysRemaining} gün içinde sona eriyor (eşik: ${threshold} gün)`

  const dateStr = validTo.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  })

  const body = `ACME Sertifika Uyarısı

Domain     : ${domain}
Issuer     : ${issuer}
Bitiş      : ${dateStr}
Kalan gün  : ${daysRemaining < 0 ? `${Math.abs(daysRemaining)} gün GEÇTİ` : `${daysRemaining} gün`}
Eşik       : ${threshold} gün

Acme.sh otomatik yenileme cron'da çalışıyor (günde 1 kez, 15:21 UTC).
Eğer yenileme başarısız olursa /home/rokunet/.acme.sh/acme.sh.log incelenmeli.

— ILERIHub ACME Monitor`

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f9fafb;">
<table cellpadding="0" cellspacing="0" border="0" width="500" align="center" style="background:#fff;border:2px solid ${severity.color};margin:20px auto;">
<tr><td style="padding:14px 18px;border-bottom:1px solid #e5e7eb;background:${severity.bg};">
<span style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">ILERIHUB · ACME MONITOR</span><br>
<span style="font-size:17px;font-weight:bold;color:${severity.color};">${severity.tag}</span>
</td></tr>
<tr><td style="padding:18px;color:#374151;font-size:14px;line-height:22px;">
<table cellpadding="4" cellspacing="0" border="0">
<tr><td style="color:#6b7280;width:90px;">Domain:</td><td><b>${domain}</b></td></tr>
<tr><td style="color:#6b7280;">Issuer:</td><td>${issuer}</td></tr>
<tr><td style="color:#6b7280;">Bitiş:</td><td>${dateStr}</td></tr>
<tr><td style="color:#6b7280;">Kalan:</td><td><b style="color:${severity.color};">${daysRemaining < 0 ? `${Math.abs(daysRemaining)} gün geçti` : `${daysRemaining} gün`}</b></td></tr>
<tr><td style="color:#6b7280;">Eşik:</td><td>${threshold} gün</td></tr>
</table>
</td></tr>
<tr><td style="padding:12px 18px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">
Acme.sh otomatik yenileme cron'da çalışıyor (15:21 UTC). Yenileme başarısız olursa
<code style="background:#f3f4f6;padding:2px 4px;font-size:11px;">/home/rokunet/.acme.sh/acme.sh.log</code> incelenmeli.
</td></tr>
<tr><td style="padding:10px 18px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;">ILERIHub ACME Monitor</td></tr>
</table>
</body></html>`

  try {
    const result = await sendEmail(recipients, subject, body, html)
    return result
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ═══════════════════════════════════════════════════════════════════
// KALITE — Ölçüm Raporu mail gönderimi (KALITE-8)
// ═══════════════════════════════════════════════════════════════════

export interface MeasurementReportEmailData {
  reportNo: string
  partName: string
  drawingNo: string
  revision: string
  lotNo: string | null
  result: 'PENDING' | 'OK' | 'RED'
  finalizedAt: Date
  verifyUrl?: string | null
  /** Operatörün serbest girdiği opsiyonel açıklama */
  note?: string | null
}

function resultLabel(r: 'PENDING' | 'OK' | 'RED'): string {
  return r === 'OK' ? 'OK' : r === 'RED' ? 'RED' : 'Bekliyor'
}

function fmtTr(d: Date): string {
  return new Date(d).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })
}

export function generateMeasurementReportEmailContent(
  data: MeasurementReportEmailData,
): { subject: string; body: string; html: string } {
  const subject = `📋 Ölçüm Raporu: ${data.partName} ${data.drawingNo}-${data.revision} (${data.reportNo}) — ${resultLabel(data.result)}`

  const lines: string[] = [
    `Ölçüm Raporu — ${data.reportNo}`,
    '',
    `Parça        : ${data.partName}`,
    `Resim / Rev. : ${data.drawingNo}-${data.revision}`,
    `Lot No       : ${data.lotNo ?? '—'}`,
    `Sonuç        : ${resultLabel(data.result)}`,
    `Finalize     : ${fmtTr(data.finalizedAt)}`,
  ]
  if (data.note && data.note.trim()) {
    lines.push('', 'Not:', data.note.trim())
  }
  if (data.verifyUrl) {
    lines.push('', `Doğrulama: ${data.verifyUrl}`)
  }
  lines.push('', 'PDF raporu ek olarak iletilmiştir.')

  const body = lines.join('\n')

  const tone = data.result === 'OK' ? '#047857' : data.result === 'RED' ? '#B91C1C' : '#64748B'
  const html = `<!DOCTYPE html>
<html lang="tr"><body style="font-family: Inter, system-ui, sans-serif; color: #1E293B; line-height: 1.6;">
  <div style="max-width: 560px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #1B4F72; margin: 0 0 16px;">Ölçüm Raporu — ${data.reportNo}</h2>
    <table style="border-collapse: collapse; font-size: 13px;">
      <tr><td style="padding:4px 12px 4px 0; color:#64748B;">Parça</td><td><strong>${data.partName}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#64748B;">Resim / Rev.</td><td style="font-family: ui-monospace, monospace;">${data.drawingNo}-${data.revision}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#64748B;">Lot No</td><td style="font-family: ui-monospace, monospace;">${data.lotNo ?? '—'}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#64748B;">Sonuç</td><td><strong style="color:${tone};">${resultLabel(data.result)}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#64748B;">Finalize</td><td>${fmtTr(data.finalizedAt)}</td></tr>
    </table>
    ${
      data.note && data.note.trim()
        ? `<div style="margin-top:16px; padding:12px; background:#F8FAFC; border-left:3px solid #1B4F72;"><strong style="display:block;color:#1B4F72;font-size:11px;text-transform:uppercase;margin-bottom:4px;">Not</strong>${escapeHtml(data.note.trim()).replace(/\n/g, '<br>')}</div>`
        : ''
    }
    ${
      data.verifyUrl
        ? `<p style="margin-top:16px; font-size:12px; color:#64748B;">Doğrulama: <a href="${data.verifyUrl}" style="color:#1B4F72;">${data.verifyUrl}</a></p>`
        : ''
    }
    <p style="margin-top:16px; font-size:12px; color:#64748B;">PDF raporu ek olarak iletilmiştir.</p>
  </div>
</body></html>`

  return { subject, body, html }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Ölçüm raporunu PDF eki ile gönderir. SMTP_HOST yoksa simulation mode'a düşer
 * (sendVisitReportEmail pattern paralel).
 */
export async function sendMeasurementReportEmail(
  data: MeasurementReportEmailData,
  recipients: EmailRecipient[],
  pdfBuffer?: Buffer,
): Promise<{ success: boolean; error?: string }> {
  const { subject, body, html } = generateMeasurementReportEmailContent(data)
  const smtp = getTransporter()

  if (!smtp) {
    console.log('📧 [MEASUREMENT REPORT EMAIL SIMULATION] ========================')
    console.log('To:', recipients.map((r) => `${r.name} <${r.email}>`).join(', '))
    console.log('Subject:', subject)
    console.log('PDF Attachment:', pdfBuffer ? `${data.reportNo}.pdf (${pdfBuffer.length} bytes)` : 'None')
    console.log('Body (text):')
    console.log(body)
    console.log('============================================')
    await new Promise((resolve) => setTimeout(resolve, 100))
    return { success: true }
  }

  try {
    const toAddresses = recipients.map((r) => `${r.name} <${r.email}>`).join(', ')
    const mailOptions: nodemailer.SendMailOptions = {
      from: process.env.SMTP_FROM || `ILERIHub <${process.env.SMTP_USER}>`,
      to: toAddresses,
      subject,
      text: body,
      html,
    }
    if (pdfBuffer) {
      mailOptions.attachments = [
        {
          filename: `${data.reportNo.replace(/[/\\?%*:|"<>]/g, '-')}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ]
    }
    const info = await smtp.sendMail(mailOptions)
    console.log(
      '✅ Ölçüm raporu e-postası gönderildi:',
      info.messageId,
      pdfBuffer ? '(PDF ekli)' : '(eksiz)',
    )
    return { success: true }
  } catch (error) {
    console.error('❌ Ölçüm raporu e-posta gönderme hatası:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
