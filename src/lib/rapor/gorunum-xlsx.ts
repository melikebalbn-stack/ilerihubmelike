/**
 * Etkileşimli görünüm → XLSX (sunucu). gorunumUygula ile aynı ağaç: grup satırları kalın ve dolgulu,
 * alt toplam satırları kalın, genel toplam kalın + üst çizgi. Grup kolonları detay kolonlarından çıkarılır
 * (değer grup satırında). Sayı biçimi kolonun bicim'inden.
 */
import ExcelJS from 'exceljs'
import { gorunumUygula, type GrupDugum, type Satir } from './gorunum'
import type { Bicim, Gorunum } from './tipler'

const NUMFMT: Record<string, string> = { '#.##0': '#,##0', '#.##0,00': '#,##0.00', '%0,0': '0.0"%"', '%0,00': '0.00"%"', 'gg.aa.yyyy': 'dd.mm.yyyy', 'gg.aa.yyyy ss:dd': 'dd.mm.yyyy hh:mm' }
const NAVY = 'FF1B4F72'

function hucre(v: unknown, bicim?: Bicim): ExcelJS.CellValue {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v
  if (typeof v === 'string' && bicim?.startsWith('gg')) { const d = new Date(v); return Number.isNaN(d.getTime()) ? v : d }
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v
  if (typeof v === 'bigint') return Number(v)
  if (typeof v === 'object' && typeof (v as { toNumber?: unknown }).toNumber === 'function') return (v as { toNumber: () => number }).toNumber()
  return String(v)
}

export async function gorunumXlsx(baslik: string, satirlar: Satir[], gorunum: Gorunum, ek?: { altBaslik?: string; parametreOzeti?: string; degerEtiketleri?: Record<string, Record<string, string>> }): Promise<Buffer> {
  const sonuc = gorunumUygula(satirlar, gorunum, { degerEtiketleri: ek?.degerEtiketleri })
  const grupAlanlari = new Set((gorunum.gruplar ?? []).slice(0, 2))
  const kolonlar = gorunum.kolonlar.filter((k) => k.gorunur && !grupAlanlari.has(k.alan))
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(baslik.slice(0, 31).replace(/[\\/*?:[\]]/g, ' ') || 'Rapor')

  ws.columns = kolonlar.map((k) => ({ key: k.alan, width: Math.max(12, Math.min(40, (k.baslik ?? k.alan).length + 4)) }))
  // Başlık bloğu
  ws.addRow([baslik]).font = { bold: true, size: 14 }
  if (ek?.altBaslik) ws.addRow([ek.altBaslik]).font = { color: { argb: 'FF5D6C7B' } }
  if (ek?.parametreOzeti) ws.addRow([ek.parametreOzeti]).font = { color: { argb: 'FF5D6C7B' }, size: 9 }
  ws.addRow([])
  const baslikSatiri = ws.addRow(kolonlar.map((k) => k.baslik ?? k.alan))
  baslikSatiri.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  baslikSatiri.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
  ws.views = [{ state: 'frozen', ySplit: baslikSatiri.number }]

  // Hücre: değer etiketi varsa Türkçesi (metin olarak), yoksa ham/biçimli değer.
  const detay = (s: Satir) => { ws.addRow(kolonlar.map((k) => ek?.degerEtiketleri?.[k.alan]?.[String(s[k.alan])] ?? hucre(s[k.alan], k.bicim))) }
  const toplamSatiri = (etiket: string, toplamlar: Record<string, number | null>, stil: 'alt' | 'genel') => {
    const r = ws.addRow(kolonlar.map((k, i) => (k.toplam && toplamlar[k.alan] !== undefined ? toplamlar[k.alan] : i === 0 ? etiket : null)))
    r.font = { bold: true }
    if (stil === 'genel') { r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F7FA' } }; r.eachCell((c) => { c.border = { top: { style: 'medium', color: { argb: NAVY } } } }) }
    else r.eachCell((c) => { c.border = { bottom: { style: 'thin', color: { argb: 'FF94A3B8' } } } })
  }
  const grupYaz = (g: GrupDugum) => {
    const r = ws.addRow([`${'  '.repeat(g.seviye)}${gorunum.kolonlar.find((k) => k.alan === g.alan)?.baslik ?? g.alan}: ${g.etiket}  ·  ${g.satirSayisi} satır`])
    r.font = { bold: true, color: { argb: NAVY } }
    r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: g.seviye === 0 ? 'FFE8EEF3' : 'FFF4F7FA' } }
    ws.mergeCells(r.number, 1, r.number, Math.max(1, kolonlar.length))
    if (g.altGruplar.length) g.altGruplar.forEach(grupYaz); else g.satirlar.forEach(detay)
    toplamSatiri(`${g.etiket} toplamı`, g.toplamlar, 'alt')
  }
  if (sonuc.gruplar.length) sonuc.gruplar.forEach(grupYaz); else sonuc.satirlar.forEach(detay)
  if (kolonlar.some((k) => k.toplam)) toplamSatiri('Genel toplam', sonuc.genelToplam, 'genel')

  kolonlar.forEach((k, i) => { const f = k.bicim && NUMFMT[k.bicim]; if (f) ws.getColumn(i + 1).numFmt = f })
  return Buffer.from(await wb.xlsx.writeBuffer())
}
