import * as XLSX from 'xlsx'
import { normalizeTr } from '@/lib/normalize-tr'
import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit-log'
import { kaydetIslemGecmisi } from './audit'
import {
  AtamaDilimHatasi,
  asimOnayiKontrol,
  atamaGunuKapsar,
  kapasiteEtkisiHesapla,
  type KapasiteEtkisiSatiri,
} from './kapasite-asim'
import { gecisPlanla } from './atama-gecis'
import { gunTarihi } from './gecerli-atama'
import { EXCEL_DOSYA_SINIRI_MESAJI, EXCEL_LIMITLERI, EXCEL_MAKS_MB, EXCEL_SATIR_SINIRI_MESAJI } from './excel-atama-limitleri'
import { TarihHatasi, baslangicTarihiCoz, bugunTR } from './tarih-kurallari'

// ============================================================================
// EXCEL'DEN TOPLU PERSONEL ATAMA (C2) — 1 Dosya yükle → 2 Önizleme → 3 Uygula
// ============================================================================
//
// • Önizleme HİÇBİR KAYIT YAZMAZ. Uygulama dosyayı YENİDEN okuyup YENİDEN doğrular (sunucuda durum
//   tutulmaz; önizleme eskimiş olamaz) ve yalnız GEÇERLİ satırları, TEK transaction'da uygular.
// • Dilim ZORUNLU: dilimsiz atama üretilmez.
// • Satır türleri: YENI (aktif atama yok → aç), DEGISIKLIK (aktif atamanın güzergâhı/durağı değişir →
//   eski kapanır, yenisi açılır), DILIM_EKLE (aynı güzergâh/durak, eksik dilim eklenir), YALNIZ_DILIM
//   (güzergâh+durak boş → mevcut AKTİF atamaya dilim ekler; göç sonrası dilimsizleri düzeltme yolu),
//   DEGISIKLIK_YOK, HATA.
// • Kapasite aşımı (C0 ortak kural): onay olmadan UYGULANMAZ.
// • KVKK: dosya içeriği loglanmaz; audit'e yalnız satır sayıları ve toplu işlem no yazılır.

export const SABLON_BASLIKLARI = ['Sicil No', 'Güzergâh Kodu', 'Durak Kodu', 'Sefer Dilimi Kodu(ları)', 'Başlangıç Tarihi'] as const

// Sınırlar tek kaynakta (istemci de okur): excel-atama-limitleri.ts
export { EXCEL_LIMITLERI }

export class ExcelAtamaHatasi extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExcelAtamaHatasi'
  }
}

export type HamSatir = {
  /** Excel'deki satır numarası (başlık satırı dahil sayılır; kullanıcı dosyada aynı numarayı görür). */
  satirNo: number
  sicil: string
  guzergahKod: string
  durakKod: string
  dilimKodlari: string[]
  /** YYYY-MM-DD (okuyucu normalize eder) ya da çözülemeyen ham metin. */
  baslangic: string
}

// ---------------------------------------------------------------------------
// Okuma (xlsx — repoda zaten kullanılan kütüphane; yeni bağımlılık yok)
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0')

/** Hücre → YYYY-MM-DD ya da (çözülemezse) ham metin. Excel tarih hücresi, serial, GG.AA.YYYY, GG/AA/YYYY, YYYY-MM-DD. */
export function tarihHucresi(v: unknown): string {
  if (v === null || v === undefined || v === '') return ''
  if (v instanceof Date) {
    // xlsx (cellDates) tarihi YEREL saat bileşenleriyle üretir
    return Number.isNaN(v.getTime()) ? '' : `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`
  }
  if (typeof v === 'number') {
    const p = XLSX.SSF.parse_date_code(v)
    return p ? `${p.y}-${pad(p.m)}-${pad(p.d)}` : String(v)
  }
  const s = String(v).trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (m) return `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`
  return s
}

const metin = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())

const BASLIK_ESLEME: { alan: 'sicil' | 'guzergah' | 'durak' | 'dilim' | 'baslangic'; uygun: (n: string) => boolean }[] = [
  { alan: 'sicil', uygun: (n) => n.startsWith('sicil') },
  { alan: 'guzergah', uygun: (n) => n.startsWith('guzergah') },
  { alan: 'durak', uygun: (n) => n.startsWith('durak') },
  { alan: 'dilim', uygun: (n) => n.includes('dilim') },
  { alan: 'baslangic', uygun: (n) => n.startsWith('baslangic') },
]

/** Dilim hücresi: virgül, noktalı virgül, satır sonu, "/" ve " + " ile ayrılmış kodlar. */
export function dilimKodlariniAyir(v: string): string[] {
  return [...new Set(v.split(/[,;\n\r/+]+/).map((x) => x.trim()).filter(Boolean))]
}

export function excelOku(girdi: Buffer | Uint8Array): HamSatir[] {
  const bayt = Buffer.from(girdi)
  if (bayt.length === 0) throw new ExcelAtamaHatasi('Dosya boş.')
  if (bayt.length > EXCEL_LIMITLERI.maksDosyaBayt) {
    throw new ExcelAtamaHatasi(EXCEL_DOSYA_SINIRI_MESAJI)
  }
  // .xlsx = zip ("PK"); .xls/.csv/başka biçimler reddedilir
  if (bayt[0] !== 0x50 || bayt[1] !== 0x4b) throw new ExcelAtamaHatasi('Yalnız .xlsx dosyası yüklenebilir. Şablonu indirip kullanın.')

  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(bayt, { type: 'buffer', cellDates: true })
  } catch {
    throw new ExcelAtamaHatasi('Dosya okunamadı; geçerli bir .xlsx olmalı.')
  }
  const ad = wb.SheetNames.find((n) => normalizeTr(n) === 'atama') ?? wb.SheetNames[0]
  const ws = ad ? wb.Sheets[ad] : undefined
  if (!ws || !ws['!ref']) throw new ExcelAtamaHatasi('İlk sayfa boş.')
  const tablo = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null, blankrows: true })

  const baslikIdx = tablo.findIndex((r) => (r ?? []).some((h) => metin(h) !== ''))
  if (baslikIdx < 0) throw new ExcelAtamaHatasi('Başlık satırı bulunamadı.')
  const baslik = (tablo[baslikIdx] ?? []).map((h) => normalizeTr(metin(h)))
  const kolon: Partial<Record<(typeof BASLIK_ESLEME)[number]['alan'], number>> = {}
  for (const { alan, uygun } of BASLIK_ESLEME) {
    const i = baslik.findIndex(uygun)
    if (i >= 0) kolon[alan] = i
  }
  const eksik = (['sicil', 'guzergah', 'durak', 'dilim', 'baslangic'] as const).filter((a) => kolon[a] === undefined)
  if (eksik.length > 0) {
    const etiket = { sicil: 'Sicil No', guzergah: 'Güzergâh Kodu', durak: 'Durak Kodu', dilim: 'Sefer Dilimi Kodu(ları)', baslangic: 'Başlangıç Tarihi' }
    throw new ExcelAtamaHatasi(`Şablondaki sütun(lar) bulunamadı: ${eksik.map((a) => etiket[a]).join(', ')}.`)
  }

  const satirlar: HamSatir[] = []
  for (let i = baslikIdx + 1; i < tablo.length; i++) {
    const r = tablo[i] ?? []
    const h: HamSatir = {
      satirNo: i + 1,
      sicil: metin(r[kolon.sicil!]),
      guzergahKod: metin(r[kolon.guzergah!]),
      durakKod: metin(r[kolon.durak!]),
      dilimKodlari: dilimKodlariniAyir(metin(r[kolon.dilim!])),
      baslangic: tarihHucresi(r[kolon.baslangic!]),
    }
    if (!h.sicil && !h.guzergahKod && !h.durakKod && h.dilimKodlari.length === 0 && !h.baslangic) continue // boş satır
    satirlar.push(h)
    if (satirlar.length > EXCEL_LIMITLERI.maksSatir) {
      throw new ExcelAtamaHatasi(EXCEL_SATIR_SINIRI_MESAJI)
    }
  }
  if (satirlar.length === 0) throw new ExcelAtamaHatasi('Dosyada veri satırı yok.')
  return satirlar
}

// ---------------------------------------------------------------------------
// Planlama (SAF — DB'siz, test edilebilir)
// ---------------------------------------------------------------------------

export type SatirTuru = 'YENI' | 'DEGISIKLIK' | 'DILIM_EKLE' | 'YALNIZ_DILIM' | 'DEGISIKLIK_YOK' | 'HATA'

type KodluKayit = { id: string; kod: string; ad: string; aktif: boolean }
type MevcutAtama = {
  id: string
  guzergahId: string
  guzergahKod: string
  durakId: string | null
  baslangicTarihi: Date
  bitisTarihi: Date | null
  dilimIdleri: string[]
}

export type PlanBaglami = {
  bugun: string
  /** sicilNo → personel */
  personel: Map<string, { id: string; adSoyad: string; aktif: boolean }>
  /** personnelId → BUGÜN geçerli aktif atama (en fazla bir) */
  aktifAtama: Map<string, MevcutAtama>
  /** personnelId → başlangıcı İLERİDE olan aktif atamaya sahip personel (ileri tarihli transfer vb.) */
  gelecekAtama: Set<string>
  /** personnelId → aktif=true ama SÜRESİ DOLMUŞ (bitiş < bugün) atamalarının en geç bitişi. Parti düşürmez: uyarı; çakışırsa satır HATA. */
  suresiDolmusBitis: Map<string, Date>
  /** normalizeTr(kod) → güzergâh */
  guzergah: Map<string, KodluKayit>
  /** güzergâhId → (normalizeTr(durakKod) → durak) */
  durak: Map<string, Map<string, { durakId: string; kod: string; aktif: boolean }>>
  /** normalizeTr(kod) → dilim */
  dilim: Map<string, KodluKayit>
  izinler: { create: boolean; passive: boolean }
}

export type SatirSonucu = {
  satirNo: number
  sicil: string
  /** Yalnız yetkili ekranda gösterilir (KVKK). */
  adSoyad: string | null
  guzergahKod: string
  durakKod: string
  dilimKodlari: string[]
  baslangic: string
  tur: SatirTuru
  hata: string | null
  /** Parti düşürmeyen açık uyarı (ör. personelin süresi dolmuş aktif ataması var). */
  uyari: string | null
  // --- uygulama planı (yalnız geçerli satırlarda)
  personnelId?: string
  guzergahId?: string
  durakId?: string | null
  dilimIdleri?: string[]
  eklenecekDilimIdleri?: string[]
  eskiAtamaId?: string
  eskiDilimIdleri?: string[]
  /** DEGISIKLIK: eski atamaya yazılacak bitiş (YYYY-MM-DD) ve hemen pasife alınıp alınmayacağı (atama-gecis.ts). */
  eskiBitis?: string
  eskiAktif?: boolean
  /** Mevcut atamanın bugünün kapasitesine girip girmediği (dilim ekleme etkisi için). */
  mevcutKapsar?: boolean
}

const bos = (s: string) => s.trim() === ''

function sonuc(h: HamSatir, o: Partial<SatirSonucu> & { tur: SatirTuru }): SatirSonucu {
  return {
    satirNo: h.satirNo, sicil: h.sicil, adSoyad: null, guzergahKod: h.guzergahKod, durakKod: h.durakKod,
    dilimKodlari: h.dilimKodlari, baslangic: h.baslangic, hata: null, uyari: null, ...o,
  }
}
const hataSatiri = (h: HamSatir, hata: string, p?: { adSoyad?: string | null }) =>
  sonuc(h, { tur: 'HATA', hata, adSoyad: p?.adSoyad ?? null })

export function satirlariPlanla(satirlar: HamSatir[], b: PlanBaglami): SatirSonucu[] {
  // Aynı sicil dosyada birden çok kez → ilgili TÜM satırlar hata (hangisinin geçerli olduğu belirsiz)
  const sicilSatirlari = new Map<string, number[]>()
  for (const h of satirlar) {
    if (bos(h.sicil)) continue
    const k = h.sicil.trim()
    sicilSatirlari.set(k, [...(sicilSatirlari.get(k) ?? []), h.satirNo])
  }

  return satirlar.map((h): SatirSonucu => {
    const sicil = h.sicil.trim()
    if (!sicil) return hataSatiri(h, 'Sicil No boş.')
    const tekrar = sicilSatirlari.get(sicil) ?? []
    if (tekrar.length > 1) return hataSatiri(h, `Aynı sicil dosyada ${tekrar.length} satırda geçiyor (satır ${tekrar.join(', ')}); tek satıra indirin.`)

    const personel = b.personel.get(sicil)
    if (!personel) return hataSatiri(h, `Sicil bulunamadı: ${sicil}.`)
    const ad = { adSoyad: personel.adSoyad }
    if (!personel.aktif) return hataSatiri(h, 'Pasif personel servise atanamaz.', ad)

    // --- dilimler (her iki satır türünde zorunlu)
    if (h.dilimKodlari.length === 0) return hataSatiri(h, 'Sefer dilimi boş (dilim zorunludur; dilimsiz atama üretilmez).', ad)
    const dilimler: KodluKayit[] = []
    for (const kod of h.dilimKodlari) {
      const d = b.dilim.get(normalizeTr(kod))
      if (!d) return hataSatiri(h, `Sefer dilimi kodu bulunamadı: ${kod}.`, ad)
      if (!d.aktif) return hataSatiri(h, `Sefer dilimi pasif: ${d.kod}.`, ad)
      dilimler.push(d)
    }
    const dilimIdleri = [...new Set(dilimler.map((d) => d.id))]
    // İleri tarihli aktif ataması olan personelin satırı belirsiz (hangisi değişecek?) → önce o atama sonuçlansın
    if (b.gelecekAtama.has(personel.id)) {
      return hataSatiri(h, 'Personelin ileri tarihli (henüz başlamamış) aktif ataması var; önce onu düzenleyin ya da başlamasını bekleyin.', ad)
    }
    const mevcut = b.aktifAtama.get(personel.id)
    // aktif=true ama bitişi geçmiş atama: tüm okuyucular tarih aralığını kullandığı için zararsız; parti düşürmez,
    // yalnız UYARI. Yeni atama onunla ÇAKIŞIRSA (DB EXCLUDE kısıtı kapalı aralık) satır HATA.
    const dolmus = b.suresiDolmusBitis.get(personel.id) ?? null
    const dolmusGun = dolmus ? dolmus.toISOString().slice(0, 10) : ''
    const dolmusUyari = dolmus
      ? `Personelin süresi dolmuş (bitişi ${dolmusGun}) aktif bir ataması var; kayıt "Süresi doldu" olarak kalır, yeni atama bunu etkilemez.`
      : null
    const dolmusCakisma = (baslangic: Date) =>
      dolmus && baslangic.getTime() <= dolmus.getTime()
        ? `Başlangıç tarihi, personelin süresi dolmuş aktif atamasıyla (bitişi ${dolmusGun}) çakışıyor; bitişten sonraki bir tarih girin.`
        : null

    // --- YALNIZ DİLİM: güzergâh + durak boş → mevcut aktif atamaya dilim ekle
    if (bos(h.guzergahKod) && bos(h.durakKod)) {
      if (!mevcut) {
        return hataSatiri(
          h,
          dolmus
            ? `Atamanın süresi dolmuş (bitişi ${dolmusGun}); dilim eklenemez. Yeni atama için Güzergâh Kodu ve Başlangıç Tarihi girin.`
            : 'Aktif atama yok; yeni atama için Güzergâh Kodu da girin.',
          ad,
        )
      }
      const eklenecek = dilimIdleri.filter((d) => !mevcut.dilimIdleri.includes(d))
      if (eklenecek.length === 0) return sonuc(h, { ...ad, tur: 'DEGISIKLIK_YOK', personnelId: personel.id, guzergahId: mevcut.guzergahId, guzergahKod: mevcut.guzergahKod })
      return sonuc(h, {
        ...ad, tur: 'YALNIZ_DILIM', personnelId: personel.id, guzergahId: mevcut.guzergahId, guzergahKod: mevcut.guzergahKod,
        dilimIdleri, eklenecekDilimIdleri: eklenecek, eskiAtamaId: mevcut.id, eskiDilimIdleri: mevcut.dilimIdleri,
        mevcutKapsar: atamaGunuKapsar(mevcut, b.bugun),
      })
    }

    // --- güzergâh / durak
    if (bos(h.guzergahKod)) return hataSatiri(h, 'Durak kodu girildi ama Güzergâh Kodu boş.', ad)
    const g = b.guzergah.get(normalizeTr(h.guzergahKod))
    if (!g) return hataSatiri(h, `Güzergâh kodu bulunamadı: ${h.guzergahKod}.`, ad)
    if (!g.aktif) return hataSatiri(h, `Güzergâh pasif: ${g.kod}.`, ad)

    let durakId: string | null = null
    if (!bos(h.durakKod)) {
      const dk = b.durak.get(g.id)?.get(normalizeTr(h.durakKod))
      if (!dk) return hataSatiri(h, `Durak bu güzergâhta yok: ${h.durakKod} (${g.kod}).`, ad)
      if (!dk.aktif) return hataSatiri(h, `Durak pasif: ${dk.kod}.`, ad)
      durakId = dk.durakId
    }

    // --- tarih (A3 kuralları: geçerli takvim günü, 2020-01-01 .. bugün+1 yıl)
    let baslangic: Date
    try {
      baslangic = baslangicTarihiCoz(h.baslangic)
    } catch (e) {
      return hataSatiri(h, e instanceof TarihHatasi ? e.message : 'Başlangıç tarihi geçersiz.', ad)
    }

    // --- mevcut aktif atamaya göre tür
    if (!mevcut) {
      if (!b.izinler.create) return hataSatiri(h, 'Yeni atama için servis.create yetkisi gerekir.', ad)
      const cakisma = dolmusCakisma(baslangic)
      if (cakisma) return hataSatiri(h, cakisma, ad)
      return sonuc(h, { ...ad, tur: 'YENI', personnelId: personel.id, guzergahId: g.id, durakId, dilimIdleri, guzergahKod: g.kod, uyari: dolmusUyari })
    }

    // aynı güzergâhta durak boşsa "durak değişmez"
    const ayniGuzergah = mevcut.guzergahId === g.id
    const hedefDurakId = ayniGuzergah && bos(h.durakKod) ? mevcut.durakId : durakId
    const ayniYer = ayniGuzergah && mevcut.durakId === hedefDurakId

    if (ayniYer) {
      const eklenecek = dilimIdleri.filter((d) => !mevcut.dilimIdleri.includes(d))
      if (eklenecek.length === 0) return sonuc(h, { ...ad, tur: 'DEGISIKLIK_YOK', personnelId: personel.id, guzergahId: g.id, guzergahKod: g.kod })
      return sonuc(h, {
        ...ad, tur: 'DILIM_EKLE', personnelId: personel.id, guzergahId: g.id, guzergahKod: g.kod, durakId: mevcut.durakId,
        dilimIdleri, eklenecekDilimIdleri: eklenecek, eskiAtamaId: mevcut.id, eskiDilimIdleri: mevcut.dilimIdleri,
        mevcutKapsar: atamaGunuKapsar(mevcut, b.bugun), uyari: dolmusUyari,
      })
    }

    // güzergâh/durak DEĞİŞİKLİĞİ: transferle AYNI geçiş kuralı (atama-gecis.ts): bugün/geçmiş → eski anında
    // pasif; ileri tarihli → eski o güne kadar aktif, yeni o günde başlar.
    if (!b.izinler.create || !b.izinler.passive) {
      return hataSatiri(h, 'Güzergâh/durak değişikliği için servis.create ve servis.passive yetkisi gerekir.', ad)
    }
    let gecis: ReturnType<typeof gecisPlanla>
    try {
      gecis = gecisPlanla(mevcut.baslangicTarihi, h.baslangic, 'Başlangıç tarihi', new Date(`${b.bugun}T12:00:00.000Z`))
    } catch (e) {
      return hataSatiri(h, e instanceof TarihHatasi ? e.message : 'Başlangıç tarihi geçersiz.', ad)
    }
    const degisiklikCakisma = dolmusCakisma(gecis.yeniBaslangic)
    if (degisiklikCakisma) return hataSatiri(h, degisiklikCakisma, ad)
    return sonuc(h, {
      ...ad, tur: 'DEGISIKLIK', personnelId: personel.id, guzergahId: g.id, guzergahKod: g.kod, durakId: hedefDurakId,
      dilimIdleri, eskiAtamaId: mevcut.id, eskiDilimIdleri: mevcut.dilimIdleri,
      eskiBitis: gecis.eskiBitis.toISOString().slice(0, 10), eskiAktif: gecis.eskiAktif, uyari: dolmusUyari,
    })
  })
}

export type ExcelOnizleme = {
  ozet: {
    toplamSatir: number
    yeni: number
    degisiklik: number
    dilimEkle: number
    degismeyen: number
    hatali: number
    kapasiteUyarisi: number
    /** Parti düşürmeyen açık uyarı taşıyan satır sayısı (ör. süresi dolmuş aktif atama). */
    uyarili: number
  }
  satirlar: SatirSonucu[]
  etki: KapasiteEtkisiSatiri[]
  asimVar: boolean
  limitler: typeof EXCEL_LIMITLERI
}

export function ozetle(satirlar: SatirSonucu[]) {
  const say = (t: SatirTuru) => satirlar.filter((s) => s.tur === t).length
  return {
    toplamSatir: satirlar.length,
    yeni: say('YENI'),
    degisiklik: say('DEGISIKLIK'),
    dilimEkle: say('DILIM_EKLE') + say('YALNIZ_DILIM'),
    degismeyen: say('DEGISIKLIK_YOK'),
    hatali: say('HATA'),
    uyarili: satirlar.filter((s) => s.tur !== 'HATA' && s.uyari).length,
  }
}

/** Geçerli satırların bugünün kapasitesine EKLEYECEĞİ kişi: (güzergâh, dilim) → sayı. */
export function eklenenKisiHaritasi(satirlar: SatirSonucu[], bugun: string): Map<string, Map<string, number>> {
  const harita = new Map<string, Map<string, number>>()
  const ekle = (guzergahId: string, dilimId: string) => {
    if (!harita.has(guzergahId)) harita.set(guzergahId, new Map())
    const m = harita.get(guzergahId)!
    m.set(dilimId, (m.get(dilimId) ?? 0) + 1)
  }
  for (const s of satirlar) {
    if (!s.guzergahId) continue
    if (s.tur === 'YENI' || s.tur === 'DEGISIKLIK') {
      // yeni atama bugünün kapasitesine yalnız başlangıcı bugün/geçmişse girer
      if (s.baslangic <= bugun) for (const d of s.dilimIdleri ?? []) ekle(s.guzergahId, d)
    } else if (s.tur === 'DILIM_EKLE' || s.tur === 'YALNIZ_DILIM') {
      if (s.mevcutKapsar) for (const d of s.eklenecekDilimIdleri ?? []) ekle(s.guzergahId, d)
    }
  }
  return harita
}

// ---------------------------------------------------------------------------
// DB: bağlam yükleme + önizleme
// ---------------------------------------------------------------------------

export async function baglamYukle(
  satirlar: HamSatir[],
  izinler: { create: boolean; passive: boolean },
  bugun: string = bugunTR(),
): Promise<PlanBaglami> {
  const sicilIdleri = [...new Set(satirlar.map((s) => s.sicil.trim()).filter(Boolean))]
  const [personeller, guzergahlar, dilimler] = await Promise.all([
    prisma.personnel.findMany({ where: { sicilNo: { in: sicilIdleri } }, select: { id: true, sicilNo: true, adSoyad: true, aktif: true } }),
    prisma.servisGuzergah.findMany({ select: { id: true, kod: true, ad: true, aktif: true } }),
    prisma.servisSeferDilimi.findMany({ select: { id: true, kod: true, ad: true, aktif: true } }),
  ])
  const guzergahById = new Map(guzergahlar.map((g) => [g.id, g]))

  const atamalar = personeller.length
    ? await prisma.servisPersonelAtama.findMany({
        where: { personnelId: { in: personeller.map((p) => p.id) }, aktif: true },
        select: {
          id: true, personnelId: true, guzergahId: true, durakId: true, baslangicTarihi: true, bitisTarihi: true,
          dilimler: { select: { dilimId: true } },
        },
      })
    : []

  // Yalnız dosyada adı geçen güzergâhların durakları
  const kodlar = new Set(satirlar.map((s) => normalizeTr(s.guzergahKod)).filter(Boolean))
  const istenenGuzergahlar = guzergahlar.filter((g) => kodlar.has(normalizeTr(g.kod)))
  const guzergahDuraklari = istenenGuzergahlar.length
    ? await prisma.servisGuzergahDurak.findMany({
        where: { guzergahId: { in: istenenGuzergahlar.map((g) => g.id) } },
        select: { guzergahId: true, aktif: true, durakId: true, durak: { select: { kod: true, aktif: true } } },
      })
    : []

  const durak = new Map<string, Map<string, { durakId: string; kod: string; aktif: boolean }>>()
  for (const gd of guzergahDuraklari) {
    if (!durak.has(gd.guzergahId)) durak.set(gd.guzergahId, new Map())
    const m = durak.get(gd.guzergahId)!
    const anahtar = normalizeTr(gd.durak.kod)
    const aktif = gd.aktif && gd.durak.aktif
    // aynı durak kodu birden çok kez bağlıysa (pasif+aktif geçmişi) AKTİF olan kazanır
    if (!m.has(anahtar) || (aktif && !m.get(anahtar)!.aktif)) m.set(anahtar, { durakId: gd.durakId, kod: gd.durak.kod, aktif })
  }

  return {
    bugun,
    personel: new Map(personeller.filter((p) => p.sicilNo).map((p) => [p.sicilNo!, { id: p.id, adSoyad: p.adSoyad, aktif: p.aktif }])),
    // BUGÜN geçerli atama; başlangıcı ileride olanlar ayrı (ileri tarihli transferde personelin iki aktif atamasi olur)
    aktifAtama: new Map(atamalar.filter((a) => atamaGunuKapsar(a, bugun)).map((a) => [a.personnelId, {
      id: a.id, guzergahId: a.guzergahId, guzergahKod: guzergahById.get(a.guzergahId)?.kod ?? '',
      durakId: a.durakId, baslangicTarihi: a.baslangicTarihi, bitisTarihi: a.bitisTarihi, dilimIdleri: a.dilimler.map((d) => d.dilimId),
    }])),
    gelecekAtama: new Set(atamalar.filter((a) => a.baslangicTarihi.toISOString().slice(0, 10) > bugun).map((a) => a.personnelId)),
    suresiDolmusBitis: atamalar
      .filter((a) => a.bitisTarihi !== null && a.bitisTarihi.getTime() < gunTarihi(bugun).getTime())
      .reduce((m, a) => {
        const onceki = m.get(a.personnelId)
        if (!onceki || a.bitisTarihi!.getTime() > onceki.getTime()) m.set(a.personnelId, a.bitisTarihi!)
        return m
      }, new Map<string, Date>()),
    guzergah: new Map(guzergahlar.map((g) => [normalizeTr(g.kod), g])),
    durak,
    dilim: new Map(dilimler.map((d) => [normalizeTr(d.kod), d])),
    izinler,
  }
}

export async function excelOnizle(
  satirlar: HamSatir[],
  izinler: { create: boolean; passive: boolean },
  bugun: string = bugunTR(),
): Promise<ExcelOnizleme & { _baglam: PlanBaglami }> {
  const baglam = await baglamYukle(satirlar, izinler, bugun)
  const sonuclar = satirlariPlanla(satirlar, baglam)

  const harita = eklenenKisiHaritasi(sonuclar, bugun)
  const dilimById = new Map([...baglam.dilim.values()].map((d) => [d.id, d]))
  const guzergahById = new Map([...baglam.guzergah.values()].map((g) => [g.id, g]))
  const etki: KapasiteEtkisiSatiri[] = []
  for (const [guzergahId, dilimMap] of harita) {
    const g = guzergahById.get(guzergahId)!
    const dl = [...dilimMap.keys()].map((id) => dilimById.get(id)!).sort((a, b) => a.kod.localeCompare(b.kod, 'tr'))
    etki.push(...(await kapasiteEtkisiHesapla({ id: g.id, kod: g.kod }, dl, dilimMap, bugun)))
  }
  etki.sort((a, b) => (a.guzergahKod ?? '').localeCompare(b.guzergahKod ?? '', 'tr') || a.dilimKod.localeCompare(b.dilimKod, 'tr'))

  const o = ozetle(sonuclar)
  return {
    ozet: { ...o, kapasiteUyarisi: etki.filter((e) => e.asim).length },
    satirlar: sonuclar,
    etki,
    asimVar: etki.some((e) => e.asim),
    limitler: EXCEL_LIMITLERI,
    _baglam: baglam,
  }
}

// ---------------------------------------------------------------------------
// Uygulama (tek transaction)
// ---------------------------------------------------------------------------

/** Yeni [başlangıç, ∞) atama aralığıyla ÇAKIŞAN aktif atama koşulu (bitiş boş ya da ≥ başlangıç; DB EXCLUDE ile aynı kapalı aralık). */
const cakismaKosulu = (personnelId: string, baslangic: string) => ({
  personnelId,
  aktif: true as const,
  OR: [{ bitisTarihi: null }, { bitisTarihi: { gte: gunTarihi(baslangic) } }],
})

export const EXCEL_ATAMA_ACIKLAMASI = 'Excel toplu atama'
export const AUDIT_ACTION_EXCEL_ATAMA = 'SERVIS_EXCEL_TOPLU_ATAMA'

export type ExcelUygulamaSonucu = {
  topluIslemId: string
  yeni: number
  degisiklik: number
  dilimEkle: number
  degismeyen: number
  atlanan: number
}

export async function excelUygula(
  satirlar: HamSatir[],
  girdi: { asimOnayi?: boolean; beklenen?: { gecerli: number; hatali: number } },
  yapanId: string,
  izinler: { create: boolean; passive: boolean },
  bugun: string = bugunTR(),
): Promise<ExcelUygulamaSonucu> {
  const onizleme = await excelOnizle(satirlar, izinler, bugun)
  const uygulanacak = onizleme.satirlar.filter((s) => ['YENI', 'DEGISIKLIK', 'DILIM_EKLE', 'YALNIZ_DILIM'].includes(s.tur))
  if (uygulanacak.length === 0) throw new ExcelAtamaHatasi('Uygulanacak geçerli satır yok.')

  // Önizlemeden sonra veri değiştiyse (başka biri atamayı değiştirdi vb.) eskimiş onayla uygulama yapılmaz
  if (girdi.beklenen) {
    const gecerli = onizleme.satirlar.filter((s) => s.tur !== 'HATA').length
    if (girdi.beklenen.gecerli !== gecerli || girdi.beklenen.hatali !== onizleme.ozet.hatali) {
      throw new ExcelAtamaHatasi('Önizlemeden sonra veriler değişti. Önizlemeyi yenileyip tekrar onaylayın.')
    }
  }

  // C0 — ortak kapasite aşımı kuralı: onay olmadan UYGULANMAZ
  asimOnayiKontrol(onizleme.etki, girdi.asimOnayi, 'Bu dosya bir veya daha fazla dilimde kapasiteyi aşacak. Devam etmek için aşım onayı gerekir.')

  const baglam = onizleme._baglam
  const dilimKodu = new Map([...baglam.dilim.values()].map((d) => [d.id, d.kod]))
  const kodlar = (idler: string[]) => idler.map((id) => dilimKodu.get(id) ?? id)
  const topluIslemId = crypto.randomUUID()
  const say = { yeni: 0, degisiklik: 0, dilimEkle: 0 }

  await prisma.$transaction(
    async (tx) => {
      for (const s of uygulanacak) {
        const satirHatasi = (m: string) => new AtamaDilimHatasi(`Satır ${s.satirNo}: ${m} Hiçbir satır uygulanmadı.`)
        if (s.tur === 'YENI' || s.tur === 'DEGISIKLIK') {
          if (s.tur === 'DEGISIKLIK') {
            const eski = await tx.servisPersonelAtama.findUnique({ where: { id: s.eskiAtamaId! }, select: { aktif: true } })
            if (!eski?.aktif) throw satirHatasi('Mevcut atama bu sırada değişti/kapandı.')
            await tx.servisPersonelAtama.update({
              where: { id: s.eskiAtamaId! },
              data: { bitisTarihi: new Date(`${s.eskiBitis}T00:00:00.000Z`), aktif: s.eskiAktif!, updatedById: yapanId },
            })
            await kaydetIslemGecmisi({
              tx, hedefTipi: 'PERSONEL_ATAMA', hedefId: s.eskiAtamaId!, islem: s.eskiAktif ? 'GUNCELLEME' : 'PASIFLESTIRME', yapanId,
              oncekiDeger: { aktif: true },
              yeniDeger: { bitisTarihi: s.eskiBitis, aktif: s.eskiAktif, topluIslemId, excelSatirNo: s.satirNo },
              aciklama: s.eskiAktif
                ? `${EXCEL_ATAMA_ACIKLAMASI} — güzergâh/durak değişikliği (planlı: ${s.baslangic} tarihinde geçer, eski atama o güne kadar aktif)`
                : `${EXCEL_ATAMA_ACIKLAMASI} — güzergâh/durak değişikliği`,
            })
          } else {
            // Önizlemeyle AYNI çakışma kuralı (aktif atama: bitiş boş ya da ≥ yeni başlangıç) — kapalı aralık EXCLUDE kısıtıyla uyumlu
            const varMi = await tx.servisPersonelAtama.findFirst({ where: cakismaKosulu(s.personnelId!, s.baslangic), select: { id: true } })
            if (varMi) throw satirHatasi('Personelin bu sırada çakışan aktif bir ataması oluştu.')
          }
          const yeni = await tx.servisPersonelAtama.create({
            data: {
              personnelId: s.personnelId!, guzergahId: s.guzergahId!, durakId: s.durakId ?? null,
              baslangicTarihi: new Date(`${s.baslangic}T00:00:00.000Z`), bitisTarihi: null,
              atamaKaynagi: 'IMPORT', createdById: yapanId,
            },
          })
          await tx.servisPersonelAtamaDilim.createMany({ data: s.dilimIdleri!.map((dilimId) => ({ atamaId: yeni.id, dilimId })) })
          await kaydetIslemGecmisi({
            tx, hedefTipi: 'PERSONEL_ATAMA', hedefId: yeni.id, islem: 'OLUSTURMA', yapanId,
            yeniDeger: {
              personnelId: s.personnelId, guzergahId: s.guzergahId, durakId: s.durakId ?? null, baslangicTarihi: s.baslangic,
              bitisTarihi: null, atamaKaynagi: 'IMPORT', topluIslemId, excelSatirNo: s.satirNo,
            },
            aciklama: EXCEL_ATAMA_ACIKLAMASI,
          })
          await kaydetIslemGecmisi({
            tx, hedefTipi: 'PERSONEL_ATAMA_DILIM', hedefId: yeni.id, islem: 'OLUSTURMA', yapanId,
            yeniDeger: { dilimIdleri: s.dilimIdleri, dilimKodlari: kodlar(s.dilimIdleri!), topluIslemId },
            aciklama: EXCEL_ATAMA_ACIKLAMASI,
          })
          s.tur === 'YENI' ? say.yeni++ : say.degisiklik++
        } else {
          // DILIM_EKLE / YALNIZ_DILIM: mevcut aktif atamaya eksik dilimleri ekle (B5 mantığı)
          const guncel = await tx.servisPersonelAtama.findUnique({
            where: { id: s.eskiAtamaId! }, select: { aktif: true, dilimler: { select: { dilimId: true } } },
          })
          if (!guncel?.aktif) throw satirHatasi('Mevcut atama bu sırada değişti/kapandı.')
          const mevcutIdler = guncel.dilimler.map((d) => d.dilimId)
          const eklenecek = s.eklenecekDilimIdleri!.filter((d) => !mevcutIdler.includes(d))
          if (eklenecek.length === 0) continue // başkası aynı dilimi ekledi — idempotent
          await tx.servisPersonelAtamaDilim.createMany({ data: eklenecek.map((dilimId) => ({ atamaId: s.eskiAtamaId!, dilimId })) })
          const sonraki = [...mevcutIdler, ...eklenecek]
          await kaydetIslemGecmisi({
            tx, hedefTipi: 'PERSONEL_ATAMA_DILIM', hedefId: s.eskiAtamaId!, islem: 'GUNCELLEME', yapanId,
            oncekiDeger: { dilimIdleri: mevcutIdler, dilimKodlari: kodlar(mevcutIdler) },
            yeniDeger: { dilimIdleri: sonraki, dilimKodlari: kodlar(sonraki), topluIslemId, excelSatirNo: s.satirNo },
            aciklama: EXCEL_ATAMA_ACIKLAMASI,
          })
          say.dilimEkle++
        }
      }
      // Denetim (PermissionAuditLog): YALNIZ sayılar + toplu işlem no — kişi bilgisi/dosya içeriği YOK.
      // tx ile yazılır: yazılamazsa tüm işlem geri alınır (fail-closed).
      await logAuditEvent({
        tx, action: AUDIT_ACTION_EXCEL_ATAMA, actorId: yapanId, targetType: 'SERVIS', targetId: topluIslemId,
        details: { topluIslemId, dosyaSatiri: satirlar.length, ...say, degismeyen: onizleme.ozet.degismeyen, atlanan: onizleme.ozet.hatali },
      })
    },
    { timeout: 60_000, maxWait: 10_000 },
  )

  return { topluIslemId, ...say, degismeyen: onizleme.ozet.degismeyen, atlanan: onizleme.ozet.hatali }
}

// ---------------------------------------------------------------------------
// Dosyalar: şablon + hata raporu
// ---------------------------------------------------------------------------

export function sablonOlustur(kodlar: {
  guzergahlar: { kod: string; ad: string }[]
  duraklar: { guzergahKod: string; kod: string; ad: string }[]
  dilimler: { kod: string; ad: string }[]
}): Buffer {
  const wb = XLSX.utils.book_new()
  const atama = XLSX.utils.aoa_to_sheet([[...SABLON_BASLIKLARI]])
  atama['!cols'] = [{ wch: 14 }, { wch: 26 }, { wch: 18 }, { wch: 30 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, atama, 'Atama')

  const aciklama = XLSX.utils.aoa_to_sheet([
    ['Excel\'den Toplu Atama — nasıl doldurulur'],
    [''],
    ['Her satır bir personeldir. Aynı sicil dosyada yalnız bir kez geçmelidir.'],
    ['Sicil No: Personel sicil numarası.'],
    ['Güzergâh Kodu / Durak Kodu: "Kodlar" sayfasındaki kodlar. Durak boş bırakılabilir.'],
    ['Sefer Dilimi Kodu(ları): ZORUNLU. Birden çok dilim virgülle ayrılır (ör. SABAH_GIDIS, AKSAM_DONUS).'],
    ['Başlangıç Tarihi: GG.AA.YYYY ya da YYYY-AA-GG (2020-01-01 ile bugünden 1 yıl sonrası arası).'],
    [''],
    ['YALNIZ DİLİM EKLEME: Güzergâh ve Durak boş, Sefer Dilimi dolu bırakılırsa personelin mevcut AKTİF atamasına dilim eklenir.'],
    ['Mevcut atamadan farklı güzergâh/durak yazılırsa eski atama kapanır, yenisi açılır (başlangıç tarihi bugünden ileri olamaz).'],
    ['Önce Önizleme yapılır; hiçbir kayıt yazılmaz. Hatalı satırlar atlanır, hata raporu indirilir.'],
    [`Dosya en fazla ${EXCEL_LIMITLERI.maksSatir} satır (başlık hariç) ve ${EXCEL_MAKS_MB} MB, yalnız .xlsx. Daha büyük listeleri parçalara bölün.`],
  ])
  aciklama['!cols'] = [{ wch: 120 }]
  XLSX.utils.book_append_sheet(wb, aciklama, 'Açıklama')

  const kod = XLSX.utils.aoa_to_sheet([
    ['SEFER DİLİMLERİ', ''],
    ['Kod', 'Ad'],
    ...kodlar.dilimler.map((d) => [d.kod, d.ad]),
    [''],
    ['GÜZERGÂHLAR', ''],
    ['Kod', 'Ad'],
    ...kodlar.guzergahlar.map((g) => [g.kod, g.ad]),
    [''],
    ['DURAKLAR (güzergâha göre)', '', ''],
    ['Güzergâh Kodu', 'Durak Kodu', 'Durak Adı'],
    ...kodlar.duraklar.map((d) => [d.guzergahKod, d.kod, d.ad]),
  ])
  kod['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 34 }]
  XLSX.utils.book_append_sheet(wb, kod, 'Kodlar')
  return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer
}

export const HATA_RAPORU_BASLIKLARI = ['Satır No', 'Sicil No', 'Güzergâh Kodu', 'Durak Kodu', 'Sefer Dilimi Kodu(ları)', 'Başlangıç Tarihi', 'Hata'] as const

export function hataRaporuOlustur(satirlar: SatirSonucu[]): Buffer {
  const hatalar = satirlar.filter((s) => s.tur === 'HATA')
  const ws = XLSX.utils.aoa_to_sheet([
    [...HATA_RAPORU_BASLIKLARI],
    ...hatalar.map((s) => [s.satirNo, s.sicil, s.guzergahKod, s.durakKod, s.dilimKodlari.join(', '), s.baslangic, s.hata ?? '']),
  ])
  ws['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 24 }, { wch: 18 }, { wch: 28 }, { wch: 16 }, { wch: 80 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Hatalar')
  return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer
}

export const hataRaporuDosyaAdi = (gun: string) => `Atama-Hata-Raporu-${gun}.xlsx`
export const sablonDosyaAdi = () => 'Personel-Atama-Sablonu.xlsx'
