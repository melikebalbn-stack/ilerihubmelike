/**
 * Depo "Palet Etiketi" PDF — 80×100 mm dikey (TSC TL241 stoğu; Malzeme Tanıtım Kartı ile aynı yazıcı).
 * İçerik: büyük palet no ("P413"), tür, lokasyon, içerik özeti (≤5 satır), tarih, basan.
 * Barkodlar: DataMatrix + Code128, ikisinde de ÖNEKLİ "P{id}" — malzeme barkodu (çıplak sayı) ile
 * karışmaz; terminal okutmada etiket-parse "P413" → palet 413 olarak tanır.
 * IFS'e YAZMAZ (palet no zaten IFS'te kalıcı HandlingUnitId). SERVER-ONLY (fs + bwip-js/node).
 */
import { PDFDocument, rgb, type PDFFont } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import * as bwipjs from 'bwip-js/node'
import { fitText, loadFonts, nowStamp } from './etiket-pdf'
import { PALET_ONEKI } from './etiket-parse'

export interface PaletEtiketiVeri {
  paletNo: number
  tur: string
  turAdi: string
  lokasyon: string
  /** Malzeme + miktar + ölçü birimi; ilk 5 satır basılır, fazlası "+N satır" olarak özetlenir. */
  icerik: { partNo: string; partAdi: string; miktar: number; birim: string }[]
  basanKullanici: string
}

const MM = 2.83465
const W = 80 * MM
const H = 100 * MM
const BLACK = rgb(0, 0, 0)
const WHITE = rgb(1, 1, 1)
const GRAY = rgb(0.45, 0.45, 0.45)
const MAX_SATIR = 5

const fmtMiktar = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 4 })

export const paletBarkodMetni = (id: number) => `${PALET_ONEKI}${id}`

export async function generatePaletEtiketi(v: PaletEtiketiVeri): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const f = await loadFonts()
  const reg: PDFFont = await pdf.embedFont(f.regular, { subset: true })
  const bold: PDFFont = await pdf.embedFont(f.bold, { subset: true })
  const page = pdf.addPage([W, H])
  const m = 4 * MM
  const kod = paletBarkodMetni(v.paletNo)

  // ── Üst siyah şerit ──
  const stripH = 8 * MM
  page.drawRectangle({ x: 0, y: H - stripH, width: W, height: stripH, color: BLACK })
  const sy = H - stripH / 2 - 4
  page.drawText('ILERI GROUP', { x: m, y: sy, size: 11, font: bold, color: WHITE })
  const t2 = 'PALET ETİKETİ'
  page.drawText(t2, { x: W - m - reg.widthOfTextAtSize(t2, 8.5), y: sy + 0.5, size: 8.5, font: reg, color: WHITE })

  // ── Palet no (büyük) + DataMatrix (sağ) ──
  const top = H - stripH - 4
  const dm = 20 * MM
  const dmX = W - m - dm
  try {
    const png = await bwipjs.toBuffer({ bcid: 'datamatrix', text: kod, scale: 4, backgroundcolor: 'FFFFFF' })
    page.drawImage(await pdf.embedPng(png), { x: dmX, y: top - dm, width: dm, height: dm })
  } catch { /* DataMatrix üretilemezse Code128 + metin yine basılır */ }
  const solW = dmX - m - 6
  page.drawText('PALET NO', { x: m, y: top - 10, size: 6.5, font: reg, color: GRAY })
  const no = fitText(kod, bold, solW, 40, 20, false)
  page.drawText(no.text, { x: m, y: top - 10 - no.size, size: no.size, font: bold, color: BLACK })

  // ── Code128 (tam genişlik, uzaktan okuma) ──
  const bcTop = top - dm - 4
  const bcH = 11 * MM
  try {
    const png = await bwipjs.toBuffer({ bcid: 'code128', text: kod, scale: 3, height: 10, includetext: false, backgroundcolor: 'FFFFFF' })
    page.drawImage(await pdf.embedPng(png), { x: m, y: bcTop - bcH, width: W - 2 * m, height: bcH })
  } catch { /* Code128 üretilemezse DataMatrix + metin yeterli */ }

  // ── Tür | Lokasyon ──
  const rowTop = bcTop - bcH - 6
  page.drawLine({ start: { x: m, y: rowTop }, end: { x: W - m, y: rowTop }, thickness: 0.6, color: GRAY })
  const hucreW = (W - 2 * m) / 2
  const hucre = (x: number, etiket: string, deger: string) => {
    page.drawText(etiket, { x, y: rowTop - 10, size: 6, font: reg, color: GRAY })
    const s = fitText(deger || '-', bold, hucreW - 4, 10, 7, true)
    page.drawText(s.text, { x, y: rowTop - 23, size: s.size, font: bold, color: BLACK })
  }
  hucre(m, 'TÜR', v.turAdi ? `${v.tur} · ${v.turAdi}` : v.tur)
  hucre(m + hucreW, 'LOKASYON', v.lokasyon)

  // ── İçerik özeti (≤5 satır) ──
  const icTop = rowTop - 30
  page.drawLine({ start: { x: m, y: icTop }, end: { x: W - m, y: icTop }, thickness: 0.6, color: GRAY })
  page.drawText(`İÇERİK (${v.icerik.length} kalem)`, { x: m, y: icTop - 10, size: 6, font: reg, color: GRAY })
  let y = icTop - 21
  const satirlar = v.icerik.slice(0, MAX_SATIR)
  if (!satirlar.length) page.drawText('Boş palet', { x: m, y, size: 8, font: reg, color: BLACK })
  for (const s of satirlar) {
    const mik = `${fmtMiktar(s.miktar)} ${s.birim}`
    const mikW = bold.widthOfTextAtSize(mik, 8)
    page.drawText(mik, { x: W - m - mikW, y, size: 8, font: bold, color: BLACK })
    const ad = fitText(s.partAdi ? `${s.partNo} · ${s.partAdi}` : s.partNo, reg, W - 2 * m - mikW - 6, 8, 6.5, true)
    page.drawText(ad.text, { x: m, y, size: ad.size, font: reg, color: BLACK })
    y -= 11
  }
  if (v.icerik.length > MAX_SATIR) page.drawText(`+${v.icerik.length - MAX_SATIR} kalem daha`, { x: m, y, size: 7, font: reg, color: GRAY })

  // ── Alt bilgi ──
  const footY = m + 4 * MM
  page.drawLine({ start: { x: m, y: footY }, end: { x: W - m, y: footY }, thickness: 0.6, color: GRAY })
  const sag = 'ILERIHub · IFS ILER2'
  const sagW = reg.widthOfTextAtSize(sag, 6)
  const info = fitText(`Basan: ${v.basanKullanici} · ${nowStamp()}`, reg, W - 2 * m - sagW - 6, 6, 5, true)
  page.drawText(info.text, { x: m, y: footY - 9, size: info.size, font: reg, color: GRAY })
  page.drawText(sag, { x: W - m - sagW, y: footY - 9, size: 6, font: reg, color: GRAY })

  return pdf.save()
}
