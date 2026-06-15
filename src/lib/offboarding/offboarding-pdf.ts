/**
 * OFFB-4: İK-FR-001 "Zimmet İade ve İlişik Kesme Formu" PDF üretimi.
 *
 * pdf-lib + @pdf-lib/fontkit + @fontsource/inter (latin-ext woff → Türkçe
 * karakter desteği), akademi certificate-pdf deseni ile uyumlu.
 *
 * Checkbox'lar UNICODE DEĞİL — pdf-lib ile vektör dikdörtgen + işaretliyse
 * içine kırmızı X çizilir (Inter'de ballot-box glyph'i yok).
 *
 * Marka parametrik: logo hücresi HER ZAMAN "İLERİ GROUP"; gövde etiketi
 * (Amaç/Kapsam/Beyan) org='ileri-mekanik' ise "İleri Mekanik".
 */

import { PDFDocument, rgb, PageSizes, type PDFPage, type PDFFont, type RGB } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { loadOffboardingFonts } from './offboarding-fonts'
import {
  PERSONNEL_TYPE_LABELS,
  SEPARATION_TYPE_LABELS,
  type OffboardingPersonnelType,
  type OffboardingSeparationType,
  type OffboardingStatus,
} from '@/components/offboarding/constants'

export type OffboardingOrg = 'ileri-mekanik' | 'ileri-group'

export interface OffboardingPdfAsset {
  sira: number
  label: string
  returned: boolean
  notApplicable: boolean
  note: string | null
}
export interface OffboardingPdfAccess {
  sira: number
  label: string
  revoked: boolean
  revokedAt: Date | null
  appliedBy: string | null
}
export interface OffboardingPdfData {
  formNo: string
  adSoyad: string
  sicilNo: string | null
  departman: string | null
  gorev: string | null
  iseGirisTarihi: Date | null
  ayrilisTarihi: Date
  personelTuru: OffboardingPersonnelType
  ayrilisTuru: OffboardingSeparationType
  beyanOnay: boolean
  teslimEdenAd: string | null
  teslimAlanName: string | null
  notes: string | null
  status: OffboardingStatus
  assetItems: OffboardingPdfAsset[]
  accessItems: OffboardingPdfAccess[]
  org: OffboardingOrg
  // NOT: kaydın hazirlayanId/onaylayan1Id/onaylayan2Id alanları PDF'te
  // GÖSTERİLMEZ (yalnız workflow/durum için). Alt onay bloğu sabit şablon
  // yazarlarını taşır (aşağıdaki TEMPLATE_* sabitleri).
}

// İK-FR-001 SABİT doküman künyesi — kontrollü doküman; kayda göre DEĞİŞMEZ.
const PUB_DATE = '05.01.2025' // Yayın Tarihi (sabit)
const REV_NO = '00'
const TEMPLATE_PREPARER = 'Enes Aydınçakır' // Hazırlayan
const TEMPLATE_APPROVER_1 = 'Melih Dilben' // Onaylayan
const TEMPLATE_APPROVER_2 = 'Elif Kasar' // Onaylayan

// ── Renkler ──
function hexToRgb(hex: string): RGB {
  const c = hex.replace('#', '').trim()
  const r = parseInt(c.slice(0, 2), 16) / 255
  const g = parseInt(c.slice(2, 4), 16) / 255
  const b = parseInt(c.slice(4, 6), 16) / 255
  return rgb(r, g, b)
}
const NAVY = hexToRgb('#1B4F72')
const RED = hexToRgb('#C0392B')
const YELLOW = hexToRgb('#FAD7A0')
const GREEN_BG = hexToRgb('#D5F5E3')
const GREEN_BORDER = hexToRgb('#1E8449')
const GREY = hexToRgb('#F2F3F4')
const SLATE = rgb(0.28, 0.32, 0.36)
const BORDER = rgb(0.7, 0.74, 0.78)
const WHITE = rgb(1, 1, 1)

const A4 = PageSizes.A4 // [595.28, 841.89]
const PAGE_W = A4[0]
const PAGE_H = A4[1]
const MARGIN = 36
const CONTENT_W = PAGE_W - 2 * MARGIN
const FOOTER_Y = 28

const fmtDate = (d: Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

export async function generateOffboardingPdf(data: OffboardingPdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const fonts = await loadOffboardingFonts()
  const reg = await pdf.embedFont(fonts.regular, { subset: true })
  const bold = await pdf.embedFont(fonts.bold, { subset: true })

  const orgLabel = data.org === 'ileri-mekanik' ? 'İleri Mekanik' : 'İleri Group'

  // ── Çizim yardımcıları ──
  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H])
  let y = 0

  function text(s: string, x: number, ty: number, size: number, font: PDFFont = reg, color: RGB = SLATE) {
    page.drawText(s ?? '', { x, y: ty, size, font, color })
  }
  function wrap(s: string, font: PDFFont, size: number, maxW: number): string[] {
    const words = (s || '').split(/\s+/).filter(Boolean)
    if (words.length === 0) return ['']
    const lines: string[] = []
    let cur = ''
    for (const w of words) {
      const trial = cur ? `${cur} ${w}` : w
      if (font.widthOfTextAtSize(trial, size) > maxW && cur) {
        lines.push(cur)
        cur = w
      } else {
        cur = trial
      }
    }
    if (cur) lines.push(cur)
    return lines
  }
  function checkbox(x: number, by: number, checked: boolean, size = 9) {
    page.drawRectangle({ x, y: by, width: size, height: size, borderColor: NAVY, borderWidth: 0.8, color: WHITE })
    if (checked) {
      page.drawLine({ start: { x: x + 1.6, y: by + 1.6 }, end: { x: x + size - 1.6, y: by + size - 1.6 }, color: RED, thickness: 1.3 })
      page.drawLine({ start: { x: x + 1.6, y: by + size - 1.6 }, end: { x: x + size - 1.6, y: by + 1.6 }, color: RED, thickness: 1.3 })
    }
  }
  // Running header (her sayfada üst kontrol tablosu); y'yi başlığın altına çeker.
  function drawRunningHeader() {
    const top = PAGE_H - MARGIN
    const h = 54
    const x0 = MARGIN
    // 5 sütun genişlikleri
    const w = [118, CONTENT_W - 118 - 92 - 96 - 56, 92, 96, 56]
    const xs: number[] = [x0]
    for (const cw of w) xs.push(xs[xs.length - 1] + cw)
    // dış çerçeve + dikey çizgiler
    page.drawRectangle({ x: x0, y: top - h, width: CONTENT_W, height: h, borderColor: NAVY, borderWidth: 1 })
    for (let i = 1; i < xs.length - 1; i++) {
      page.drawLine({ start: { x: xs[i], y: top - h }, end: { x: xs[i], y: top }, color: NAVY, thickness: 0.8 })
    }
    // 1) Logo hücresi — HER ZAMAN İLERİ GROUP
    text('İLERİ GROUP', xs[0] + 8, top - 20, 11, bold, NAVY)
    for (const [i, ln] of wrap('Bilgi Güvenliği Yönetim Sistemi', reg, 7, w[0] - 12).entries()) {
      text(ln, xs[0] + 8, top - 32 - i * 9, 7, reg, SLATE)
    }
    // 2) Başlık
    const titleLines = wrap('ZİMMET İADE VE İLİŞİK KESME FORMU', bold, 10, w[1] - 12)
    titleLines.forEach((ln, i) => {
      const tw = bold.widthOfTextAtSize(ln, 10)
      text(ln, xs[1] + (w[1] - tw) / 2, top - 24 - i * 12, 10, bold, NAVY)
    })
    // 3) Doküman No
    text('Doküman No', xs[2] + 6, top - 16, 7, bold, SLATE)
    text('İK-FR-001', xs[2] + 6, top - 30, 9, bold, NAVY)
    // 4) Yayın Tarihi + Revizyon (SABİT künye — kayda göre değişmez)
    text('Yayın Tarihi', xs[3] + 6, top - 14, 7, bold, SLATE)
    text(PUB_DATE, xs[3] + 6, top - 25, 8, reg, SLATE)
    text(`Rev. No: ${REV_NO}`, xs[3] + 6, top - 37, 7, reg, SLATE)
    text('Rev. Tarihi: —', xs[3] + 6, top - 47, 7, reg, SLATE)
    // 5) Sayfa No — gerçek değer sonda doldurulur (placeholder)
    text('Sayfa No', xs[4] + 5, top - 16, 7, bold, SLATE)
    y = top - h - 14
  }
  function newPage() {
    page = pdf.addPage([PAGE_W, PAGE_H])
    drawRunningHeader()
  }
  function ensure(h: number) {
    if (y - h < FOOTER_Y + 16) newPage()
  }

  // Bölüm başlığı (navy bar)
  function sectionBar(label: string) {
    ensure(22)
    page.drawRectangle({ x: MARGIN, y: y - 18, width: CONTENT_W, height: 18, color: NAVY })
    text(label, MARGIN + 8, y - 13, 9.5, bold, WHITE)
    y -= 18 + 6
  }

  // ════════ Sayfa 1 üst ════════
  drawRunningHeader()

  // 2) Navy başlık kutusu
  page.drawRectangle({ x: MARGIN, y: y - 26, width: CONTENT_W, height: 26, color: NAVY })
  text('İK-FR-001   ZİMMET İADE VE İLİŞİK KESME FORMU', MARGIN + 10, y - 18, 13, bold, WHITE)
  y -= 26 + 10

  // 3) Amaç / Kapsam / ISO mini tablosu
  const amacRows: [string, string][] = [
    ['Amaç', `${orgLabel} bünyesinde görevi sona eren personel ile yüklenici/taşeron için fiziksel varlık ve mantıksal erişim yetkilerinin iadesini kayıt altına almak.`],
    ['Kapsam', `${orgLabel} tüm departmanları ve yüklenici/taşeron personeli.`],
    ['Referans', 'ISO 27001:2022 Annex A.5.11 (Varlıkların iadesi) · A.6.5 (İstihdam sonrası sorumluluklar) · A.5.18 (Erişim haklarının kaldırılması) · Siber Hijyen md. 1.5'],
  ]
  for (const [k, v] of amacRows) {
    const labelW = 70
    const lines = wrap(v, reg, 8, CONTENT_W - labelW - 14)
    const rh = Math.max(16, lines.length * 10 + 6)
    ensure(rh)
    page.drawRectangle({ x: MARGIN, y: y - rh, width: CONTENT_W, height: rh, borderColor: BORDER, borderWidth: 0.6 })
    page.drawRectangle({ x: MARGIN, y: y - rh, width: labelW, height: rh, color: GREY, borderColor: BORDER, borderWidth: 0.6 })
    text(k, MARGIN + 6, y - 13, 8, bold, NAVY)
    lines.forEach((ln, i) => text(ln, MARGIN + labelW + 6, y - 12 - i * 10, 8, reg, SLATE))
    y -= rh
  }
  y -= 8

  // ════════ BÖLÜM 1 — Personel Bilgileri ════════
  sectionBar('BÖLÜM 1 · PERSONEL BİLGİLERİ')
  const f1: [string, string][] = [
    ['Ad Soyad', data.adSoyad || '—'],
    ['Sicil No', data.sicilNo || '—'],
    ['Departman', data.departman || '—'],
    ['Görev / Pozisyon', data.gorev || '—'],
    ['İşe Giriş Tarihi', fmtDate(data.iseGirisTarihi)],
    ['Ayrılış Tarihi', fmtDate(data.ayrilisTarihi)],
  ]
  const colW = CONTENT_W / 2
  for (let i = 0; i < f1.length; i += 2) {
    ensure(18)
    for (let c = 0; c < 2; c++) {
      const cell = f1[i + c]
      if (!cell) continue
      const cx = MARGIN + c * colW
      page.drawRectangle({ x: cx, y: y - 18, width: colW, height: 18, borderColor: BORDER, borderWidth: 0.6 })
      text(cell[0], cx + 6, y - 12, 8, bold, NAVY)
      text(cell[1], cx + 120, y - 12, 8, reg, SLATE)
    }
    y -= 18
  }
  y -= 6

  // Personel Türü (checkbox)
  ensure(16)
  text('Personel Türü:', MARGIN + 2, y - 10, 8, bold, NAVY)
  let cx = MARGIN + 90
  ;(['ILERI_MEKANIK', 'CONTRACTOR'] as OffboardingPersonnelType[]).forEach((t) => {
    checkbox(cx, y - 13, data.personelTuru === t)
    const lbl = PERSONNEL_TYPE_LABELS[t]
    text(lbl, cx + 13, y - 11, 8, reg, SLATE)
    cx += 13 + reg.widthOfTextAtSize(lbl, 8) + 22
  })
  y -= 18

  // Ayrılış Türü (checkbox)
  ensure(16)
  text('Ayrılış Türü:', MARGIN + 2, y - 10, 8, bold, NAVY)
  cx = MARGIN + 90
  ;(['RESIGNATION', 'TERMINATION', 'RETIREMENT', 'CONTRACT_END', 'OTHER'] as OffboardingSeparationType[]).forEach((t) => {
    const lbl = SEPARATION_TYPE_LABELS[t]
    const need = 13 + reg.widthOfTextAtSize(lbl, 8) + 16
    if (cx + need > MARGIN + CONTENT_W) { y -= 14; cx = MARGIN + 90; ensure(14) }
    checkbox(cx, y - 13, data.ayrilisTuru === t)
    text(lbl, cx + 13, y - 11, 8, reg, SLATE)
    cx += need
  })
  y -= 20

  // ── Tablo çizici (asset/access ortak, sayfa taşması yönetimli) ──
  interface Col { title: string; w: number; align?: 'left' | 'center' }
  function drawTableHeader(cols: Col[]) {
    ensure(18)
    let tx = MARGIN
    page.drawRectangle({ x: MARGIN, y: y - 16, width: CONTENT_W, height: 16, color: NAVY })
    for (const col of cols) {
      const t = col.title
      const tw = bold.widthOfTextAtSize(t, 7.5)
      const px = col.align === 'center' ? tx + (col.w - tw) / 2 : tx + 5
      text(t, px, y - 11, 7.5, bold, WHITE)
      tx += col.w
    }
    y -= 16
  }
  // cells: her hücre ya metin (string) ya checkbox (boolean)
  function drawTableRow(cols: Col[], cells: (string | boolean)[], zebra: boolean) {
    // satır yüksekliği: en uzun metin hücresine göre
    let maxLines = 1
    cells.forEach((cell, i) => {
      if (typeof cell === 'string') maxLines = Math.max(maxLines, wrap(cell, reg, 7.5, cols[i].w - 10).length)
    })
    const rh = Math.max(15, maxLines * 9 + 6)
    if (y - rh < FOOTER_Y + 16) { newPage(); drawTableHeader(cols) }
    let tx = MARGIN
    if (zebra) page.drawRectangle({ x: MARGIN, y: y - rh, width: CONTENT_W, height: rh, color: GREY })
    page.drawRectangle({ x: MARGIN, y: y - rh, width: CONTENT_W, height: rh, borderColor: BORDER, borderWidth: 0.5 })
    cols.forEach((col, i) => {
      const cell = cells[i]
      if (typeof cell === 'boolean') {
        checkbox(tx + (col.w - 9) / 2, y - rh / 2 - 4.5, cell)
      } else {
        const lines = wrap(cell, reg, 7.5, col.w - 10)
        lines.forEach((ln, li) => {
          const tw = reg.widthOfTextAtSize(ln, 7.5)
          const px = col.align === 'center' ? tx + (col.w - tw) / 2 : tx + 5
          text(ln, px, y - 11 - li * 9, 7.5, reg, SLATE)
        })
      }
      if (i > 0) page.drawLine({ start: { x: tx, y: y - rh }, end: { x: tx, y }, color: BORDER, thickness: 0.5 })
      tx += col.w
    })
    y -= rh
  }

  // ════════ BÖLÜM 2 — Fiziksel Varlık ════════
  sectionBar('BÖLÜM 2 · FİZİKSEL VARLIK İADESİ')
  const assetCols: Col[] = [
    { title: 'Sıra', w: 32, align: 'center' },
    { title: 'Varlık', w: 200 },
    { title: 'İade Edildi', w: 60, align: 'center' },
    { title: 'İlgili Değil', w: 60, align: 'center' },
    { title: 'Açıklama / Seri No', w: CONTENT_W - 32 - 200 - 60 - 60 },
  ]
  drawTableHeader(assetCols)
  data.assetItems
    .slice()
    .sort((a, b) => a.sira - b.sira)
    .forEach((it, idx) =>
      drawTableRow(assetCols, [String(it.sira), it.label, it.returned, it.notApplicable, it.note || ''], idx % 2 === 1),
    )
  y -= 10

  // ════════ BÖLÜM 3 — Mantıksal Erişim ════════
  sectionBar('BÖLÜM 3 · MANTIKSAL YETKİ / ERİŞİM İADESİ')
  const accessCols: Col[] = [
    { title: 'Sıra', w: 32, align: 'center' },
    { title: 'Yetki / Erişim', w: 220 },
    { title: 'Kapatıldı', w: 60, align: 'center' },
    { title: 'Tarih', w: 70, align: 'center' },
    { title: 'Uygulayan', w: CONTENT_W - 32 - 220 - 60 - 70 },
  ]
  drawTableHeader(accessCols)
  data.accessItems
    .slice()
    .sort((a, b) => a.sira - b.sira)
    .forEach((it, idx) =>
      drawTableRow(accessCols, [String(it.sira), it.label, it.revoked, fmtDate(it.revokedAt), it.appliedBy || ''], idx % 2 === 1),
    )
  y -= 10

  // ════════ BÖLÜM 4 — Beyan ve Teslim ════════
  sectionBar('BÖLÜM 4 · BEYAN VE TESLİM')
  const beyan = `${orgLabel} adına; yukarıda belirtilen tüm zimmetli fiziksel varlıkları iade ettiğimi ve sistem erişim yetkilerimin kaldırıldığını beyan ederim.`
  const bLines = wrap(beyan, reg, 8, CONTENT_W - 24)
  const bH = bLines.length * 10 + 10
  ensure(bH)
  bLines.forEach((ln, i) => text(ln, MARGIN + 16, y - 12 - i * 10, 8, reg, SLATE))
  checkbox(MARGIN + 2, y - 12, data.beyanOnay)
  y -= bH

  ensure(20)
  page.drawRectangle({ x: MARGIN, y: y - 18, width: colW, height: 18, borderColor: BORDER, borderWidth: 0.6 })
  text('Teslim Eden', MARGIN + 6, y - 12, 8, bold, NAVY)
  text(data.teslimEdenAd || '—', MARGIN + 80, y - 12, 8, reg, SLATE)
  page.drawRectangle({ x: MARGIN + colW, y: y - 18, width: colW, height: 18, borderColor: BORDER, borderWidth: 0.6 })
  text('Teslim Alan', MARGIN + colW + 6, y - 12, 8, bold, NAVY)
  text(data.teslimAlanName || '—', MARGIN + colW + 80, y - 12, 8, reg, SLATE)
  y -= 18 + 8

  // İlişik Kesme Onayları (imza hücreleri)
  text('İlişik Kesme Onayları', MARGIN + 2, y - 10, 8.5, bold, NAVY)
  y -= 16
  const signCells = ['İnsan Kaynakları', 'Muhasebe', 'BT / SGM', 'Departman Müdürü']
  const scW = CONTENT_W / signCells.length
  const scH = 46
  ensure(scH)
  signCells.forEach((label, i) => {
    const sx = MARGIN + i * scW
    page.drawRectangle({ x: sx, y: y - scH, width: scW, height: scH, borderColor: BORDER, borderWidth: 0.6 })
    text(label, sx + 5, y - 12, 7.5, bold, NAVY)
    text('Ad Soyad / İmza', sx + 5, y - scH + 8, 6.5, reg, BORDER)
  })
  y -= scH + 10

  // ════════ Revizyon tablosu ════════
  text('Revizyon Geçmişi', MARGIN + 2, y - 10, 8.5, bold, NAVY)
  y -= 14
  const revCols: Col[] = [
    { title: 'Rev. No', w: 55, align: 'center' },
    { title: 'Tarih', w: 80, align: 'center' },
    { title: 'Hazırlayan', w: 130 },
    { title: 'Açıklama', w: CONTENT_W - 55 - 80 - 130 },
  ]
  drawTableHeader(revCols)
  // Rev.00 satırı SABİT (kontrollü doküman künyesi) — sarı
  {
    const rh = 16
    ensure(rh)
    page.drawRectangle({ x: MARGIN, y: y - rh, width: CONTENT_W, height: rh, color: YELLOW, borderColor: BORDER, borderWidth: 0.5 })
    let tx = MARGIN
    const vals = [REV_NO, PUB_DATE, TEMPLATE_PREPARER, 'İlk yayın']
    revCols.forEach((col, i) => {
      const tw = reg.widthOfTextAtSize(vals[i], 7.5)
      const px = col.align === 'center' ? tx + (col.w - tw) / 2 : tx + 5
      text(vals[i], px, y - 11, 7.5, reg, SLATE)
      if (i > 0) page.drawLine({ start: { x: tx, y: y - rh }, end: { x: tx, y }, color: BORDER, thickness: 0.5 })
      tx += col.w
    })
    y -= rh + 10
  }

  // ════════ Onay bloğu — SABİT şablon yazarları (kontrollü doküman) ════════
  // Kaydın hazirlayanId/onaylayan1Id/onaylayan2Id alanları BURADA gösterilmez.
  const approvers: { role: string; name: string }[] = [
    { role: 'Hazırlayan', name: TEMPLATE_PREPARER },
    { role: 'Onaylayan', name: TEMPLATE_APPROVER_1 },
    { role: 'Onaylayan', name: TEMPLATE_APPROVER_2 },
  ]
  const apW = CONTENT_W / approvers.length
  const apH = 56
  ensure(apH)
  approvers.forEach((ap, i) => {
    const ax = MARGIN + i * apW
    page.drawRectangle({ x: ax, y: y - apH, width: apW, height: apH, borderColor: NAVY, borderWidth: 0.8 })
    text(ap.role, ax + 6, y - 13, 8, bold, NAVY)
    const nw = bold.widthOfTextAtSize(ap.name, 9)
    text(ap.name, ax + (apW - nw) / 2, y - 30, 9, bold, SLATE)
    const sig = '[ ELEKTRONİK ORTAMDA İMZALANMIŞTIR ]'
    const sw = reg.widthOfTextAtSize(sig, 6)
    text(sig, ax + (apW - sw) / 2, y - 42, 6, reg, RED)
  })
  y -= apH + 12

  // ════════ Yeşil kapanış kutusu ════════
  const closing = `Bu form, İK-FR-001 İlişik Kesme ve Zimmet İade sürecinin tamamlandığının kaydıdır. Form No: ${data.formNo}`
  const cLines = wrap(closing, reg, 8, CONTENT_W - 24)
  const cH = cLines.length * 11 + 14
  ensure(cH)
  page.drawRectangle({ x: MARGIN, y: y - cH, width: CONTENT_W, height: cH, color: GREEN_BG, borderColor: GREEN_BORDER, borderWidth: 1 })
  cLines.forEach((ln, i) => text(ln, MARGIN + 12, y - 14 - i * 11, 8, reg, GREEN_BORDER))
  y -= cH

  // ════════ Footer + Sayfa No (tüm sayfalar, toplam sayı sonda) ════════
  const pages = pdf.getPages()
  const total = pages.length
  pages.forEach((p, i) => {
    const label = `Sayfa ${i + 1} / ${total}`
    p.drawText(label, { x: PAGE_W - MARGIN - reg.widthOfTextAtSize(label, 8), y: FOOTER_Y, size: 8, font: reg, color: SLATE })
    p.drawText(`İK-FR-001 · ${data.formNo}`, { x: MARGIN, y: FOOTER_Y, size: 8, font: reg, color: SLATE })
    // üst kontrol tablosundaki "Sayfa No" hücresine değer
    p.drawText(`${i + 1} / ${total}`, { x: PAGE_W - MARGIN - 48, y: PAGE_H - MARGIN - 30, size: 8, font: bold, color: NAVY })
  })

  return pdf.save()
}
