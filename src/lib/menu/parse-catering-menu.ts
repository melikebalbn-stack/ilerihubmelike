// Catering (yemek) menüsü Excel parser.
// Girdi: xlsx buffer. Çıktı: gün başına { date, gun, items, calories, warnings } + özet.
// DİKKAT: xlsx 0-indeksli; buradaki Excel koordinatları 1-indeksli → cell() dönüştürür.
//
// ── HAFTA BLOĞU TESPİTİ (2026-09 düzeltmesi) ────────────────────────────────
// ESKİ DAVRANIŞ: blok yalnız "B sütununda PAZARTESİ" yazıyorsa bulunurdu ve gün
// sütunları sabit bir tablodan (PAZARTESİ=2, SALI=4, …) okunurdu. 2026 Eylül
// menüsünde ay SALI başlıyor ve ilk hafta bloğunun solunda logo hücresi var →
// o blokta PAZARTESİ etiketi yok, sütunlar da +2 kaymış. Sonuç: ilk hafta HİÇ
// görülmedi, 1-5 Eylül sessizce düştü (hata bile üretilmedi).
//
// YENİ DAVRANIŞ: bir satırda HERHANGİ bir gün adı geçiyorsa o satır hafta
// başlığıdır; gün sütunları başlık satırı taranarak GERÇEK konumlarından
// bulunur (kalori sütunu = yemek sütunu + 1). Tarih, o günün KENDİ tarih
// hücresinden alınır; blok içindeki başka bir günden hesaplanan tarih yalnız
// çapraz kontrol içindir. Böylece sabit sütun/etiket varsayımı kalmadı.
import * as XLSX from 'xlsx'

export interface ParsedMenuDay {
  date: Date
  gun: string
  items: string[]
  calories: number[]
  warnings: string[]
}

export interface CateringParseOzeti {
  uretilenGun: number
  ilkTarih: string | null
  sonTarih: string | null
  /** Başlıkta bulunan ama içe aktarılmayan gün sütunları (örn. PAZAR). */
  atlananGunSutunlari: string[]
  /** Dosya geneline ait uyarılar — kullanıcıya gösterilmeli. */
  uyarilar: string[]
}

export interface CateringParseSonucu {
  gunler: ParsedMenuDay[]
  ozet: CateringParseOzeti
}

// Türkçe ay adları (büyük harf, İ/Ş/Ç/Ğ/Ü dahil)
const TR_AYLAR: Record<string, number> = {
  OCAK: 1, ŞUBAT: 2, MART: 3, NİSAN: 4, MAYIS: 5, HAZİRAN: 6,
  TEMMUZ: 7, AĞUSTOS: 8, EYLÜL: 9, EKİM: 10, KASIM: 11, ARALIK: 12,
}
// Gün → Pazartesi'ye göre ofset. PAZAR tespit için listede; içe aktarma
// kapsamı aşağıdaki IMPORT_EDILEN_GUNLER ile ayrı tutuluyor.
const GUN_NO: Record<string, number> = {
  PAZARTESİ: 0, SALI: 1, ÇARŞAMBA: 2, PERŞEMBE: 3, CUMA: 4, CUMARTESİ: 5, PAZAR: 6,
}
const GUN_SIRA = ['PAZARTESİ', 'SALI', 'ÇARŞAMBA', 'PERŞEMBE', 'CUMA', 'CUMARTESİ', 'PAZAR']

// İçe aktarılan günler. PAZAR BİLEREK DIŞARIDA: mevcut davranış böyleydi
// (eski GUN_SIRA'da PAZAR yoktu) ve kapsam genişletmek ayrı bir karar. Dosyada
// PAZAR sütunu bulunursa artık SESSİZCE atlanmaz — özet uyarısına yazılır.
const IMPORT_EDILEN_GUNLER = new Set(['PAZARTESİ', 'SALI', 'ÇARŞAMBA', 'PERŞEMBE', 'CUMA', 'CUMARTESİ'])

const SKIP_MARKERS = ['NOT:', 'KKAL', 'DİYETİSYEN', 'GENEL MÜDÜR', 'GIDA MÜHENDİSİ', 'BELİRTİLEN']

function norm(v: unknown): string {
  if (v == null) return ''
  return String(v).trim().toUpperCase()
}

function isSkip(s: string): boolean {
  return SKIP_MARKERS.some((m) => s.includes(m))
}

// Türkçe harfleri ASCII'ye indirger. GEREKLİ: "ilk 4 harf" toleransı PAZARTESİ↔PAZAR
// ve CUMA↔CUMARTESİ çiftlerini birbirine karıştırıyordu (ikisi de aynı 4 harfle
// başlıyor) — Cumartesi'ler CUMA sanılıp düşüyor, PAZAR ise PAZARTESİ sanılıyordu.
// Bunun yerine TAM eşleşme yapılır; Türkçe normalizasyon İ/I gibi yazım
// farklarını tolere eder.
function trSade(s: string): string {
  return s
    .replace(/[İI]/g, 'I').replace(/Ş/g, 'S').replace(/Ç/g, 'C')
    .replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ö/g, 'O')
    .replace(/[^A-Z0-9]/g, '')
}
const GUN_SADE = new Map(GUN_SIRA.map((g) => [trSade(g), g]))

/** Hücre metni bir gün adı mı — Türkçe-normalize TAM eşleşme. */
function gunAdiCoz(s: string): string | null {
  if (!s) return null
  return GUN_SADE.get(trSade(s)) ?? null
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

export function parseCateringMenu(buffer: Buffer): CateringParseSonucu {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
  const maxRow = range.e.r + 1 // Excel 1-index
  const maxCol = range.e.c + 1

  // Excel 1-indexli hücre değeri (xlsx 0-indekse çevrilir)
  const cell = (rE: number, cE: number): unknown => {
    const o = sheet[XLSX.utils.encode_cell({ r: rE - 1, c: cE - 1 })]
    return o ? (o.v as unknown) : null
  }
  const cn = (rE: number, cE: number) => norm(cell(rE, cE))

  const out: ParsedMenuDay[] = []
  const genelUyarilar: string[] = []
  const atlananlar = new Set<string>()

  // 1) Başlık → yıl + ay (yalnız doğrulama; tarihler hücrelerden okunuyor)
  let baslik = ''
  for (let r = 1; r <= 5 && !baslik; r++) {
    for (let c = 1; c <= Math.min(maxCol, 20); c++) {
      const s = cn(r, c)
      if (s.includes('YEMEK MENÜSÜ') || s.includes('YEMEK MENUSU')) { baslik = s; break }
    }
  }
  if (!baslik) throw new Error('Menü başlığı bulunamadı, format tanınmadı')
  const yil = baslik.match(/(\d{4})/) ? parseInt(baslik.match(/(\d{4})/)![1], 10) : NaN
  let ay = 0
  for (const [ad, no] of Object.entries(TR_AYLAR)) { if (baslik.includes(ad)) { ay = no; break } }
  if (!ay || isNaN(yil)) throw new Error('Menü ay/yıl çözülemedi')

  /** Bir satırdaki gün başlıklarını GERÇEK sütunlarıyla döndürür. */
  const basliktakiGunler = (rE: number): { gun: string; sut: number }[] => {
    const bulunan: { gun: string; sut: number }[] = []
    const gorulen = new Set<string>()
    for (let c = 1; c <= maxCol; c++) {
      const g = gunAdiCoz(cn(rE, c))
      if (g && !gorulen.has(g)) { gorulen.add(g); bulunan.push({ gun: g, sut: c }) }
    }
    return bulunan
  }

  // 2) Hafta blokları — başlık satırı = içinde EN AZ BİR gün adı geçen satır.
  //    (Eski sürümdeki "ilk Cumartesi" özel bloğu KALDIRILDI: tek günlük bir
  //     başlık satırı da bu genel taramayla bulunuyor, elle istisnaya gerek yok.)
  let r = 1
  while (r <= maxRow) {
    const gunler = basliktakiGunler(r)
    if (gunler.length === 0) { r++; continue }

    const tarihSatiri = r + 1
    // Blok sonu: bir sonraki başlık satırı
    let blokSonu = maxRow + 1
    for (let rr = tarihSatiri + 1; rr <= maxRow; rr++) {
      if (basliktakiGunler(rr).length > 0) { blokSonu = rr; break }
    }

    // Blok çapası: tarihi okunabilen ilk gün (tarih hücresi bozuksa diğer
    // günlerden ofsetle tamamlamak için)
    let capa: { gun: string; date: Date } | null = null
    for (const { gun, sut } of gunler) {
      const d = asDate(cell(tarihSatiri, sut))
      if (d) { capa = { gun, date: d }; break }
    }

    for (const { gun, sut } of gunler) {
      if (!IMPORT_EDILEN_GUNLER.has(gun)) { atlananlar.add(gun); continue }

      const items: string[] = []
      const calories: number[] = []
      for (let rr = tarihSatiri + 1; rr < blokSonu; rr++) {
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
      // BİRİNCİL KAYNAK: günün kendi tarih hücresi.
      const hucreTarih = asDate(cell(tarihSatiri, sut))
      let date: Date
      if (hucreTarih) {
        date = hucreTarih
        if (capa) {
          const hesaplanan = addDays(capa.date, GUN_NO[gun] - GUN_NO[capa.gun])
          if (!sameDay(hesaplanan, date)) {
            warnings.push(`hücre tarihi ${iso(date)} ≠ ${capa.gun}'den hesaplanan ${iso(hesaplanan)}, hücre kullanıldı`)
          }
        }
      } else if (capa) {
        date = addDays(capa.date, GUN_NO[gun] - GUN_NO[capa.gun])
        warnings.push(`tarih hücresi okunamadı, ${capa.gun} tarihinden hesaplandı (${iso(date)})`)
      } else {
        genelUyarilar.push(`${gun}: tarih çözülemedi (satır ${tarihSatiri}), gün ATLANDI`)
        continue
      }

      // Başlıktaki ay/yıl ile tutmuyorsa uyar — sessiz yanlış tarihi engeller.
      if (date.getFullYear() !== yil || date.getMonth() + 1 !== ay) {
        warnings.push(`tarih ${iso(date)} başlıktaki ${yil}-${String(ay).padStart(2, '0')} ile uyuşmuyor`)
      }

      out.push({ date, gun, items, calories, warnings })
    }

    r = tarihSatiri + 1
  }

  out.sort((a, b) => a.date.getTime() - b.date.getTime())

  if (atlananlar.size > 0) {
    genelUyarilar.push(
      `Dosyada bulunan ama içe aktarılmayan gün sütunu: ${[...atlananlar].join(', ')} ` +
      `(kapsam dışı — istenirse ayrıca değerlendirilmeli)`
    )
  }

  const ozet: CateringParseOzeti = {
    uretilenGun: out.length,
    ilkTarih: out.length ? iso(out[0].date) : null,
    sonTarih: out.length ? iso(out[out.length - 1].date) : null,
    atlananGunSutunlari: [...atlananlar],
    uyarilar: genelUyarilar,
  }

  return { gunler: out, ozet }
}
