import { prisma } from '@/lib/prisma'
import type { WorkBook } from 'xlsx'

// `import XLSX from 'xlsx'` Next.js server ortamında (webpack/SWC CJS-ESM interop
// tutarsızlığı) default export'u undefined döndürebiliyor. CommonJS require ile
// yükleniyor — xlsx paketi zaten module.exports tabanlı (CJS), bu güvenilir yol.
// eslint-disable-next-line
const XLSX = require('xlsx') as typeof import('xlsx')

const URUN_TIPLERI = [
  'STANDART_STOK',
  'PERIYODIK_TUKETIM',
  'NUMARALI_URUN',
  'ZIMMETLI_URUN',
  'BEDENLI_URUN',
  'KKD_URUNU',
] as const

const VARYANT_TIPLERI = ['YOK', 'BEDEN', 'NUMARA', 'RENK', 'BEDEN_RENK', 'NUMARA_RENK'] as const

const GEREKLI_SAYFALAR = ['Urunler', 'Varyantlar', 'Stoklar', 'ZimmetGecmisi'] as const

export type ImportHata = {
  sayfa: string
  satirNo: number
  alan: string
  mesaj: string
}

export type ImportAtlanan = {
  sayfa: string
  satirNo: number
  sebep: string
}

export type ImportOzet = {
  yeniUrun: number
  guncellenecekUrun: number
  varyant: number
  stok: number
  zimmet: number
  atlananZimmet: number
  eslesmeyenSicil: string[]
}

export type ValidateSonuc = {
  gecerli: { urun: number; varyant: number; stok: number; zimmet: number }
  hatalar: ImportHata[]
  uyarilar: ImportHata[]
  atlananlar: ImportAtlanan[]
  ozet: ImportOzet
}

export type ExecuteSonuc = {
  yeniUrun: number
  guncellenecekUrun: number
  varyant: number
  stok: number
  zimmet: number
  atlananZimmet: number
  zimmetAtlananlar: ImportAtlanan[]
}

type UrunSatiri = {
  satirNo: number
  urunKodu: string
  urunAdi: string
  kategori: string
  tip: string
  olcuBirimi: string
  varyantTipi: string
  paketIciAdet: number | null
  barkod: string
  tedarikci: string
  marka: string
  hedefBolum: string
  aciklama: string
}

type VaryantSatiri = {
  satirNo: number
  urunKodu: string
  varyantAdi: string
  beden: string
  numara: string
  renk: string
}

type StokSatiri = {
  satirNo: number
  urunKodu: string
  varyantAdi: string
  depo: string
  raf: string
  mevcut: number | null
  minStok: number | null
  kritikStok: number | null
  maxStok: number | null
}

type ZimmetSatiri = {
  satirNo: number
  sicilNo: string
  urunKodu: string
  varyantAdi: string
  miktar: number | null
  teslimTarihi: string
  aciklama: string
}

function upper(v: string) {
  return v.trim().toLocaleUpperCase('tr-TR')
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function cellToNumber(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function rowIsEmpty(row: unknown[]): boolean {
  return row.every((c) => cellToString(c) === '')
}

// Şablondaki gri "örnek" satırlar farklı sayfalarda farklı ifadelerle
// işaretli ("Örnek satır - silin", "Tarihsiz örnek - ..."); ortak nokta
// "örnek" kelimesi geçmesi.
function rowHasOrnekMarker(row: unknown[]): boolean {
  return row.some(
    (c) => typeof c === 'string' && c.toLocaleLowerCase('tr-TR').includes('örnek'),
  )
}

function parseTarih(v: string): Date | null {
  const s = v.trim()
  if (!s) return null
  const match = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (!match) return null
  const [, gg, aa, yyyy] = match
  const date = new Date(`${yyyy}-${aa}-${gg}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function col(headers: string[], name: string): number {
  return headers.findIndex((h) => h === name)
}

function readSheet(
  wb: WorkBook,
  sheetName: string,
): { headers: string[]; rows: { satirNo: number; hucreler: unknown[] }[] } | null {
  const ws = wb.Sheets[sheetName]
  if (!ws) return null

  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })
  const headers = (raw[0] ?? []).map((h) => cellToString(h))
  // raw[0]: başlık satırı, raw[1]: ZORUNLU/opsiyonel işaret satırı — ikisi de atlanır.
  const dataRows = raw.slice(2)

  const rows = dataRows
    .map((hucreler, i) => ({ satirNo: i + 3, hucreler }))
    .filter(({ hucreler }) => !rowIsEmpty(hucreler))

  return { headers, rows }
}

type ParsedWorkbook = {
  urunSatirlari: UrunSatiri[]
  varyantSatirlari: VaryantSatiri[]
  stokSatirlari: StokSatiri[]
  zimmetSatirlari: ZimmetSatiri[]
  eksikSayfalar: string[]
}

function parseWorkbook(buffer: Buffer): ParsedWorkbook {
  const wb = XLSX.read(buffer, { type: 'buffer' })

  const eksikSayfalar = GEREKLI_SAYFALAR.filter((s) => !wb.Sheets[s])
  if (eksikSayfalar.length > 0) {
    return { urunSatirlari: [], varyantSatirlari: [], stokSatirlari: [], zimmetSatirlari: [], eksikSayfalar }
  }

  // 1) Urunler — hangi urunKodu'nun "örnek" olduğunu da burada tespit ederiz;
  // diğer sayfalardaki aynı urunKodu'na referans veren satırlar da örnek sayılır.
  const urunSheet = readSheet(wb, 'Urunler')!
  const urunIdx = {
    urunKodu: col(urunSheet.headers, 'urunKodu'),
    urunAdi: col(urunSheet.headers, 'urunAdi'),
    kategori: col(urunSheet.headers, 'kategori'),
    tip: col(urunSheet.headers, 'tip'),
    olcuBirimi: col(urunSheet.headers, 'olcuBirimi'),
    varyantTipi: col(urunSheet.headers, 'varyantTipi'),
    paketIciAdet: col(urunSheet.headers, 'paketIciAdet'),
    barkod: col(urunSheet.headers, 'barkod'),
    tedarikci: col(urunSheet.headers, 'tedarikci'),
    marka: col(urunSheet.headers, 'marka'),
    hedefBolum: col(urunSheet.headers, 'hedefBolum'),
    aciklama: col(urunSheet.headers, 'aciklama'),
  }

  const urunSatirlari: UrunSatiri[] = []
  const ornekUrunKodlari = new Set<string>()

  for (const { satirNo, hucreler } of urunSheet.rows) {
    const urunKodu = cellToString(hucreler[urunIdx.urunKodu])

    if (rowHasOrnekMarker(hucreler)) {
      if (urunKodu) ornekUrunKodlari.add(upper(urunKodu))
      continue
    }

    urunSatirlari.push({
      satirNo,
      urunKodu,
      urunAdi: cellToString(hucreler[urunIdx.urunAdi]),
      kategori: cellToString(hucreler[urunIdx.kategori]),
      tip: cellToString(hucreler[urunIdx.tip]),
      olcuBirimi: cellToString(hucreler[urunIdx.olcuBirimi]) || 'ADET',
      varyantTipi: cellToString(hucreler[urunIdx.varyantTipi]) || 'YOK',
      paketIciAdet: cellToNumber(hucreler[urunIdx.paketIciAdet]),
      barkod: cellToString(hucreler[urunIdx.barkod]),
      tedarikci: cellToString(hucreler[urunIdx.tedarikci]),
      marka: cellToString(hucreler[urunIdx.marka]),
      hedefBolum: cellToString(hucreler[urunIdx.hedefBolum]),
      aciklama: cellToString(hucreler[urunIdx.aciklama]),
    })
  }

  function ornekMi(hucreler: unknown[], urunKoduIdx: number): boolean {
    if (rowHasOrnekMarker(hucreler)) return true
    const kod = cellToString(hucreler[urunKoduIdx])
    return kod !== '' && ornekUrunKodlari.has(upper(kod))
  }

  // 2) Varyantlar
  const varyantSheet = readSheet(wb, 'Varyantlar')!
  const varyantIdx = {
    urunKodu: col(varyantSheet.headers, 'urunKodu'),
    varyantAdi: col(varyantSheet.headers, 'varyantAdi'),
    beden: col(varyantSheet.headers, 'beden'),
    numara: col(varyantSheet.headers, 'numara'),
    renk: col(varyantSheet.headers, 'renk'),
  }

  const varyantSatirlari: VaryantSatiri[] = []
  for (const { satirNo, hucreler } of varyantSheet.rows) {
    if (ornekMi(hucreler, varyantIdx.urunKodu)) continue

    varyantSatirlari.push({
      satirNo,
      urunKodu: cellToString(hucreler[varyantIdx.urunKodu]),
      varyantAdi: cellToString(hucreler[varyantIdx.varyantAdi]),
      beden: cellToString(hucreler[varyantIdx.beden]),
      numara: cellToString(hucreler[varyantIdx.numara]),
      renk: cellToString(hucreler[varyantIdx.renk]),
    })
  }

  // 3) Stoklar
  const stokSheet = readSheet(wb, 'Stoklar')!
  const stokIdx = {
    urunKodu: col(stokSheet.headers, 'urunKodu'),
    varyantAdi: col(stokSheet.headers, 'varyantAdi'),
    depo: col(stokSheet.headers, 'depo'),
    raf: col(stokSheet.headers, 'raf'),
    mevcut: col(stokSheet.headers, 'mevcut'),
    minStok: col(stokSheet.headers, 'minStok'),
    kritikStok: col(stokSheet.headers, 'kritikStok'),
    maxStok: col(stokSheet.headers, 'maxStok'),
  }

  const stokSatirlari: StokSatiri[] = []
  for (const { satirNo, hucreler } of stokSheet.rows) {
    if (ornekMi(hucreler, stokIdx.urunKodu)) continue

    stokSatirlari.push({
      satirNo,
      urunKodu: cellToString(hucreler[stokIdx.urunKodu]),
      varyantAdi: cellToString(hucreler[stokIdx.varyantAdi]),
      depo: cellToString(hucreler[stokIdx.depo]),
      raf: cellToString(hucreler[stokIdx.raf]),
      mevcut: cellToNumber(hucreler[stokIdx.mevcut]),
      minStok: cellToNumber(hucreler[stokIdx.minStok]),
      kritikStok: cellToNumber(hucreler[stokIdx.kritikStok]),
      maxStok: cellToNumber(hucreler[stokIdx.maxStok]),
    })
  }

  // 4) ZimmetGecmisi
  const zimmetSheet = readSheet(wb, 'ZimmetGecmisi')!
  const zimmetIdx = {
    sicilNo: col(zimmetSheet.headers, 'sicilNo'),
    urunKodu: col(zimmetSheet.headers, 'urunKodu'),
    varyantAdi: col(zimmetSheet.headers, 'varyantAdi'),
    miktar: col(zimmetSheet.headers, 'miktar'),
    teslimTarihi: col(zimmetSheet.headers, 'teslimTarihi'),
    aciklama: col(zimmetSheet.headers, 'aciklama'),
  }

  const zimmetSatirlari: ZimmetSatiri[] = []
  for (const { satirNo, hucreler } of zimmetSheet.rows) {
    if (ornekMi(hucreler, zimmetIdx.urunKodu)) continue

    zimmetSatirlari.push({
      satirNo,
      sicilNo: cellToString(hucreler[zimmetIdx.sicilNo]),
      urunKodu: cellToString(hucreler[zimmetIdx.urunKodu]),
      varyantAdi: cellToString(hucreler[zimmetIdx.varyantAdi]),
      miktar: cellToNumber(hucreler[zimmetIdx.miktar]),
      teslimTarihi: cellToString(hucreler[zimmetIdx.teslimTarihi]),
      aciklama: cellToString(hucreler[zimmetIdx.aciklama]),
    })
  }

  return { urunSatirlari, varyantSatirlari, stokSatirlari, zimmetSatirlari, eksikSayfalar: [] }
}

export async function validateImport(buffer: Buffer): Promise<ValidateSonuc> {
  const bos: ValidateSonuc = {
    gecerli: { urun: 0, varyant: 0, stok: 0, zimmet: 0 },
    hatalar: [],
    uyarilar: [],
    atlananlar: [],
    ozet: {
      yeniUrun: 0,
      guncellenecekUrun: 0,
      varyant: 0,
      stok: 0,
      zimmet: 0,
      atlananZimmet: 0,
      eslesmeyenSicil: [],
    },
  }

  const parsed = parseWorkbook(buffer)

  if (parsed.eksikSayfalar.length > 0) {
    for (const sayfa of parsed.eksikSayfalar) {
      bos.hatalar.push({ sayfa, satirNo: 0, alan: '', mesaj: `"${sayfa}" sayfası dosyada bulunamadı.` })
    }
    return bos
  }

  const { urunSatirlari, varyantSatirlari, stokSatirlari, zimmetSatirlari } = parsed

  const hatalar: ImportHata[] = []
  const uyarilar: ImportHata[] = []

  const [dbUrunler, dbKategoriler, dbPersoneller, dbVaryantlar, dbStoklar] = await Promise.all([
    prisma.envanterUrun.findMany({ select: { kod: true } }),
    prisma.envanterKategori.findMany({ where: { durum: 'AKTIF' }, select: { ad: true } }),
    prisma.personnel.findMany({ select: { sicilNo: true } }),
    prisma.envanterUrunVaryant.findMany({ select: { varyantAdi: true, urun: { select: { kod: true } } } }),
    prisma.envanterStok.findMany({ select: { urun: { select: { kod: true } }, varyant: { select: { varyantAdi: true } } } }),
  ])

  const dbUrunKodlari = new Set(dbUrunler.map((u) => upper(u.kod)))
  const dbKategoriAdlari = new Set(dbKategoriler.map((k) => upper(k.ad)))
  const dbSicilNolari = new Set(dbPersoneller.filter((p) => p.sicilNo).map((p) => upper(p.sicilNo!)))
  const dbVaryantAnahtarlari = new Set(
    dbVaryantlar.map((v) => `${upper(v.urun.kod)}::${upper(v.varyantAdi)}`),
  )
  const dbStokAnahtarlari = new Set(
    dbStoklar.map((s) => `${upper(s.urun.kod)}::${s.varyant ? upper(s.varyant.varyantAdi) : ''}`),
  )

  // ---- Urunler ----
  const dosyaUrunKodlari = new Set<string>()
  const urunKoduSatirlari = new Map<string, number[]>()
  let yeniUrun = 0
  let guncellenecekUrun = 0

  for (const satir of urunSatirlari) {
    const kod = satir.urunKodu.trim()
    const kodUpper = upper(satir.urunKodu)
    let ok = true

    if (!kod) {
      hatalar.push({ sayfa: 'Urunler', satirNo: satir.satirNo, alan: 'urunKodu', mesaj: 'urunKodu zorunludur.' })
      ok = false
    } else {
      dosyaUrunKodlari.add(kodUpper)
    }

    if (!satir.urunAdi) {
      hatalar.push({ sayfa: 'Urunler', satirNo: satir.satirNo, alan: 'urunAdi', mesaj: 'urunAdi zorunludur.' })
      ok = false
    }

    if (!satir.kategori) {
      hatalar.push({ sayfa: 'Urunler', satirNo: satir.satirNo, alan: 'kategori', mesaj: 'kategori zorunludur.' })
      ok = false
    } else if (!dbKategoriAdlari.has(upper(satir.kategori))) {
      hatalar.push({
        sayfa: 'Urunler',
        satirNo: satir.satirNo,
        alan: 'kategori',
        mesaj: `"${satir.kategori}" Parametreler'de aktif bir kategori olarak bulunamadı.`,
      })
      ok = false
    }

    if (!satir.tip) {
      hatalar.push({ sayfa: 'Urunler', satirNo: satir.satirNo, alan: 'tip', mesaj: 'tip zorunludur.' })
      ok = false
    } else if (!URUN_TIPLERI.includes(satir.tip as (typeof URUN_TIPLERI)[number])) {
      hatalar.push({
        sayfa: 'Urunler',
        satirNo: satir.satirNo,
        alan: 'tip',
        mesaj: `"${satir.tip}" geçerli bir tip değil. Geçerli değerler: ${URUN_TIPLERI.join(', ')}`,
      })
      ok = false
    }

    if (!VARYANT_TIPLERI.includes(satir.varyantTipi as (typeof VARYANT_TIPLERI)[number])) {
      hatalar.push({
        sayfa: 'Urunler',
        satirNo: satir.satirNo,
        alan: 'varyantTipi',
        mesaj: `"${satir.varyantTipi}" geçerli bir varyantTipi değil. Geçerli değerler: ${VARYANT_TIPLERI.join(', ')}`,
      })
      ok = false
    }

    if (kod) {
      const oncekiler = urunKoduSatirlari.get(kodUpper) ?? []
      if (oncekiler.length > 0) {
        hatalar.push({
          sayfa: 'Urunler',
          satirNo: satir.satirNo,
          alan: 'urunKodu',
          mesaj: `urunKodu "${kod}" dosya içinde birden fazla kez geçiyor (ilk geçtiği satır: ${oncekiler[0]}).`,
        })
        ok = false
      }
      urunKoduSatirlari.set(kodUpper, [...oncekiler, satir.satirNo])

      if (ok && oncekiler.length === 0) {
        if (dbUrunKodlari.has(kodUpper)) {
          guncellenecekUrun++
        } else {
          yeniUrun++
        }
      }
    }
  }

  // ---- Varyantlar ----
  const dosyaVaryantAnahtarlari = new Set<string>()
  let varyantGecerli = 0

  for (const satir of varyantSatirlari) {
    const kodUpper = upper(satir.urunKodu)
    let ok = true

    if (!satir.urunKodu) {
      hatalar.push({ sayfa: 'Varyantlar', satirNo: satir.satirNo, alan: 'urunKodu', mesaj: 'urunKodu zorunludur.' })
      ok = false
    } else if (!dosyaUrunKodlari.has(kodUpper) && !dbUrunKodlari.has(kodUpper)) {
      hatalar.push({
        sayfa: 'Varyantlar',
        satirNo: satir.satirNo,
        alan: 'urunKodu',
        mesaj: `"${satir.urunKodu}" Urunler sayfasında veya sistemde bulunamadı.`,
      })
      ok = false
    }

    if (!satir.varyantAdi) {
      hatalar.push({ sayfa: 'Varyantlar', satirNo: satir.satirNo, alan: 'varyantAdi', mesaj: 'varyantAdi zorunludur.' })
      ok = false
    }

    if (ok) {
      varyantGecerli++
      dosyaVaryantAnahtarlari.add(`${kodUpper}::${upper(satir.varyantAdi)}`)
    }
  }

  // ---- Stoklar ----
  const dosyaStokAnahtarlari = new Set<string>()
  let stokGecerli = 0

  for (const satir of stokSatirlari) {
    const kodUpper = upper(satir.urunKodu)
    let ok = true

    if (!satir.urunKodu) {
      hatalar.push({ sayfa: 'Stoklar', satirNo: satir.satirNo, alan: 'urunKodu', mesaj: 'urunKodu zorunludur.' })
      ok = false
    } else if (!dosyaUrunKodlari.has(kodUpper) && !dbUrunKodlari.has(kodUpper)) {
      hatalar.push({
        sayfa: 'Stoklar',
        satirNo: satir.satirNo,
        alan: 'urunKodu',
        mesaj: `"${satir.urunKodu}" Urunler sayfasında veya sistemde bulunamadı.`,
      })
      ok = false
    }

    if (satir.varyantAdi) {
      const key = `${kodUpper}::${upper(satir.varyantAdi)}`
      if (!dosyaVaryantAnahtarlari.has(key) && !dbVaryantAnahtarlari.has(key)) {
        hatalar.push({
          sayfa: 'Stoklar',
          satirNo: satir.satirNo,
          alan: 'varyantAdi',
          mesaj: `"${satir.varyantAdi}" bu ürünün varyantları arasında bulunamadı.`,
        })
        ok = false
      }
    }

    if (satir.mevcut === null) {
      hatalar.push({ sayfa: 'Stoklar', satirNo: satir.satirNo, alan: 'mevcut', mesaj: 'mevcut sayı olmalıdır.' })
      ok = false
    } else if (satir.mevcut < 0) {
      hatalar.push({ sayfa: 'Stoklar', satirNo: satir.satirNo, alan: 'mevcut', mesaj: 'mevcut negatif olamaz.' })
      ok = false
    }

    if (ok) {
      stokGecerli++
      dosyaStokAnahtarlari.add(`${kodUpper}::${satir.varyantAdi ? upper(satir.varyantAdi) : ''}`)
    }
  }

  // ---- ZimmetGecmisi ----
  // Bu sayfadaki eşleşmeme/uyumsuzluk durumları importu BLOKE ETMEZ — Urunler/
  // Varyantlar/Stoklar'ın aksine, ilgili satır sadece atlanır (best-effort historik veri).
  const atlananlar: ImportAtlanan[] = []
  let zimmetGecerli = 0
  const eslesmeyenSicilSet = new Set<string>()

  for (const satir of zimmetSatirlari) {
    const kodUpper = upper(satir.urunKodu)
    const sebepler: string[] = []

    if (!satir.sicilNo) {
      sebepler.push('sicilNo zorunludur.')
    } else if (!dbSicilNolari.has(upper(satir.sicilNo))) {
      sebepler.push(`"${satir.sicilNo}" sicil no personel listesinde bulunamadı.`)
      eslesmeyenSicilSet.add(satir.sicilNo.trim())
    }

    if (!satir.urunKodu) {
      sebepler.push('urunKodu zorunludur.')
    } else if (!dosyaUrunKodlari.has(kodUpper) && !dbUrunKodlari.has(kodUpper)) {
      sebepler.push(`"${satir.urunKodu}" Urunler sayfasında veya sistemde bulunamadı.`)
    }

    const varyantKey = `${kodUpper}::${satir.varyantAdi ? upper(satir.varyantAdi) : ''}`
    if (satir.varyantAdi) {
      if (!dosyaVaryantAnahtarlari.has(varyantKey) && !dbVaryantAnahtarlari.has(varyantKey)) {
        sebepler.push(`"${satir.varyantAdi}" bu ürünün varyantları arasında bulunamadı.`)
      }
    }

    // Stok satırı yoksa BLOKE ETMEZ / atlanmaz — executeImport bu ürün/varyant için
    // otomatik bir varsayılan stok satırı (mevcut=0) oluşturur. Sadece bilgilendirme.
    if (satir.urunKodu && (dosyaUrunKodlari.has(kodUpper) || dbUrunKodlari.has(kodUpper))) {
      if (!dosyaStokAnahtarlari.has(varyantKey) && !dbStokAnahtarlari.has(varyantKey)) {
        uyarilar.push({
          sayfa: 'ZimmetGecmisi',
          satirNo: satir.satirNo,
          alan: 'urunKodu',
          mesaj: 'Bu ürün/varyant için stok satırı yok; içeri aktarımda otomatik varsayılan bir stok satırı (mevcut=0) oluşturulacak.',
        })
      }
    }

    if (satir.miktar === null || satir.miktar < 1) {
      sebepler.push('miktar en az 1 olmalıdır.')
    }

    if (satir.teslimTarihi) {
      const tarih = parseTarih(satir.teslimTarihi)
      if (!tarih) {
        sebepler.push('teslimTarihi GG.AA.YYYY formatında olmalı veya boş bırakılmalıdır.')
      }
    } else {
      uyarilar.push({
        sayfa: 'ZimmetGecmisi',
        satirNo: satir.satirNo,
        alan: 'teslimTarihi',
        mesaj: 'Tarih girilmedi; kayıt tarihsiz historik olarak işaretlenecek.',
      })
    }

    if (sebepler.length > 0) {
      atlananlar.push({ sayfa: 'ZimmetGecmisi', satirNo: satir.satirNo, sebep: sebepler.join(' ') })
    } else {
      zimmetGecerli++
    }
  }

  return {
    gecerli: {
      urun: yeniUrun + guncellenecekUrun,
      varyant: varyantGecerli,
      stok: stokGecerli,
      zimmet: zimmetGecerli,
    },
    hatalar,
    uyarilar,
    atlananlar,
    ozet: {
      yeniUrun,
      guncellenecekUrun,
      varyant: varyantGecerli,
      stok: stokGecerli,
      zimmet: zimmetGecerli,
      atlananZimmet: atlananlar.length,
      eslesmeyenSicil: Array.from(eslesmeyenSicilSet),
    },
  }
}

export async function executeImport(
  buffer: Buffer,
  options: { zimmetleriHistorikAktar: boolean },
): Promise<ExecuteSonuc> {
  const validateSonuc = await validateImport(buffer)
  if (validateSonuc.hatalar.length > 0) {
    throw new Error('Doğrulama hataları giderilmeden içeri aktarım yapılamaz.')
  }

  const { urunSatirlari, varyantSatirlari, stokSatirlari, zimmetSatirlari } = parseWorkbook(buffer)

  let varyantSayisi = 0
  let stokSayisi = 0
  let zimmetSayisi = 0
  const zimmetAtlananlar: ImportAtlanan[] = []

  await prisma.$transaction(
    async (tx) => {
      // 1) Urunler upsert
      const urunIdByKod = new Map<string, string>()
      const varyantIdByKey = new Map<string, string>()
      const stokIdByKey = new Map<string, string>()

      // Ortak çözümleyiciler — ÖNCE bu import'ta dosyadan oluşturulan/güncellenen
      // kayıtlara (map), BULAMAZSA DB'ye bakar. Kök neden: eskiden urunId çözümlemesi
      // SADECE dosyanın Urunler sayfasına bakıyordu; "sadece ZimmetGecmisi" gibi
      // ürünün bu dosyada olmadığı importlarda DB'de zaten var olan ürün bile
      // bulunamıyordu. validateImport DB'ye baktığı için "geçerli" diyordu, execute
      // ise bulamayıp atlıyordu — bu tutarsızlık burada giderilir.
      async function resolveUrunId(urunKoduHam: string): Promise<string | undefined> {
        const kodUpper = upper(urunKoduHam)
        const onbellek = urunIdByKod.get(kodUpper)
        if (onbellek) return onbellek

        const kodTrim = urunKoduHam.trim()
        if (!kodTrim) return undefined

        const dbUrun = await tx.envanterUrun.findFirst({
          where: { kod: { equals: kodTrim, mode: 'insensitive' } },
        })
        if (!dbUrun) return undefined

        urunIdByKod.set(kodUpper, dbUrun.id)
        return dbUrun.id
      }

      async function resolveVaryantId(urunId: string, varyantAdiHam: string): Promise<string | undefined> {
        if (!varyantAdiHam) return undefined

        const key = `${urunId}::${upper(varyantAdiHam)}`
        const onbellek = varyantIdByKey.get(key)
        if (onbellek) return onbellek

        const dbVaryant = await tx.envanterUrunVaryant.findUnique({
          where: { urunId_varyantAdi: { urunId, varyantAdi: varyantAdiHam.trim() } },
        })
        if (!dbVaryant) return undefined

        varyantIdByKey.set(key, dbVaryant.id)
        return dbVaryant.id
      }

      async function resolveStokId(urunId: string, varyantId: string | null): Promise<string | undefined> {
        const key = `${urunId}::${varyantId ?? ''}`
        const onbellek = stokIdByKey.get(key)
        if (onbellek) return onbellek

        const dbStok = await tx.envanterStok.findFirst({
          where: { urunId, varyantId },
          orderBy: { createdAt: 'asc' },
        })
        if (!dbStok) return undefined

        stokIdByKey.set(key, dbStok.id)
        return dbStok.id
      }

      // Personel çözümlemesi zaten tüm DB'yi (dosyadan bağımsız) tarıyor — ürün
      // çözümlemesindeki gibi bir "sadece dosya" kısıtı hiç olmadı; isimlendirme
      // tutarlılığı için aynı desende bir yardımcıya alınıyor.
      const dbPersonellerHepsi = await tx.personnel.findMany({ select: { id: true, sicilNo: true } })
      const personelIdBySicil = new Map(
        dbPersonellerHepsi.filter((p) => p.sicilNo).map((p) => [upper(p.sicilNo!), p.id]),
      )
      function resolvePersonnelBySicil(sicilNoHam: string): string | undefined {
        return personelIdBySicil.get(upper(sicilNoHam))
      }

      for (const satir of urunSatirlari) {
        const kod = satir.urunKodu.trim()

        const data = {
          ad: satir.urunAdi.trim(),
          kategori: satir.kategori.trim(),
          tip: satir.tip as never,
          olcuBirimi: satir.olcuBirimi || 'ADET',
          varyantTipi: satir.varyantTipi as never,
          paketIciAdet: satir.paketIciAdet,
          barkod: satir.barkod || null,
          tedarikci: satir.tedarikci || null,
          marka: satir.marka || null,
          hedefBolum: satir.hedefBolum || null,
          aciklama: satir.aciklama || null,
        }

        const urun = await tx.envanterUrun.upsert({
          where: { kod },
          create: { kod, ...data },
          update: data,
        })

        urunIdByKod.set(upper(kod), urun.id)
      }

      // 2) Varyantlar upsert
      for (const satir of varyantSatirlari) {
        const urunId = await resolveUrunId(satir.urunKodu)
        if (!urunId) continue

        const varyantAdi = satir.varyantAdi.trim()

        const varyant = await tx.envanterUrunVaryant.upsert({
          where: { urunId_varyantAdi: { urunId, varyantAdi } },
          create: {
            urunId,
            varyantAdi,
            beden: satir.beden || null,
            numara: satir.numara || null,
            renk: satir.renk || null,
          },
          update: {
            beden: satir.beden || null,
            numara: satir.numara || null,
            renk: satir.renk || null,
          },
        })

        varyantIdByKey.set(`${urunId}::${upper(varyantAdi)}`, varyant.id)
        varyantSayisi++
      }

      // 3) Stoklar upsert
      for (const satir of stokSatirlari) {
        const urunId = await resolveUrunId(satir.urunKodu)
        if (!urunId) continue

        const varyantId = (await resolveVaryantId(urunId, satir.varyantAdi)) ?? null

        const depo = satir.depo || null
        const raf = satir.raf || null
        const mevcut = satir.mevcut ?? 0

        let durum: 'NORMAL' | 'MINIMUM' | 'KRITIK' | 'EKSIK' = 'NORMAL'
        if (satir.minStok === null || satir.kritikStok === null) {
          durum = 'EKSIK'
        } else if (mevcut <= satir.kritikStok) {
          durum = 'KRITIK'
        } else if (mevcut <= satir.minStok) {
          durum = 'MINIMUM'
        }

        // Compound unique (urunId, varyantId, depo, raf) nullable alanlar içerdiği için
        // Prisma'nın compound-unique `where` girişi null kabul etmiyor; findFirst + create/update kullanılır.
        const bulunanStok = await tx.envanterStok.findFirst({
          where: { urunId, varyantId, depo, raf },
        })

        const stok = bulunanStok
          ? await tx.envanterStok.update({
              where: { id: bulunanStok.id },
              data: {
                mevcut,
                minStok: satir.minStok,
                kritikStok: satir.kritikStok,
                maxStok: satir.maxStok,
                durum,
              },
            })
          : await tx.envanterStok.create({
              data: {
                urunId,
                varyantId,
                mevcut,
                minStok: satir.minStok,
                kritikStok: satir.kritikStok,
                maxStok: satir.maxStok,
                depo,
                raf,
                durum,
              },
            })

        stokIdByKey.set(`${urunId}::${varyantId ?? ''}`, stok.id)
        stokSayisi++
      }

      // 4) ZimmetGecmisi — stok düşümü YOK, stok hareketi YAZILMAZ (historik veri).
      if (options.zimmetleriHistorikAktar) {
        for (const satir of zimmetSatirlari) {
          // ZimmetGecmisi satırları artık validateImport tarafından bloke edilmiyor
          // (best-effort historik veri); burada eşleşmeyen/geçersiz satırlar sessizce
          // DEĞİL, net bir sebeple atlanır (zimmetAtlananlar) — sessiz atlama YOK.
          function atla(sebep: string) {
            zimmetAtlananlar.push({ sayfa: 'ZimmetGecmisi', satirNo: satir.satirNo, sebep })
          }

          const personelId = resolvePersonnelBySicil(satir.sicilNo)
          if (!personelId) {
            atla(
              satir.sicilNo
                ? `"${satir.sicilNo}" sicil no personel listesinde bulunamadı.`
                : 'sicilNo zorunludur.',
            )
            continue
          }

          const urunId = await resolveUrunId(satir.urunKodu)
          if (!urunId) {
            atla(
              satir.urunKodu
                ? `"${satir.urunKodu}" Urunler sayfasında veya sistemde bulunamadı.`
                : 'urunKodu zorunludur.',
            )
            continue
          }

          let varyantId: string | null = null
          if (satir.varyantAdi) {
            const cozulenVaryantId = await resolveVaryantId(urunId, satir.varyantAdi)
            if (!cozulenVaryantId) {
              atla(`"${satir.varyantAdi}" bu ürünün varyantları arasında bulunamadı.`)
              continue
            }
            varyantId = cozulenVaryantId
          }

          if (satir.miktar === null || satir.miktar < 1) {
            atla('miktar en az 1 olmalıdır.')
            continue
          }

          if (satir.teslimTarihi && !parseTarih(satir.teslimTarihi)) {
            atla('teslimTarihi GG.AA.YYYY formatında olmalı veya boş bırakılmalıdır.')
            continue
          }

          // Stok satırı yoksa (ne dosyada ne DB'de) otomatik varsayılan bir stok satırı
          // oluşturulur — geçmiş zimmet stok düşürmez, sadece EnvanterZimmet.stokId FK'sini
          // karşılamak için gerekli. Böylece stok satırı hiç girilmemiş varyantsız/genel
          // ürünler de zimmet geçmişi alabilir.
          let stokId = await resolveStokId(urunId, varyantId)
          if (!stokId) {
            const varsayilanStok = await tx.envanterStok.create({
              data: {
                urunId,
                varyantId,
                mevcut: 0,
                minStok: null,
                kritikStok: null,
                maxStok: null,
                depo: 'IDARI_ISLER',
                raf: null,
                durum: 'EKSIK',
              },
            })
            stokId = varsayilanStok.id
            stokIdByKey.set(`${urunId}::${varyantId ?? ''}`, stokId)
            stokSayisi++
          }

          const tarihsiz = !satir.teslimTarihi
          const tarih = parseTarih(satir.teslimTarihi) ?? new Date()
          const miktar = satir.miktar

          const aciklamaParcalari = ['[HISTORIK-IMPORT]']
          if (tarihsiz) aciklamaParcalari.push('[TARİHSİZ-HİSTORİK]')
          if (satir.aciklama) aciklamaParcalari.push(satir.aciklama)
          const aciklama = aciklamaParcalari.join(' ')

          const mevcutKayit = await tx.envanterZimmet.findFirst({
            where: {
              personnelId: personelId,
              urunId,
              teslimTarihi: tarih,
              miktar,
              aciklama: { startsWith: '[HISTORIK-IMPORT]' },
            },
          })

          if (mevcutKayit) {
            atla('Bu kayıt zaten mevcut (mükerrer), atlandı.')
            continue
          }

          await tx.envanterZimmet.create({
            data: {
              urunId,
              stokId,
              personnelId: personelId,
              miktar,
              durum: 'AKTIF',
              teslimTarihi: tarih,
              aciklama,
            },
          })

          zimmetSayisi++
        }
      }
    },
    { timeout: 120000 },
  )

  return {
    yeniUrun: validateSonuc.ozet.yeniUrun,
    guncellenecekUrun: validateSonuc.ozet.guncellenecekUrun,
    varyant: varyantSayisi,
    stok: stokSayisi,
    zimmet: zimmetSayisi,
    atlananZimmet: zimmetAtlananlar.length,
    zimmetAtlananlar,
  }
}
