/**
 * Depo "Malzeme Tanıtım Kartı" PDF (EL-4) — fiziksel etiket 80×100 mm (yazıcı stoğu),
 * içerik onaylanmış 100×80 mm yatay tasarımın 90° döndürülerek gömülmüş hali.
 *
 * Font/DataMatrix altyapısı üretim malzeme etiketinden (src/lib/uretim/
 * malzeme-etiketi-pdf.ts) yeniden kullanıldı: pdf-lib + @pdf-lib/fontkit +
 * public/fonts Poppins TTF (Türkçe karakter gömülü) + bwip-js/node DataMatrix.
 *
 * DataMatrix iç formatı 'B:{barkodId}|P:{stok}|T:{lot}|Q:{mik}|S:{etiketNo}' — etiket-parse.ts
 * sözleşmesiyle hizalı; B: IFS barkod_id, terminal okumada öncelikli çözülür.
 *
 * SERVER-ONLY: node fs + bwip-js/node kullanır (malzeme-etiketi-pdf.ts peer'iyle
 * aynı desen); yalnızca API route'undan çağrılır, client bundle'a girmez.
 */
import fs from 'fs/promises'
import path from 'path'
import { PDFDocument, rgb, type PDFFont, concatTransformationMatrix } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import * as bwipjs from 'bwip-js/node'

export interface MalzemeEtiketiVeri {
  stokKodu: string
  stokAdi: string
  miktar: number
  birim: string
  lot?: string
  girisTarihi?: string // yyyy-MM-dd (default bugün)
  kaynakBilgi: string
  lokasyon: string
  etiketNo: string
  /** IFS BarcodeId — DataMatrix'e B: öneki + görünür "BARKOD NO" olarak basılır. */
  barkodId: number
  basanKullanici: string
  kaynakModul: string
}

const MM = 2.83465
// Sanal tuval: onaylanmış tasarımın kendi (yatay) koordinat sistemi — değişmedi.
const VW = 100 * MM
const VH = 80 * MM
// Fiziksel sayfa: gerçek etiket yazıcısı stoğu (TSC TL241, "USER" — 80×100 mm dikey).
const PAGE_W = 80 * MM
const PAGE_H = 100 * MM
const BLACK = rgb(0, 0, 0)
const WHITE = rgb(1, 1, 1)
const GRAY = rgb(0.45, 0.45, 0.45)
const FONT_DIR = path.join(process.cwd(), 'public', 'fonts')

let cachedReg: Buffer | null = null
let cachedBold: Buffer | null = null
async function loadFonts() {
  if (!cachedReg || !cachedBold) {
    const [reg, bold] = await Promise.all([
      fs.readFile(path.join(FONT_DIR, 'Poppins-Regular.ttf')),
      fs.readFile(path.join(FONT_DIR, 'Poppins-Bold.ttf')),
    ])
    cachedReg = reg
    cachedBold = bold
  }
  return { regular: cachedReg, bold: cachedBold }
}

/** Etiket numarası: ETK-{YY}-{6 hane}. TODO: kalıcı sayaç gerekirse DB sequence. */
export function genEtiketNo(): string {
  const yy = String(new Date().getFullYear()).slice(2)
  const n = Math.floor(100000 + Math.random() * 900000)
  return `ETK-${yy}-${n}`
}

function fmtDate(iso?: string): string {
  const d = iso ? iso.slice(0, 10) : new Date().toISOString().slice(0, 10)
  const [y, m, day] = d.split('-')
  return y && m && day ? `${day}.${m}.${y}` : d
}
function nowStamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/**
 * Metni maxW'ye sığdırır: base'ten min'e 0.5 adımlarla punto düşer; min'de de
 * sığmıyorsa allowTruncate ise sondan '…' ile kısaltır, değilse min puntoda tam basar
 * (kritik alanlar — ETIKET NO / LOT — asla kısaltılmaz).
 */
function fitText(
  text: string,
  font: PDFFont,
  maxW: number,
  base: number,
  min: number,
  allowTruncate: boolean,
): { text: string; size: number } {
  let size = base
  while (size > min && font.widthOfTextAtSize(text, size) > maxW) size = Math.max(min, size - 0.5)
  if (font.widthOfTextAtSize(text, size) <= maxW) return { text, size }
  if (!allowTruncate) return { text, size } // kritik alan: tam bas
  let t = text
  while (t.length > 1 && font.widthOfTextAtSize(t + '…', size) > maxW) t = t.slice(0, -1)
  return { text: t + '…', size }
}

export async function generateMalzemeEtiketi(veri: MalzemeEtiketiVeri): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const f = await loadFonts()
  const reg: PDFFont = await pdf.embedFont(f.regular, { subset: true })
  const bold: PDFFont = await pdf.embedFont(f.bold, { subset: true })
  const page = pdf.addPage([PAGE_W, PAGE_H])

  // Sanal (yatay, 100×80) tuvali fiziksel (dikey, 80×100) sayfaya 90° döndürerek gömer:
  // x' = PAGE_W - y ; y' = x  →  concat matrisi [a,b,c,d,e,f] = [0,1,-1,0,PAGE_W,0]
  page.pushOperators(concatTransformationMatrix(0, 1, -1, 0, PAGE_W, 0))

  const margin = 4 * MM

  // ── Üst siyah şerit ──
  const stripH = 9 * MM
  page.drawRectangle({ x: 0, y: VH - stripH, width: VW, height: stripH, color: BLACK })
  const stripY = VH - stripH / 2 - 4.5
  page.drawText('ILERI GROUP', { x: margin, y: stripY, size: 12, font: bold, color: WHITE })
  const t2 = 'MALZEME TANITIM KARTI'
  page.drawText(t2, { x: VW - margin - reg.widthOfTextAtSize(t2, 8.5), y: stripY + 1, size: 8.5, font: reg, color: WHITE })

  const contentTop = VH - stripH - 8

  // ── DataMatrix (sağ üst) ──
  const dmSize = 26 * MM
  const dmX = VW - margin - dmSize
  const dmContent = `B:${veri.barkodId}|P:${veri.stokKodu}|T:${veri.lot ?? '*'}|Q:${veri.miktar}|S:${veri.etiketNo}`
  try {
    const png = await bwipjs.toBuffer({ bcid: 'datamatrix', text: dmContent, scale: 4, backgroundcolor: 'FFFFFF' })
    const img = await pdf.embedPng(png)
    page.drawImage(img, { x: dmX, y: contentTop - dmSize, width: dmSize, height: dmSize })
  } catch {
    /* DataMatrix üretilemezse kart yine basılır */
  }
  // DM altı: görünür (insan-okunur) BARKOD NO. etiketNo alt ızgarada '(S) ETIKET NO' olarak var.
  // Uzun barkod no'larda (çok haneli) kutuya sığması için punto otomatik düşer.
  const cap = `BARKOD NO: ${veri.barkodId}`
  const capFit = fitText(cap, bold, dmSize, 7.5, 6, true)
  page.drawText(capFit.text, {
    x: dmX + (dmSize - bold.widthOfTextAtSize(capFit.text, capFit.size)) / 2,
    y: contentTop - dmSize - 10,
    size: capFit.size,
    font: bold,
    color: BLACK,
  })

  // ── DURUM kutusu (sağ, DM altı) — şimdilik sabit SERBEST ──
  // TODO: kalite modülü bağlanınca dinamik (KARANTİNA/BLOKE vb.)
  const durH = 18
  const durY = contentTop - dmSize - 14 - durH
  page.drawRectangle({ x: dmX, y: durY, width: dmSize, height: durH, borderColor: BLACK, borderWidth: 1 })
  const durTxt = 'DURUM: SERBEST'
  page.drawText(durTxt, {
    x: dmX + (dmSize - bold.widthOfTextAtSize(durTxt, 8)) / 2,
    y: durY + (durH - 8) / 2 + 1,
    size: 8,
    font: bold,
    color: BLACK,
  })

  // ── Sol sütun ──
  const leftX = margin
  const leftW = dmX - 8 - leftX

  page.drawText('(P) MALZEME NO', { x: leftX, y: contentTop - 10, size: 6.5, font: reg, color: GRAY })
  // Stok kodu — punto düşer, gerekirse kısaltılır (min 12).
  const kod = fitText(veri.stokKodu, bold, leftW, 20, 12, true)
  page.drawText(kod.text, { x: leftX, y: contentTop - 34, size: kod.size, font: bold, color: BLACK })
  // Stok adı — punto düşer (min 9), hâlâ sığmazsa '…' (bilgilendirici, kritik değil).
  const ad = fitText(veri.stokAdi || '-', reg, leftW, 10, 9, true)
  page.drawText(ad.text, { x: leftX, y: contentTop - 50, size: ad.size, font: reg, color: BLACK })

  const cellW = leftW / 3
  // allowTruncate=false → kritik alan (LOT / ETIKET NO): asla kısaltma, sadece punto düş.
  const cell = (
    x: number,
    topY: number,
    label: string,
    value: string,
    allowTruncate = true,
    min = 7,
  ) => {
    page.drawText(label, { x, y: topY, size: 6, font: reg, color: GRAY })
    const s = fitText(value, bold, cellW - 3, 9, min, allowTruncate)
    page.drawText(s.text, { x, y: topY - 13, size: s.size, font: bold, color: BLACK })
  }

  // Orta ızgara
  const midSep = contentTop - 66
  page.drawLine({ start: { x: leftX, y: midSep }, end: { x: dmX - 8, y: midSep }, thickness: 0.6, color: GRAY })
  const midY = midSep - 12
  cell(leftX, midY, '(Q) MIKTAR', `${veri.miktar} ${veri.birim}`)
  cell(leftX + cellW, midY, '(1T) LOT', veri.lot ?? '-', false) // LOT: kısaltma yasak
  cell(leftX + 2 * cellW, midY, 'GIRIS TARIHI', fmtDate(veri.girisTarihi))

  // Alt ızgara
  const botSep = midY - 30
  page.drawLine({ start: { x: leftX, y: botSep }, end: { x: dmX - 8, y: botSep }, thickness: 0.6, color: GRAY })
  const botY = botSep - 12
  cell(leftX, botY, '(V) KAYNAK', veri.kaynakBilgi) // KAYNAK: kısaltılabilir
  cell(leftX + cellW, botY, 'LOKASYON', veri.lokasyon)
  cell(leftX + 2 * cellW, botY, '(S) ETIKET NO', veri.etiketNo, false) // ETIKET NO: tam bas (min 7)

  // ── Alt bilgi şeridi ──
  const footLineY = margin + 4 * MM
  page.drawLine({ start: { x: margin, y: footLineY }, end: { x: VW - margin, y: footLineY }, thickness: 0.6, color: GRAY })
  const modulKisa = veri.kaynakModul.replace('Depo El Terminali / Stok Tasima', 'Depo Terminali/Tasima')
  const info = `Basan: ${veri.basanKullanici} · ${nowStamp()} · ${modulKisa}`
  const rightTxt = 'ILERIHub · IFS ILER2'
  const rightW = reg.widthOfTextAtSize(rightTxt, 6)
  const infoFit = fitText(info, reg, VW - 2 * margin - rightW - 8, 6, 5, true)
  page.drawText(infoFit.text, { x: margin, y: footLineY - 9, size: infoFit.size, font: reg, color: GRAY })
  page.drawText(rightTxt, { x: VW - margin - rightW, y: footLineY - 9, size: 6, font: reg, color: GRAY })

  return pdf.save()
}
