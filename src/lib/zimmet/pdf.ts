/**
 * Zimmet Tutanağı PDF üretimi — Zimmet Teslim Formu modülü.
 *
 * offboarding-pdf.ts (İK-FR-001) ile AYNI desen: pdf-lib + @pdf-lib/fontkit,
 * statik Poppins TTF (public/fonts) — Türkçe karakter desteği için. Font
 * yükleme offboarding-fonts.ts'ten AYNEN yeniden kullanılıyor (aynı dosyalar,
 * tekrar kod yazmaya gerek yok).
 *
 * Checkbox YOK — bu formda unicode imza glyph'i de kullanılmıyor; imza
 * alanları çizgi + isim olarak çiziliyor (ıslak imza için).
 */

import fs from 'fs/promises'
import path from 'path'
import { PDFDocument, rgb, degrees, PageSizes, type PDFPage, type PDFFont, type RGB } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { loadOffboardingFonts } from '@/lib/offboarding/offboarding-fonts'
import type { ZimmetTuru, ZimmetCihazDurumu, ZimmetOnayDurumu } from '@/generated/prisma'

export interface ZimmetPdfData {
  id: string
  zimmetSahibiAdi: string
  unvan?: string | null
  sicilNo?: string | null
  altZimmetSahibi: string | null
  departman: string | null
  tur: ZimmetTuru
  turDiger: string | null
  marka?: string
  model?: string
  seriNumarasi: string | null
  aciklama: string | null
  ozellik: string | null
  ram?: string
  ipAdresi?: string
  parcaNo?: string
  lisansBaslangic?: string
  lisansBitis?: string
  macAdresi: string | null
  pcAdi: string | null
  imeiNumarasi: string | null
  verilisTarihi: Date | null
  cihazDurumu: ZimmetCihazDurumu
  durum: ZimmetOnayDurumu
  teslimNotu: string | null
  teslimEdenAdi: string
  createdAt: Date
  teslimEdenImzalandi?: boolean
  teslimEdenImzaTarihi?: string
  zimmetSahibiImzalandi?: boolean
  zimmetSahibiImzaTarihi?: string
  onaylayanAdi?: string
  onayTarihi?: string
  teslimEdenUnvan?: string | null
  teslimEdenBolum?: string | null
  onaylayanUnvan?: string | null
  // Taslak modu: onay akışı tamamlanmamış (ONAY_BEKLIYOR) kayıt için filigranlı
  // önizleme PDF'i. true iken her sayfaya çapraz "TASLAK" filigranı + imza altı not.
  taslak?: boolean
}

const TUR_LABELS: Record<ZimmetTuru, string> = {
  NOTEBOOK_BILGISAYAR: 'Notebook Bilgisayar',
  DESKTOP_BILGISAYAR: 'Desktop Bilgisayar',
  CEP_TELEFONU: 'Cep Telefonu',
  EL_TERMINALI: 'El Terminali',
  OFFICE_365: 'Office 365',
  YAZICI: 'Yazıcı',
  MONITOR: 'Monitör',
  MIKROFON: 'Mikrofon',
  DIGER: 'Diğer',
}

const CIHAZ_DURUMU_LABELS: Record<ZimmetCihazDurumu, string> = {
  AKTIF: 'Aktif',
  PASIF: 'Pasif',
  HURDA: 'Hurda',
}

const LOGO_PATH = path.join(process.cwd(), 'public', 'images', 'zimmet', 'ileri-group-logo.png')
// Sadece BAŞARILI okuma cache'lenir — dosya henüz yoksa her çağrıda yeniden
// denenir (logo sonradan eklendiğinde sunucu restart'ı gerekmesin diye).
let cachedLogo: Buffer | null = null

async function loadLogo(): Promise<Buffer | null> {
  if (cachedLogo) return cachedLogo
  try {
    cachedLogo = await fs.readFile(LOGO_PATH)
  } catch {
    return null
  }
  return cachedLogo
}

// ── Renkler ──
function hexToRgb(hex: string): RGB {
  const c = hex.replace('#', '').trim()
  const r = parseInt(c.slice(0, 2), 16) / 255
  const g = parseInt(c.slice(2, 4), 16) / 255
  const b = parseInt(c.slice(4, 6), 16) / 255
  return rgb(r, g, b)
}
const NAVY = hexToRgb('#1B4F72')
const SLATE = rgb(0.28, 0.32, 0.36)
const BORDER = rgb(0.7, 0.74, 0.78)
const GREY = hexToRgb('#F2F3F4')
const WHITE = rgb(1, 1, 1)
// Onaylandı rozeti — UI'daki ZimmetDurumBadge'in "yesil" rengiyle aynı (emerald-100/emerald-700)
const EMERALD_BG = hexToRgb('#D1FAE5')
const EMERALD_TEXT = hexToRgb('#047857')
const MUTED = rgb(0.4, 0.4, 0.4)

const A4 = PageSizes.A4
const PAGE_W = A4[0]
const PAGE_H = A4[1]
const MARGIN = 36
const CONTENT_W = PAGE_W - 2 * MARGIN
const FOOTER_Y = 28

const fmtDate = (d: Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

export async function generateZimmetPdf(data: ZimmetPdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const fonts = await loadOffboardingFonts()
  const reg = await pdf.embedFont(fonts.regular, { subset: true })
  const bold = await pdf.embedFont(fonts.bold, { subset: true })

  const logoBytes = await loadLogo()
  const logoImage = logoBytes ? await pdf.embedPng(logoBytes) : null

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

  // Logo + başlık + NAVY çizgi altı (her sayfada tekrarlanır)
  // Yeni logo yatay/geniş format (~3.1:1) — sabit width/height yerine
  // image.scale() ile gerçek oranı koruyoruz, aksi halde gerilmiş görünür.
  function drawHeader() {
    const top = PAGE_H - MARGIN
    const logoTargetWidth = 90 // önceki: 140
    const logoDims = logoImage
      ? logoImage.scale(logoTargetWidth / logoImage.width)
      : { width: logoTargetWidth, height: 29 }

    if (logoImage) {
      page.drawImage(logoImage, {
        x: MARGIN,
        y: top - logoDims.height,
        width: logoDims.width,
        height: logoDims.height,
      })
    }

    const title = 'ZİMMET TUTANAĞI'
    const textX = MARGIN + logoDims.width + 14
    text(title, textX, top - logoDims.height / 2 - 2, 16, bold, NAVY)
    text(`Kayıt No: ${data.id}`, textX, top - logoDims.height / 2 - 16, 8, reg, SLATE)

    const lineY = top - logoDims.height - 8
    page.drawLine({
      start: { x: MARGIN, y: lineY },
      end: { x: PAGE_W - MARGIN, y: lineY },
      color: NAVY,
      thickness: 1.4,
    })
    y = lineY - 18
  }
  function newPage() {
    page = pdf.addPage([PAGE_W, PAGE_H])
    drawHeader()
  }
  function ensure(h: number) {
    if (y - h < FOOTER_Y + 16) newPage()
  }

  drawHeader()

  // ── İki kolonlu bilgi tablosu ──
  const turGosterim = data.tur === 'DIGER' ? data.turDiger || '—' : TUR_LABELS[data.tur]
  const zimmetSahibiAdiGosterim =
    (data.zimmetSahibiAdi || '—') + (data.sicilNo ? ` (Sicil: ${data.sicilNo})` : '')
  // Üçüncü eleman (varsa) - deger satirinin ALTINDA kucuk gri "alt satir" olarak
  // cizilir (bkz. render loop). Sadece Zimmet Sahibi'nde (unvan) kullaniliyor -
  // eskiden "Ad Soyad — Unvan" tek satirda birlestiriliyordu, uzun unvanlarda
  // hucre tasmasi/hizasizlik yaratiyordu.
  const infoRows: [string, string, string?][] = [
    ['Zimmet Sahibi', zimmetSahibiAdiGosterim, data.unvan || undefined],
    ['Departman', data.departman || '—'],
    ...(data.altZimmetSahibi ? [['Alt Zimmet Sahibi', data.altZimmetSahibi] as [string, string]] : []),
    ['Tür', turGosterim],
    ['Cihaz Durumu', CIHAZ_DURUMU_LABELS[data.cihazDurumu]],
    ...(data.marka ? [['Marka', data.marka] as [string, string]] : []),
    ...(data.model ? [['Model', data.model] as [string, string]] : []),
    ['Seri Numarası', data.seriNumarasi || '—'],
    ...(data.imeiNumarasi ? [['IMEI Numarası', data.imeiNumarasi] as [string, string]] : []),
    ['Açıklama', data.aciklama || '—'],
    ['Özellik', data.ozellik || '—'],
    ...(data.ram ? [['RAM', data.ram] as [string, string]] : []),
    ...(data.ipAdresi ? [['IP Adresi', data.ipAdresi] as [string, string]] : []),
    ...(data.parcaNo ? [['P/N', data.parcaNo] as [string, string]] : []),
    ['MAC Adresi', data.macAdresi || '—'],
    ['PC Adı', data.pcAdi || '—'],
    ['Veriliş Tarihi', fmtDate(data.verilisTarihi)],
    ...(data.lisansBaslangic
      ? [['Lisans Başlangıç', fmtDate(new Date(data.lisansBaslangic))] as [string, string]]
      : []),
    ...(data.lisansBitis
      ? [['Lisans Bitiş', fmtDate(new Date(data.lisansBitis))] as [string, string]]
      : []),
  ]
  const colW = CONTENT_W / 2
  const ROW_H = 18
  const SUB_LINE_H = 10
  const SUB_SIZE = 7
  for (let i = 0; i < infoRows.length; i += 2) {
    const rowCells: [typeof infoRows[number] | undefined, typeof infoRows[number] | undefined] = [
      infoRows[i],
      infoRows[i + 1],
    ]
    // Satırdaki İKİ hücreden biri alt satır (ünvan gibi) taşıyorsa, satır
    // yüksekliği ikisi için de büyür - aksi halde aynı satırdaki komşu hücrenin
    // çerçevesi kısa kalır, dikey hizası bozulur.
    const rowH = rowCells.some((c) => c?.[2]) ? ROW_H + SUB_LINE_H : ROW_H
    ensure(rowH)
    for (let c = 0; c < 2; c++) {
      const cell = rowCells[c]
      if (!cell) continue
      const cx = MARGIN + c * colW
      page.drawRectangle({ x: cx, y: y - rowH, width: colW, height: rowH, borderColor: BORDER, borderWidth: 0.6 })
      text(cell[0], cx + 6, y - 12, 8, bold, NAVY)
      text(cell[1], cx + 120, y - 12, 8, reg, SLATE)
      if (cell[2]) {
        text(cell[2], cx + 120, y - 12 - SUB_LINE_H, SUB_SIZE, reg, MUTED)
      }
    }
    y -= rowH
  }
  y -= 10

  // ── Teslim koşulları / notlar kutusu (GREY) ──
  text('Teslim Koşulları / Notlar', MARGIN + 2, y - 10, 8.5, bold, NAVY)
  y -= 16
  // Kaynak metin \n\n ile paragraflara, tekli \n ile de "-" madde satırlarına
  // ayrılmış — /\n+/ ile bölmek her paragrafı VE her madde satırını kendi
  // birimi olarak ayırır (aradaki boş satırlar filter(Boolean) ile düşer).
  const NOTE_LINE_H = 10
  const NOTE_PARA_GAP = 6
  const noteParagraphs = (data.teslimNotu || '—')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const noteParagraphLines = (noteParagraphs.length ? noteParagraphs : ['—']).map((p) =>
    wrap(p, reg, 8, CONTENT_W - 24)
  )
  const noteTotalLines = noteParagraphLines.reduce((sum, lines) => sum + lines.length, 0)
  const noteH = Math.max(
    24,
    noteTotalLines * NOTE_LINE_H + (noteParagraphLines.length - 1) * NOTE_PARA_GAP + 14
  )
  ensure(noteH)
  page.drawRectangle({ x: MARGIN, y: y - noteH, width: CONTENT_W, height: noteH, color: GREY, borderColor: BORDER, borderWidth: 0.6 })
  let noteY = y - 14
  noteParagraphLines.forEach((lines, pi) => {
    lines.forEach((ln) => {
      text(ln, MARGIN + 12, noteY, 8, reg, SLATE)
      noteY -= NOTE_LINE_H
    })
    if (pi < noteParagraphLines.length - 1) noteY -= NOTE_PARA_GAP
  })
  y -= noteH + 16

  // ── İmza kutuları (Zimmeti Veren / Zimmet Sahibi / Onaylayan) ──
  // Kutu icindeki sabit noktalar (imza cizgisi, isim) yukseklikten bagimsiz -
  // sadece durum metni (statusLines) uzun/kisa oldugunda kutu YUKSEKLIGI
  // degisir, taşma olmadan tum kutular ayni satirda hizali kalir.
  const sigW = CONTENT_W / 3
  const STATUS_SIZE = 7
  const STATUS_LINE_H = 9
  // Ünvan/bölüm isimden görsel olarak ayrışsın diye: küçük punto + gri renk
  // (MUTED) + isimden (bold, SLATE) belirgin şekilde farklı. Satır aralığı
  // punto boyutunun ~1.4 katı - iki satır (ünvan/bölüm) birbirine yapışmasın.
  const TITLE_SIZE = 8
  const TITLE_LINE_H = 11
  const fmtDateTime = (d: string) =>
    new Date(d).toLocaleString('tr-TR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })

  type SigBox = {
    role: string
    name: string
    unvan?: string
    bolum?: string
    statusLines: string[]
    statusColor: RGB
    statusBadge: boolean
  }

  function bosStatus(etiket: string): Pick<SigBox, 'statusLines' | 'statusColor' | 'statusBadge'> {
    return { statusLines: [etiket], statusColor: BORDER, statusBadge: false }
  }
  function doluStatus(
    onek: string,
    tarih: string,
    rozet: boolean
  ): Pick<SigBox, 'statusLines' | 'statusColor' | 'statusBadge'> {
    // İsim üstteki başlık satırında zaten var - durum satırında tekrar etmesin.
    const satir = `${onek} — ${fmtDateTime(tarih)}`
    return {
      statusLines: wrap(satir, reg, STATUS_SIZE, sigW - 12),
      statusColor: rozet ? EMERALD_TEXT : SLATE,
      statusBadge: rozet,
    }
  }

  const sigBoxes: SigBox[] = [
    {
      role: 'Zimmeti Veren',
      name: data.teslimEdenAdi || '—',
      unvan: data.teslimEdenUnvan || undefined,
      bolum: data.teslimEdenBolum || undefined,
      ...(data.teslimEdenImzalandi && data.teslimEdenImzaTarihi
        ? doluStatus('E-İmzalandı', data.teslimEdenImzaTarihi, false)
        : bosStatus('Ad Soyad / İmza')),
    },
    {
      role: 'Zimmet Sahibi',
      name: data.zimmetSahibiAdi || '—',
      unvan: data.unvan || undefined,
      bolum: data.departman || undefined,
      ...(data.zimmetSahibiImzalandi && data.zimmetSahibiImzaTarihi
        ? doluStatus('E-İmzalandı', data.zimmetSahibiImzaTarihi, false)
        : bosStatus('Ad Soyad / İmza')),
    },
    {
      // Onaylayan tek kişi (Melih Dilben) olduğu için ismi/ünvanı onay
      // beklenirken de her zaman gösterilir - sadece altındaki durum satırı
      // onay anına göre değişir (bkz. data.onayTarihi kontrolü).
      role: 'Onaylayan',
      name: data.onaylayanAdi || '—',
      unvan: data.onaylayanUnvan || undefined,
      ...(data.onayTarihi
        ? doluStatus('Onaylandı', data.onayTarihi, true)
        : { statusLines: [''], statusColor: BORDER, statusBadge: false }),
    },
  ]

  // Ünvan + bölüm için HER ZAMAN iki satırlık sabit yer ayrılır (biri boşsa
  // o satır çizilmez ama yer kalır) - üç kutu da aynı yükseklikte başlasın,
  // status alanı satır hizası bozulmasın.
  const TITLE_BLOCK_H = 2 * TITLE_LINE_H
  const maxStatusLines = Math.max(...sigBoxes.map((sb) => sb.statusLines.length))
  const sigH = 54 + TITLE_BLOCK_H + (maxStatusLines - 1) * STATUS_LINE_H + 8
  ensure(sigH)

  sigBoxes.forEach((sb, i) => {
    const sx = MARGIN + i * sigW
    text(sb.role, sx + 4, y - 10, 8.5, bold, NAVY)
    page.drawLine({ start: { x: sx + 4, y: y - 34 }, end: { x: sx + sigW - 16, y: y - 34 }, color: BORDER, thickness: 0.8 })
    text(sb.name, sx + 4, y - 44, 8.5, bold, SLATE)
    if (sb.unvan) {
      text(sb.unvan, sx + 4, y - 44 - TITLE_LINE_H, TITLE_SIZE, reg, MUTED)
    }
    if (sb.bolum) {
      text(sb.bolum, sx + 4, y - 44 - 2 * TITLE_LINE_H, TITLE_SIZE, reg, MUTED)
    }

    const statusY0 = y - 44 - TITLE_BLOCK_H - 10
    if (sb.statusBadge) {
      const badgeH = sb.statusLines.length * STATUS_LINE_H + 6
      page.drawRectangle({
        x: sx + 2,
        y: statusY0 - badgeH + STATUS_LINE_H - 2,
        width: sigW - 12,
        height: badgeH,
        color: EMERALD_BG,
      })
    }
    sb.statusLines.forEach((ln, li) => {
      text(ln, sx + 6, statusY0 - li * STATUS_LINE_H, STATUS_SIZE, sb.statusBadge ? bold : reg, sb.statusColor)
    })
  })
  y -= sigH

  // Taslak: imza alanlarının altına onay-akışı uyarısı.
  if (data.taslak) {
    ensure(16)
    text('Bu belge onay akışını tamamlamamıştır.', MARGIN, y - 2, 8.5, bold, rgb(0.72, 0.25, 0.25))
    y -= 16
  }

  // ── Footer (sayfa no + kayıt no, tüm sayfalar) + taslak filigranı ──
  const pages = pdf.getPages()
  const total = pages.length
  pages.forEach((p, i) => {
    // Taslak filigranı: her sayfaya çapraz, büyük, açık gri, düşük opaklık.
    if (data.taslak) {
      const wm = 'TASLAK · ONAYLANMAMIŞTIR'
      const wmSize = 44
      const wmW = bold.widthOfTextAtSize(wm, wmSize)
      p.drawText(wm, {
        x: PAGE_W / 2 - (wmW / 2) * Math.cos(Math.PI / 4),
        y: PAGE_H / 2 - (wmW / 2) * Math.sin(Math.PI / 4),
        size: wmSize,
        font: bold,
        color: rgb(0.6, 0.6, 0.6),
        opacity: 0.15,
        rotate: degrees(45),
      })
    }
    const label = `Sayfa ${i + 1} / ${total}`
    p.drawText(label, { x: PAGE_W - MARGIN - reg.widthOfTextAtSize(label, 8), y: FOOTER_Y, size: 8, font: reg, color: SLATE })
    p.drawText(`Zimmet Tutanağı · ${data.id}`, { x: MARGIN, y: FOOTER_Y, size: 8, font: reg, color: SLATE })
  })

  return pdf.save()
}
