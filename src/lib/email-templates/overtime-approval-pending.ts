// Mesai/Vardiya onay adımı ANINDA bildirimi: sıra bir sonraki onaycıya geçtiğinde
// (approve route adım geçişi) ve form ilk submit edildiğinde (ilk onaycı) gönderilir.
// Hatırlatma/eskalasyon mailleri check-overdue cron'da AYRI — bu şablon onlara karışmaz.
// Kurumsal yerleşim: email-templates/layout.ts (üst şerit "Mesai").

import { escapeHtml } from '@/lib/email-templates/akademi/_base'
import { renderEmailHtml, p } from '@/lib/email-templates/layout'

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
  const tur = input.isVardiya ? 'vardiya' : 'mesai'
  return renderEmailHtml({
    module: 'Mesai',
    title: `Onayınızı bekleyen ${tur} formu`,
    subtitle: `${input.formNo} · ${input.tarihStr}`,
    preheader: `${input.formNo} numaralı ${tur} formu onay sırasında size ulaştı`,
    bodyHtml: p(
      `<strong>${escapeHtml(input.formNo)}</strong> numaralı ${tur} formu onay sırasında size ulaştı.`,
    ),
    infoRows: [
      { label: 'Form No', value: `<strong>${escapeHtml(input.formNo)}</strong>` },
      { label: 'Oluşturan', value: escapeHtml(input.olusturan) },
      { label: 'Tarih', value: escapeHtml(input.tarihStr) },
      { label: 'Personel sayısı', value: String(input.personelSayisi) },
      ...(input.role ? [{ label: 'Onay adımı', value: escapeHtml(input.role) }] : []),
    ],
    cta: { label: 'Formu Görüntüle', url: input.link },
  })
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
