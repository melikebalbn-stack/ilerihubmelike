// Mesai formu SON onayı (İK final, status=APPROVED) sonrası, formdaki personellerin
// birim sorumlularına gönderilen bilgi maili. Her sorumlu YALNIZ kendi sorumlu olduğu
// bölüm(ler)in personelini görür. Kurumsal yerleşim (layout.ts, üst şerit "Mesai").
import { escapeHtml } from '@/lib/email-templates/akademi/_base'
import { renderEmailHtml, p, dataTable, sectionTitle } from '@/lib/email-templates/layout'

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
    .map(
      (d) =>
        sectionTitle(d.name, `${d.personel.length} personel`) +
        dataTable(['Personel'], d.personel.map((p) => [escapeHtml(p)])),
    )
    .join('')

  return renderEmailHtml({
    module: 'Mesai',
    title: `Onaylanan ${input.turAdi} formu`,
    subtitle: `${input.formNo} · ${input.tarihLabel}: ${input.tarihStr}`,
    preheader: `Onaylanan ${input.turAdi} formu: ${input.formNo}`,
    infoRows: [
      { label: 'Form No', value: `<strong>${escapeHtml(input.formNo)}</strong>` },
      { label: input.tarihLabel, value: escapeHtml(input.tarihStr) },
    ],
    afterHtml:
      p(`Aşağıdaki bölüm(ler)inizdeki personel için ${escapeHtml(input.turAdi)} formu onaylandı:`) +
      deptBlocks,
    cta: { label: 'Formu Görüntüle', url: input.link },
  })
}
