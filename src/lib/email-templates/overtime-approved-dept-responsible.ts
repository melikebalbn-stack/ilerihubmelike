// Mesai formu SON onayı (İK final, status=APPROVED) sonrası, formdaki personellerin
// birim sorumlularına gönderilen bilgi maili. Her sorumlu YALNIZ kendi sorumlu olduğu
// bölüm(ler)in personelini görür. Navy başlık + Outlook-uyumlu <table> deseni
// (vardiya-service.ts / overtime-performance.ts referansı). Yalnız MESAI formları için.
import { escapeHtml, ileriHubUrl } from '@/lib/email-templates/akademi/_base'

const NAVY = '#1B4F72'

export type DeptGroup = { name: string; personel: string[] }
export type ApprovedDeptResponsibleInput = {
  formNo: string
  turAdi: 'mesai' | 'vardiya' // başlık + konu kelimesi (MESAI/VARDIYA)
  tarihLabel: string // "Mesai tarihi" | "Vardiya tarihi" | "Vardiya haftası"
  tarihStr: string // önceden formatlanmış tarih/hafta metni
  departments: DeptGroup[] // yalnız bu sorumlunun bölüm(ler)i
  link: string // tam URL
}

/** Konu: "Onaylanan {mesai|vardiya} formu: {formNo}" */
export function approvedDeptResponsibleSubject(formNo: string, isVardiya: boolean): string {
  return `Onaylanan ${isVardiya ? 'vardiya' : 'mesai'} formu: ${formNo}`
}

export function buildApprovedDeptResponsibleMailText(input: ApprovedDeptResponsibleInput): string {
  const lines = [
    `Onaylanan ${input.turAdi} formu: ${input.formNo}`,
    `${input.tarihLabel}: ${input.tarihStr}`,
    '',
    `Aşağıdaki bölüm(ler)inizdeki personel için ${input.turAdi} formu onaylandı:`,
  ]
  for (const d of input.departments) {
    lines.push('', `${d.name} (${d.personel.length} personel):`)
    for (const p of d.personel) lines.push(`  - ${p}`)
  }
  lines.push('', `Formu görüntüle: ${input.link}`)
  return lines.join('\n')
}

export function buildApprovedDeptResponsibleMailHtml(input: ApprovedDeptResponsibleInput): string {
  const deptBlocks = input.departments
    .map((d) => {
      const rows = d.personel
        .map(
          (p) =>
            `<tr><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(p)}</td></tr>`
        )
        .join('')
      return `
        <p style="margin:16px 0 6px;font-weight:600;color:${NAVY};">${escapeHtml(d.name)} <span style="font-weight:400;color:#6b7280;">(${d.personel.length} personel)</span></p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;">
          <tbody>${rows}</tbody>
        </table>`
    })
    .join('')

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#111827;">
    <div style="background:${NAVY};color:#fff;padding:16px 20px;border-radius:6px 6px 0 0;">
      <h2 style="margin:0;font-size:18px;">Onaylanan ${escapeHtml(input.turAdi)} formu: ${escapeHtml(input.formNo)}</h2>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 6px 6px;">
      <p style="margin:0 0 4px;"><strong>${escapeHtml(input.tarihLabel)}:</strong> ${escapeHtml(input.tarihStr)}</p>
      <p style="margin:12px 0 0;color:#374151;">Aşağıdaki bölüm(ler)inizdeki personel için ${escapeHtml(input.turAdi)} formu onaylandı:</p>
      ${deptBlocks}
      <p style="margin:24px 0 0;">
        <a href="${escapeHtml(input.link)}" style="background:${NAVY};color:#fff;text-decoration:none;padding:10px 18px;border-radius:4px;display:inline-block;">Formu Görüntüle</a>
      </p>
    </div>
  </div>`
}
