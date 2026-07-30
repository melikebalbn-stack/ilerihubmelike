// Catering (yemek) menüsü Excel parser — Python'da kanıtlanmış mantığın birebir çevirisi.
// Girdi: xlsx buffer. Çıktı: gün başına { date, gun, items, calories, warnings }.
// DİKKAT: xlsx 0-indeksli; buradaki Excel koordinatları 1-indeksli → cell() dönüştürür.
import * as XLSX from 'xlsx'

export interface ParsedMenuDay {
  date: Date
  gun: string
  items: string[]
  calories: number[]
  warnings: string[]
}

// Türkçe ay adları (büyük harf, İ/Ş/Ç/Ğ/Ü dahil)
const TR_AYLAR: Record<string, number> = {
  OCAK: 1, ŞUBAT: 2, MART: 3, NİSAN: 4, MAYIS: 5, HAZİRAN: 6,
  TEMMUZ: 7, AĞUSTOS: 8, EYLÜL: 9, EKİM: 10, KASIM: 11, ARALIK: 12,
}
// Gün → Excel 1-index sütun (yemek sütunu; kalori yanındaki sut+1)
const GUN_SUTUN: Record<string, number> = {
  PAZARTESİ: 2, SALI: 4, ÇARŞAMBA: 6, PERŞEMBE: 8, CUMA: 10, CUMARTESİ: 12,
}
// Gün → Pazartesi'ye göre gün ofseti
const GUN_NO: Record<string, number> = {
  PAZARTESİ: 0, SALI: 1, ÇARŞAMBA: 2, PERŞEMBE: 3, CUMA: 4, CUMARTESİ: 5,
}
const GUN_SIRA = ['PAZARTESİ', 'SALI', 'ÇARŞAMBA', 'PERŞEMBE', 'CUMA', 'CUMARTESİ']
const GUN_ADLARI = new Set(GUN_SIRA)
const SKIP_MARKERS = ['NOT:', 'KKAL', 'DİYETİSYEN', 'GENEL MÜDÜR', 'GIDA MÜHENDİSİ', 'BELİRTİLEN']

function norm(v: unknown): string {
  if (v == null) return ''
  return String(v).trim().toUpperCase()
}

function isSkip(s: string): boolean {
  return SKIP_MARKERS.some((m) => s.includes(m))
}

function toCalorie(v: unknown): number {
  if (typeof v === 'number' && isFinite(v)) return Math.round(v)
  if (typeof v === 'string' && /\d/.test(v)) {
    const n = parseInt(v.replace(/[^\d]/g, ''), 10)
    return isFinite(n) ? n : 0
  }
  return 0
}

function asDate(v: unknown): Date | null {
  return v instanceof Date && !isNaN(v.getTime()) ? v : null
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function parseCateringMenu(buffer: Buffer): ParsedMenuDay[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
  const maxRow = range.e.r + 1 // Excel 1-index

  // Excel 1-indexli hücre değeri (xlsx 0-indekse çevrilir)
  const cell = (rE: number, cE: number): unknown => {
    const o = sheet[XLSX.utils.encode_cell({ r: rE - 1, c: cE - 1 })]
    return o ? (o.v as unknown) : null
  }
  const cn = (rE: number, cE: number) => norm(cell(rE, cE))

  const out: ParsedMenuDay[] = []

  // 1) Başlık → yıl + ay
  let baslik = ''
  for (let r = 1; r <= 5 && !baslik; r++) {
    for (let c = 1; c <= 14; c++) {
      const s = cn(r, c)
      if (s.includes('YEMEK MENÜSÜ') || s.includes('YEMEK MENUSU')) { baslik = s; break }
    }
  }
  if (!baslik) throw new Error('Menü başlığı bulunamadı, format tanınmadı')
  const yil = baslik.match(/(\d{4})/) ? parseInt(baslik.match(/(\d{4})/)![1], 10) : NaN
  let ay = 0
  for (const [ad, no] of Object.entries(TR_AYLAR)) { if (baslik.includes(ad)) { ay = no; break } }
  if (!ay || isNaN(yil)) throw new Error('Menü ay/yıl çözülemedi')

  // 2) İlk Cumartesi özel bloğu — hücre[2,12]==='CUMARTESİ'
  if (cn(2, 12) === 'CUMARTESİ') {
    const d = asDate(cell(3, 12))
    if (d) {
      const items: string[] = []
      for (let rr = 4; rr <= maxRow; rr++) {
        const raw = cell(rr, 12)
        const n = norm(raw)
        if (!n) break // blok bitti
        if (GUN_ADLARI.has(n) || isSkip(n)) break // gün-başlığı veya skip → dur
        items.push(String(raw).trim())
      }
      if (items.length > 0) {
        out.push({ date: d, gun: 'CUMARTESİ', items, calories: items.map(() => 0), warnings: [] })
      }
    }
  }

  // 3) Haftalık gridler
  let r = 1
  while (r <= maxRow) {
    if (cn(r, 2) !== 'PAZARTESİ') { r++; continue }
    const tarihSatiri = r + 1
    const pazartesi = asDate(cell(tarihSatiri, 2))
    // sonraki PAZARTESİ satırı (item alt sınırı)
    let nextMon = maxRow + 1
    for (let rr = tarihSatiri + 1; rr <= maxRow; rr++) {
      if (cn(rr, 2) === 'PAZARTESİ') { nextMon = rr; break }
    }

    for (const gun of GUN_SIRA) {
      const sut = GUN_SUTUN[gun]
      // gün başlığı sütunda mı (ilk 4 harf, trim toleransı norm'da)
      if (!cn(r, sut).startsWith(gun.slice(0, 4))) continue

      const items: string[] = []
      const calories: number[] = []
      for (let rr = tarihSatiri + 1; rr < nextMon; rr++) {
        const raw = cell(rr, sut)
        const n = norm(raw)
        // Öğünler kesintisiz sıralı → İLK boş yemek hücresinde menü biter; DUR.
        // (Aksi halde aşağı inip imza/diyetisyen bloğunu item olarak sızdırıyordu.)
        if (!n) break
        if (isSkip(n)) continue // ek emniyet; asıl sınır ilk boş hücre
        items.push(String(raw).trim())
        calories.push(toCalorie(cell(rr, sut + 1)))
      }
      if (items.length === 0) continue

      const warnings: string[] = []
      let date: Date
      if (pazartesi) {
        date = addDays(pazartesi, GUN_NO[gun])
        const hucreTarih = asDate(cell(tarihSatiri, sut))
        if (hucreTarih && !sameDay(hucreTarih, date)) {
          warnings.push(`hücre tarihi ${iso(hucreTarih)} ≠ hesaplanan ${iso(date)}, hesaplanan kullanıldı`)
        }
      } else {
        // Pazartesi tarihi okunamadı → hücre tarihine düş
        const hucreTarih = asDate(cell(tarihSatiri, sut))
        if (!hucreTarih) continue
        date = hucreTarih
        warnings.push('Pazartesi tarihi okunamadı, hücre tarihi kullanıldı')
      }
      out.push({ date, gun, items, calories, warnings })
    }

    r = tarihSatiri + 1
  }

  return out
}
