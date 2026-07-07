// Mesai/Vardiya onay adımı ANINDA bildirimi: sıra bir sonraki onaycıya geçtiğinde
// (approve route adım geçişi) ve form ilk submit edildiğinde (ilk onaycı) gönderilir.
// Hatırlatma/eskalasyon mailleri check-overdue cron'da AYRI — bu şablon onlara karışmaz.
// Outlook-uyumlu <table> + navy başlık deseni (vardiya-service.ts / overtime-performance.ts).

import { escapeHtml } from '@/lib/email-templates/akademi/_base'

const NAVY = '#1B4F72'

export interface ApprovalPendingMailInput {
  formNo: string
  olusturan: string // oluşturan kullanıcı adı
  tarihStr: string // önceden tr-TR formatlanmış mesai/vardiya tarihi
  personelSayisi: number
  link: string // tam URL (https://hub.ilerigroup.com/forms/overtime/{id})
  isVardiya: boolean
  role?: string // bekleyen adımın ünvanı (opsiyonel bağlam)
}

/** Konu: "Onayınızı bekleyen mesai/vardiya formu: {formNo}" */
export function approvalPendingSubject(formNo: string, isVardiya: boolean): string {
  return `Onayınızı bekleyen ${isVardiya ? 'vardiya' : 'mesai'} formu: ${formNo}`
}

/** Plain-text fallback (sendEmail text parametresi). */
export function buildApprovalPendingMailText(input: ApprovalPendingMailInput): string {
  const tur = input.isVardiya ? 'vardiya' : 'mesai'
  return [
    `Onayınızı bekleyen ${tur} formu: ${input.formNo}`,
    '',
    `Form No: ${input.formNo}`,
    `Oluşturan: ${input.olusturan}`,
    `Tarih: ${input.tarihStr}`,
    `Personel sayısı: ${input.personelSayisi}`,
    ...(input.role ? [`Onay adımı: ${input.role}`] : []),
    '',
    `Formu görüntülemek için: ${input.link}`,
  ].join('\n')
}

export function buildApprovalPendingMailHtml(input: ApprovalPendingMailInput): string {
  const tur = input.isVardiya ? 'Vardiya' : 'Mesai'
  const formNo = escapeHtml(input.formNo)
  const olusturan = escapeHtml(input.olusturan)
  const tarih = escapeHtml(input.tarihStr)
  const role = input.role ? escapeHtml(input.role) : ''
  const link = escapeHtml(input.link)
  const satir = (label: string, val: string) =>
    `<tr><td style="padding:4px 0;color:#888;width:130px;">${label}</td><td style="padding:4px 0;color:#333;font-weight:600;">${val}</td></tr>`
  return `<!DOCTYPE html><html lang="tr"><body style="margin:0;background:#f4f6f8;font-family:Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;max-width:560px;overflow:hidden;">
      <tr><td style="background:${NAVY};padding:16px 24px;color:#fff;font-size:17px;font-weight:bold;">Onayınızı bekleyen ${tur.toLowerCase()} formu</td></tr>
      <tr><td style="padding:20px 24px;color:#333;font-size:14px;line-height:1.6;">
        <p style="margin:0 0 14px;"><b>${formNo}</b> numaralı ${tur.toLowerCase()} formu onay sırasında size ulaştı.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:13px;margin:0 0 18px;">
          ${satir('Form No', formNo)}
          ${satir('Oluşturan', olusturan)}
          ${satir('Tarih', tarih)}
          ${satir('Personel sayısı', String(input.personelSayisi))}
          ${role ? satir('Onay adımı', role) : ''}
        </table>
        <a href="${link}" style="display:inline-block;background:${NAVY};color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;">Formu Görüntüle</a>
      </td></tr>
      <tr><td style="padding:12px 24px;background:#f7f9fb;color:#999;font-size:11px;">Otomatik ILERIHub ${tur.toLowerCase()} onay bildirimi.</td></tr>
    </table>
  </td></tr></table></body></html>`
}

// ── Alıcı seçimi ───────────────────────────────────────────────────────────
export interface ApprovalNotifyRecipient {
  email: string
  name: string
}

/**
 * Onaycı kullanıcıdan mail alıcısı üret. Atanmamış pozisyon / email yoksa null
 * (gönderme yapılmaz). name yoksa email fallback.
 */
export function pickApprovalNotifyRecipient(
  approver: { email?: string | null; name?: string | null } | null | undefined
): ApprovalNotifyRecipient | null {
  const email = approver?.email?.trim()
  if (!email) return null
  return { email, name: approver?.name?.trim() || email }
}
