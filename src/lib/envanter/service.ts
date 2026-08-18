import { prisma } from '@/lib/prisma'
import type { EnvanterUrunForm, EnvanterUrunListItem } from '@/types/envanter'
import { assertValidEnvanterUrunForm } from './validation'
import { buildVaryantList, normalizeVaryantTipi } from './variants'
import {
  buildStockCreateInputs,
  getOverallStockStatus,
  getTotalInitialStock,
} from './stock'
import { GECERLI_BEDEN_TIPLERI } from './beden-tipi-sabitleri'
import { GECERLI_HEDEF_YAKALAR } from './yaka-sabitleri'

// Madde 8 — envanter islem audit log. Best-effort: loglama basarisiz olursa asil
// islemi bozmasin diye try/catch icinde, sessizce sadece console.error basar.
export async function logEnvanterIslem(params: {
  actorId?: string | null
  actorAd?: string | null
  islemTipi: string
  hedefTip: string
  hedefId?: string | null
  detay?: Record<string, unknown>
}) {
  try {
    await prisma.envanterIslemLog.create({
      data: {
        aktorId: params.actorId || null,
        aktorAd: params.actorAd || null,
        islemTipi: params.islemTipi,
        hedefTip: params.hedefTip,
        hedefId: params.hedefId || null,
        detay: (params.detay ?? null) as never,
      },
    })
  } catch (err) {
    console.error('Envanter islem log yazilamadi:', err)
  }
}

function toNullableInt(value: string) {
  if (!value || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null
}

function toNullableDecimal(value: string) {
  if (!value || value.trim() === '') return null
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function parseOptionalDate(value: string) {
  if (!value || value.trim() === '') return null

  const normalized = value.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return new Date(`${normalized}T00:00:00`)
  }

  const match = normalized.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)

  if (match) {
    const [, day, month, year] = match
    return new Date(`${year}-${month}-${day}T00:00:00`)
  }

  return null
}

function normalizeKategori(value: string) {
  return value && value.trim() !== '' ? value.trim() : null
}

function mapUrunToListItem(urun: {
  id: string
  kod: string
  ad: string
  kategori: string | null
  tip: string
  bedenTipi: string
  olcuBirimi: string
  durum: string
  varyantTipi: string
  varyantlar: { id: string; beden?: string | null; numara?: string | null; renk?: string | null }[]
  stoklar: {
    mevcut: number
    minStok: number | null
    kritikStok: number | null
    durum: string
  }[]
}): EnvanterUrunListItem {
  const mevcut = urun.stoklar.reduce((total, stok) => total + stok.mevcut, 0)

  const minDegerler = urun.stoklar
    .map((stok) => stok.minStok)
    .filter((value): value is number => typeof value === 'number')

  const kritikDegerler = urun.stoklar
    .map((stok) => stok.kritikStok)
    .filter((value): value is number => typeof value === 'number')

  const stokDurum = getOverallStockStatus(
    urun.stoklar.map((stok) => ({
      key: '',
      mevcut: stok.mevcut,
      minStok: stok.minStok,
      kritikStok: stok.kritikStok,
      maxStok: null,
      depo: null,
      raf: null,
      durum:
        stok.durum === 'KRITIK'
          ? 'KRITIK'
          : stok.durum === 'MINIMUM'
            ? 'MINIMUM'
            : stok.durum === 'NORMAL'
              ? 'NORMAL'
              : 'EKSIK',
    })),
  )

  return {
    id: urun.id,
    kod: urun.kod,
    ad: urun.ad,
    kategori: urun.kategori,
    tip: urun.tip,
    bedenTipi: urun.bedenTipi,
    olcuBirimi: urun.olcuBirimi,
    mevcut,
    min: minDegerler.length > 0 ? Math.min(...minDegerler) : 0,
    kritik: kritikDegerler.length > 0 ? Math.min(...kritikDegerler) : 0,
    durum: urun.durum === 'PASIF' ? 'PASIF' : stokDurum,
    varyantSayisi: urun.varyantlar.length,
    varyantOzeti: buildVaryantOzeti(urun.varyantTipi, urun.varyantlar), // Faz 2
  }
}

// Faz 2 — varyantların beden/numara/renk değerlerinden kısa özet metni üretir.
function buildVaryantOzeti(
  varyantTipi: string,
  varyantlar: { beden?: string | null; numara?: string | null; renk?: string | null }[],
): string {
  if (!varyantlar || varyantlar.length === 0 || varyantTipi === 'YOK') return ''
  const uniq = (arr: (string | null | undefined)[]) =>
    Array.from(new Set(arr.filter((x): x is string => Boolean(x))))
  const bedenler = uniq(varyantlar.map((v) => v.beden))
  const numaralar = uniq(varyantlar.map((v) => v.numara))
  const renkler = uniq(varyantlar.map((v) => v.renk))
  const parcalar: string[] = []
  if (bedenler.length) parcalar.push(`Beden: ${bedenler.join(', ')}`)
  if (numaralar.length) parcalar.push(`Numara: ${numaralar.join(', ')}`)
  if (renkler.length) parcalar.push(`Renk: ${renkler.join(', ')}`)
  return parcalar.join(' | ')
}

export async function listEnvanterUrunler(): Promise<EnvanterUrunListItem[]> {
  const urunler = await prisma.envanterUrun.findMany({
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      varyantlar: {
        select: {
          id: true,
          beden: true, // Faz 2 — varyantOzeti için
          numara: true,
          renk: true,
        },
      },
      stoklar: {
        select: {
          mevcut: true,
          minStok: true,
          kritikStok: true,
          durum: true,
        },
      },
    },
  })

  return urunler.map(mapUrunToListItem)
}

export async function createEnvanterUrun(form: EnvanterUrunForm, actorId?: string, actorAd?: string) {
  assertValidEnvanterUrunForm(form)

  const varyantlar = buildVaryantList(form)
  const stoklar = buildStockCreateInputs(form)
  const toplamIlkGiris = getTotalInitialStock(form)

  return prisma.$transaction(async (tx) => {
    const urun = await tx.envanterUrun.create({
      data: {
        kod: form.kod.trim(),
        ad: form.ad.trim(),
        kategori: normalizeKategori(form.kategori),
        tip: form.tip as never,
        olcuBirimi: form.olcuBirimi || 'ADET',
        barkod: form.barkod || null,
        aciklama: form.aciklama || null,

        varyantTipi: normalizeVaryantTipi(form.varyantTipi) as never,
        bedenTipi: (form.bedenTipi || 'STANDART') as never,

        tedarikci: form.tedarikci || null,
        marka: form.marka || null,
        model: form.model || null,
        sonAlisFiyati: toNullableDecimal(form.sonAlisFiyati),
        paraBirimi: form.paraBirimi || 'TRY',
        kdvOrani: toNullableInt(form.kdvOrani),
        minSiparisMiktari: toNullableInt(form.minSiparisMiktari),
        tedarikSuresiGun: toNullableInt(form.tedarikSuresiGun),

        dagitimSekli: form.dagitimSekli || null,
        periyot: form.periyot || null,
        kullanimOmruGun: toNullableInt(form.kullanimOmruGun),
        teslimYetkisi: form.teslimYetkisi || null,
        sureSonuAksiyonu: form.sureSonuAksiyonu || null,
        dagitimKurali: form.dagitimKurali || null,

        eskiUrunIade: form.eskiUrunIade,
        yoneticiOnayi: form.yoneticiOnayi,
        aciklamaZorunlu: form.aciklamaZorunlu,
        fotoZorunlu: form.fotoZorunlu,
        imzaZorunlu: form.imzaZorunlu,
        qrZorunlu: form.qrZorunlu,
        barkodZorunlu: form.barkodZorunlu,

        hedefYaka: form.hedefYaka || null,
        hedefBolum: form.hedefBolum || null,
        hedefPozisyon: form.hedefPozisyon || null,
        hedefLokasyon: form.hedefLokasyon || null,
        hedefVardiya: form.hedefVardiya || null,
        calismaSekli: form.calismaSekli || null,
        personelHedefTipi: form.personelHedefTipi || null,
        atamaTipi: form.atamaTipi || null,
        tahminiDagitim: form.tahminiDagitim || null,
        sonrakiDagitimTarihi: parseOptionalDate(form.sonrakiDagitimTarihi),
      },
    })

    if (varyantlar.length > 0) {
      await tx.envanterUrunVaryant.createMany({
        data: varyantlar.map((varyant) => ({
          urunId: urun.id,
          varyantAdi: varyant.varyantAdi,
          beden: varyant.beden ?? null,
          numara: varyant.numara ?? null,
          renk: varyant.renk ?? null,
        })),
      })
    }

    const savedVariants = await tx.envanterUrunVaryant.findMany({
      where: {
        urunId: urun.id,
      },
      select: {
        id: true,
        varyantAdi: true,
      },
    })

    const variantIdByName = new Map(
      savedVariants.map((variant) => [variant.varyantAdi, variant.id]),
    )

    await tx.envanterStok.createMany({
      data: stoklar.map((stok) => ({
        urunId: urun.id,
        varyantId: variantIdByName.get(stok.key) ?? null,
        mevcut: stok.mevcut,
        minStok: stok.minStok,
        kritikStok: stok.kritikStok,
        maxStok: stok.maxStok,
        depo: stok.depo,
        raf: stok.raf,
        durum: stok.durum,
      })),
    })

    const stokHareketleri = stoklar
      .filter((stok) => stok.mevcut > 0)
      .map((stok) => ({
        urunId: urun.id,
        varyantId: variantIdByName.get(stok.key) ?? null,
        hareketTipi: 'GIRIS' as const,
        miktar: stok.mevcut,
        depo: stok.depo,
        raf: stok.raf,
        aciklama: 'Ürün kartı oluşturulurken ilk stok girişi.',
      }))

    if (stokHareketleri.length > 0) {
      await tx.envanterStokHareket.createMany({
        data: stokHareketleri,
      })
    }

    if (form.seciliPersoneller.length > 0) {
      await tx.envanterUrunPersonelHedef.createMany({
        data: form.seciliPersoneller.map((personnelId) => ({
          urunId: urun.id,
          personnelId,
        })),
        skipDuplicates: true,
      })
    }

    return {
      id: urun.id,
      kod: urun.kod,
      ad: urun.ad,
      toplamIlkGiris,
      varyantSayisi: varyantlar.length,
    }
  }).then(async (sonuc) => {
    await logEnvanterIslem({
      actorId,
      actorAd,
      islemTipi: 'URUN_OLUSTUR',
      hedefTip: 'URUN',
      hedefId: sonuc.id,
      detay: { kod: sonuc.kod, ad: sonuc.ad, varyantSayisi: sonuc.varyantSayisi },
    })
    return sonuc
  })
}

export async function getEnvanterUrunDetail(id: string) {
  const urun = await prisma.envanterUrun.findUnique({
    where: { id },
    include: {
      varyantlar: {
        orderBy: { varyantAdi: 'asc' },
        select: {
          id: true,
          varyantAdi: true,
          beden: true,
          numara: true,
          renk: true,
        },
      },
      stoklar: {
        orderBy: { createdAt: 'asc' },
        include: {
          varyant: {
            select: {
              id: true,
              varyantAdi: true,
              aktif: true,
            },
          },
        },
      },
      hareketler: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  })

  if (!urun) return null

  // Duzenleme formu tum alanlari ve kilit bayraklarini buradan okur (tek kaynak).
  const { kilitler } = await getUrunKilitleri(urun.id)

  return {
    id: urun.id,
    kod: urun.kod,
    ad: urun.ad,
    kategori: urun.kategori,
    tip: urun.tip,
    olcuBirimi: urun.olcuBirimi,
    paketIciAdet: urun.paketIciAdet,
    barkod: urun.barkod,
    aciklama: urun.aciklama,
    varyantTipi: urun.varyantTipi,
    bedenTipi: urun.bedenTipi,
    durum: urun.durum,
    tedarikci: urun.tedarikci,
    marka: urun.marka,
    model: urun.model,
    sonAlisFiyati: urun.sonAlisFiyati !== null ? Number(urun.sonAlisFiyati) : null,
    paraBirimi: urun.paraBirimi,
    kdvOrani: urun.kdvOrani,
    minSiparisMiktari: urun.minSiparisMiktari,
    tedarikSuresiGun: urun.tedarikSuresiGun,
    dagitimSekli: urun.dagitimSekli,
    periyot: urun.periyot,
    kullanimOmruGun: urun.kullanimOmruGun,
    teslimYetkisi: urun.teslimYetkisi,
    sureSonuAksiyonu: urun.sureSonuAksiyonu,
    dagitimKurali: urun.dagitimKurali,
    eskiUrunIade: urun.eskiUrunIade,
    yoneticiOnayi: urun.yoneticiOnayi,
    aciklamaZorunlu: urun.aciklamaZorunlu,
    fotoZorunlu: urun.fotoZorunlu,
    imzaZorunlu: urun.imzaZorunlu,
    qrZorunlu: urun.qrZorunlu,
    barkodZorunlu: urun.barkodZorunlu,
    hedefYaka: urun.hedefYaka,
    hedefBolum: urun.hedefBolum,
    hedefPozisyon: urun.hedefPozisyon,
    hedefLokasyon: urun.hedefLokasyon,
    hedefVardiya: urun.hedefVardiya,
    calismaSekli: urun.calismaSekli,
    personelHedefTipi: urun.personelHedefTipi,
    atamaTipi: urun.atamaTipi,
    tahminiDagitim: urun.tahminiDagitim,
    sonrakiDagitimTarihi: urun.sonrakiDagitimTarihi
      ? urun.sonrakiDagitimTarihi.toISOString().slice(0, 10)
      : null,
    createdAt: urun.createdAt.toISOString(),

    kilitler,

    varyantlar: urun.varyantlar,

    stoklar: urun.stoklar.map((stok) => ({
      id: stok.id,
      mevcut: stok.mevcut,
      minStok: stok.minStok,
      kritikStok: stok.kritikStok,
      maxStok: stok.maxStok,
      depo: stok.depo,
      raf: stok.raf,
      durum: stok.durum,
      varyantAdi: stok.varyant?.varyantAdi ?? null,
      varyantId: stok.varyant?.id ?? null,
      varyantAktif: stok.varyant?.aktif ?? true,
      birimMaliyet: stok.birimMaliyet, // Faz 2
      paraBirimi: stok.paraBirimi, // Faz 2
    })),

    hareketler: urun.hareketler.map((hareket) => ({
      id: hareket.id,
      hareketTipi: hareket.hareketTipi,
      miktar: hareket.miktar,
      depo: hareket.depo,
      raf: hareket.raf,
      aciklama: hareket.aciklama,
      createdAt: hareket.createdAt.toISOString(),
      bolum: hareket.bolum, // Faz 2 — sarf dağıtım bölümü
      alanPersonelAd: hareket.alanPersonelAd, // Faz 2 — alan personel
      geriAlindi: hareket.geriAlindi, // Faz 2 — geri alma
      hareketTipiRaw: hareket.hareketTipi, // Faz 2 — ham enum değeri
    })),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Ürün düzenleme — koşullu alan kilitleri.
// Kilit kararının TEK KAYNAĞI burasıdır; ekran kendi kuralını uydurmaz, GET'ten
// gelen `kilitler` bayrağına bakar. PATCH de aynı fonksiyonu çağırır.
// ─────────────────────────────────────────────────────────────────────────────

export type UrunKilitAlani =
  | 'kod'
  | 'varyantTipi'
  | 'bedenTipi'
  | 'tip'
  | 'olcuBirimi'

export type UrunKilit = {
  kilitli: boolean
  /** Ekranda alanın altında gösterilecek kısa gerekçe. */
  kisaSebep: string | null
  /** Kilitli alan değiştirilmeye çalışılırsa dönecek tam hata metni. */
  sebep: string | null
}

export type UrunKilitleri = Record<UrunKilitAlani, UrunKilit>

const KILIT_YOK: UrunKilit = { kilitli: false, kisaSebep: null, sebep: null }

/**
 * Ürünün geçmişine bakarak hangi alanların kilitli olduğunu hesaplar.
 *
 * kod          → stok hareketi VEYA zimmet kaydı varsa kilitli.
 *                Gerekçe: Excel içe aktarma ürünleri koda göre eşleştiriyor
 *                (lib/envanter/import.ts). Geçmişi olan üründe kod değişirse
 *                eski kodlu dosya ikinci bir ürün oluşturur.
 * varyantTipi  → varyant varsa kilitli (mevcut varyantlar anlamsız kalır).
 * bedenTipi    → varyant varsa kilitli (aynı gerekçe).
 * tip          → stok hareketi varsa kilitli.
 * olcuBirimi   → stok hareketi varsa kilitli.
 *                Gerekçe: geçmiş hareketler eski birime göre kaydedilmiş.
 */
export async function getUrunKilitleri(urunId: string) {
  const [hareketSayisi, zimmetSayisi, varyantSayisi] = await Promise.all([
    prisma.envanterStokHareket.count({ where: { urunId } }),
    prisma.envanterZimmet.count({ where: { urunId } }),
    prisma.envanterUrunVaryant.count({ where: { urunId } }),
  ])

  const gecmisVar = hareketSayisi > 0 || zimmetSayisi > 0
  const gecmisMetni = `${hareketSayisi} stok hareketi, ${zimmetSayisi} zimmet kaydı`

  const kilitler: UrunKilitleri = {
    kod: gecmisVar
      ? {
          kilitli: true,
          kisaSebep: 'Stok hareketi/zimmet geçmişi var',
          sebep: `Bu ürünün geçmişi var (${gecmisMetni}), kod değiştirilemez.`,
        }
      : KILIT_YOK,
    varyantTipi:
      varyantSayisi > 0
        ? {
            kilitli: true,
            kisaSebep: 'Varyant var',
            sebep: `Bu ürünün ${varyantSayisi} varyantı var, varyant tipi değiştirilemez.`,
          }
        : KILIT_YOK,
    bedenTipi:
      varyantSayisi > 0
        ? {
            kilitli: true,
            kisaSebep: 'Varyant var',
            sebep: `Bu ürünün ${varyantSayisi} varyantı var, beden tipi değiştirilemez.`,
          }
        : KILIT_YOK,
    tip:
      hareketSayisi > 0
        ? {
            kilitli: true,
            kisaSebep: 'Stok hareketi var',
            sebep: `Bu ürünün ${hareketSayisi} stok hareketi var, ürün tipi değiştirilemez.`,
          }
        : KILIT_YOK,
    olcuBirimi:
      hareketSayisi > 0
        ? {
            kilitli: true,
            kisaSebep: 'Stok hareketi var',
            sebep: `Bu ürünün ${hareketSayisi} stok hareketi var, ölçü birimi değiştirilemez.`,
          }
        : KILIT_YOK,
  }

  return { kilitler, hareketSayisi, zimmetSayisi, varyantSayisi }
}

// Güncellenebilir 42 alan, dönüştürme davranışına göre gruplanmış.
// Boş string gönderilirse alan NULL'a çekilir (formda alanı temizlemek = silmek).
const METIN_ALANLARI = [
  'barkod',
  'aciklama',
  'tedarikci',
  'marka',
  'model',
  'dagitimSekli',
  'periyot',
  'teslimYetkisi',
  'sureSonuAksiyonu',
  'dagitimKurali',
  'hedefPozisyon',
  'hedefLokasyon',
  'hedefVardiya',
  'calismaSekli',
  'personelHedefTipi',
  'atamaTipi',
  'tahminiDagitim',
] as const

const TAMSAYI_ALANLARI = [
  'paketIciAdet',
  'kdvOrani',
  'minSiparisMiktari',
  'tedarikSuresiGun',
  'kullanimOmruGun',
] as const

const MANTIK_ALANLARI = [
  'eskiUrunIade',
  'yoneticiOnayi',
  'aciklamaZorunlu',
  'fotoZorunlu',
  'imzaZorunlu',
  'qrZorunlu',
  'barkodZorunlu',
] as const

const OZEL_ALANLAR = [
  'kod',
  'ad',
  'kategori',
  'tip',
  'olcuBirimi',
  'paraBirimi',
  'varyantTipi',
  'bedenTipi',
  'durum',
  'sonAlisFiyati',
  'hedefYaka',
  'hedefBolum',
  'sonrakiDagitimTarihi',
] as const

export const GUNCELLENEBILIR_ALANLAR = [
  ...OZEL_ALANLAR,
  ...METIN_ALANLARI,
  ...TAMSAYI_ALANLARI,
  ...MANTIK_ALANLARI,
] as const

export type GuncellenebilirAlan = (typeof GUNCELLENEBILIR_ALANLAR)[number]

const GECERLI_URUN_TIPLERI = [
  'STANDART_STOK',
  'PERIYODIK_TUKETIM',
  'NUMARALI_URUN',
  'ZIMMETLI_URUN',
  'BEDENLI_URUN',
  'KKD_URUNU',
]
const GECERLI_VARYANT_TIPLERI = [
  'YOK',
  'BEDEN',
  'NUMARA',
  'RENK',
  'BEDEN_RENK',
  'NUMARA_RENK',
]
const GECERLI_DURUMLAR = ['AKTIF', 'PASIF', 'ARSIV']

function metneCevir(value: unknown) {
  if (value === null || value === undefined) return null
  const metin = String(value).trim()
  return metin === '' ? null : metin
}

function mantigaCevir(value: unknown) {
  if (typeof value === 'boolean') return value
  return value === 'true' || value === '1'
}

function csvNormalize(value: unknown) {
  if (value === null || value === undefined) return null
  const ham = Array.isArray(value) ? value.join(',') : String(value)
  const temiz = ham
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .join(',')
  return temiz === '' ? null : temiz
}

/**
 * Kısmi ürün güncellemesi. Gönderilmeyen alan DEĞİŞMEZ.
 * Kilitli bir alan GERÇEKTEN değiştirilmeye çalışılırsa (aynı değer tekrar
 * gönderilirse değişiklik sayılmaz) sessizce yok sayılmaz, hata fırlatılır.
 */
export async function updateEnvanterUrun(
  urunId: string,
  patch: Record<string, unknown>,
  actorId?: string,
  actorAd?: string,
) {
  const mevcut = await prisma.envanterUrun.findUnique({ where: { id: urunId } })
  if (!mevcut) {
    throw new Error('Ürün bulunamadı.')
  }

  const { kilitler, varyantSayisi } = await getUrunKilitleri(urunId)

  const gonderilen = GUNCELLENEBILIR_ALANLAR.filter((alan) =>
    Object.prototype.hasOwnProperty.call(patch, alan),
  )
  if (gonderilen.length === 0) {
    throw new Error('Güncellenecek alan gönderilmedi.')
  }

  const data: Record<string, unknown> = {}
  const degisiklikler: Record<string, { once: unknown; sonra: unknown }> = {}

  for (const alan of gonderilen) {
    const ham = patch[alan]
    let yeni: unknown

    if ((METIN_ALANLARI as readonly string[]).includes(alan)) {
      yeni = metneCevir(ham)
    } else if ((TAMSAYI_ALANLARI as readonly string[]).includes(alan)) {
      yeni = toNullableInt(String(ham ?? ''))
    } else if ((MANTIK_ALANLARI as readonly string[]).includes(alan)) {
      yeni = mantigaCevir(ham)
    } else {
      switch (alan) {
        case 'kod':
        case 'ad': {
          const metin = metneCevir(ham)
          if (!metin) throw new Error(`${alan === 'kod' ? 'Ürün kodu' : 'Ürün adı'} boş olamaz.`)
          yeni = metin
          break
        }
        case 'kategori': {
          const metin = metneCevir(ham)
          if (!metin) throw new Error('Kategori boş olamaz.')
          yeni = metin
          break
        }
        case 'tip': {
          const metin = metneCevir(ham)
          if (!metin || !GECERLI_URUN_TIPLERI.includes(metin)) {
            throw new Error(
              `"${String(ham)}" geçerli bir ürün tipi değil. Geçerli değerler: ${GECERLI_URUN_TIPLERI.join(', ')}`,
            )
          }
          yeni = metin
          break
        }
        case 'varyantTipi': {
          const metin = normalizeVaryantTipi(String(ham ?? ''))
          if (!GECERLI_VARYANT_TIPLERI.includes(metin)) {
            throw new Error(
              `"${String(ham)}" geçerli bir varyant tipi değil. Geçerli değerler: ${GECERLI_VARYANT_TIPLERI.join(', ')}`,
            )
          }
          yeni = metin
          break
        }
        case 'bedenTipi': {
          const metin = metneCevir(ham) ?? 'STANDART'
          if (!(GECERLI_BEDEN_TIPLERI as readonly string[]).includes(metin)) {
            throw new Error(
              `"${String(ham)}" geçerli bir beden tipi değil. Geçerli değerler: ${GECERLI_BEDEN_TIPLERI.join(', ')}`,
            )
          }
          yeni = metin
          break
        }
        case 'durum': {
          const metin = metneCevir(ham)
          if (!metin || !GECERLI_DURUMLAR.includes(metin)) {
            throw new Error(
              `"${String(ham)}" geçerli bir durum değil. Geçerli değerler: ${GECERLI_DURUMLAR.join(', ')}`,
            )
          }
          yeni = metin
          break
        }
        case 'olcuBirimi':
          yeni = metneCevir(ham) ?? 'ADET'
          break
        case 'paraBirimi':
          yeni = metneCevir(ham) ?? 'TRY'
          break
        case 'sonAlisFiyati':
          yeni = toNullableDecimal(String(ham ?? ''))
          break
        case 'hedefYaka': {
          const csv = csvNormalize(
            typeof ham === 'string' ? ham.toUpperCase() : ham,
          )
          if (csv) {
            const gecersizler = csv
              .split(',')
              .filter((v) => !GECERLI_HEDEF_YAKALAR.includes(v as never))
            if (gecersizler.length > 0) {
              throw new Error(
                `"${gecersizler.join(', ')}" geçerli bir hedef yaka değil. Geçerli değerler: ${GECERLI_HEDEF_YAKALAR.join(', ')} veya boş (tümü).`,
              )
            }
          }
          yeni = csv
          break
        }
        case 'hedefBolum':
          yeni = csvNormalize(ham)
          break
        case 'sonrakiDagitimTarihi':
          yeni = parseOptionalDate(String(ham ?? ''))
          break
        default:
          continue
      }
    }

    const oncekiHam = (mevcut as Record<string, unknown>)[alan]
    const onceki =
      oncekiHam instanceof Date
        ? oncekiHam.toISOString()
        : oncekiHam !== null && typeof oncekiHam === 'object'
          ? Number(oncekiHam)
          : oncekiHam
    const sonraki = yeni instanceof Date ? yeni.toISOString() : yeni

    if (onceki === sonraki) continue

    // Kilitli alan GERÇEKTEN değişiyorsa: sessizce yok sayma, net hata.
    const kilit = kilitler[alan as UrunKilitAlani]
    if (kilit?.kilitli) {
      throw new Error(kilit.sebep as string)
    }

    data[alan] = yeni
    degisiklikler[alan] = { once: onceki, sonra: sonraki }
  }

  if (Object.keys(data).length === 0) {
    return { urun: mevcut, degisiklikler: {}, degisiklikVar: false }
  }

  // Doğrulama: EKLEME formundaki doğrulayıcı aynen koşsun (yeni doğrulama yok).
  // Mevcut değerler + gelen yama birleştirilip form şekline çevrilir.
  const birlesik = { ...(mevcut as Record<string, unknown>), ...data }
  const s = (v: unknown) => (v === null || v === undefined ? '' : String(v))
  const varyantTipiSon = s(birlesik.varyantTipi)
  // Varyant listeleri düzenlemede DEĞİŞMEZ; doğrulayıcının varyant kuralı mevcut
  // varyantlara göre değerlendirilsin diye gerçek varyant sayısı yansıtılır.
  const varyantDolgusu = varyantSayisi > 0 ? ['mevcut'] : []
  const formSekli = {
    kod: s(birlesik.kod),
    ad: s(birlesik.ad),
    kategori: s(birlesik.kategori),
    tip: s(birlesik.tip),
    olcuBirimi: s(birlesik.olcuBirimi),
    barkod: s(birlesik.barkod),
    aciklama: s(birlesik.aciklama),
    varyantTipi: varyantTipiSon === 'YOK' ? '' : varyantTipiSon,
    bedenTipi: s(birlesik.bedenTipi),
    bedenler: varyantDolgusu,
    numaralar: varyantDolgusu,
    renkler: varyantDolgusu,
    stokSatirlari: {},
    tedarikci: s(birlesik.tedarikci),
    marka: s(birlesik.marka),
    model: s(birlesik.model),
    sonAlisFiyati: s(birlesik.sonAlisFiyati),
    paraBirimi: s(birlesik.paraBirimi),
    kdvOrani: s(birlesik.kdvOrani),
    minSiparisMiktari: s(birlesik.minSiparisMiktari),
    tedarikSuresiGun: s(birlesik.tedarikSuresiGun),
    dagitimSekli: s(birlesik.dagitimSekli),
    periyot: s(birlesik.periyot),
    kullanimOmruGun: s(birlesik.kullanimOmruGun),
    teslimYetkisi: s(birlesik.teslimYetkisi),
    sureSonuAksiyonu: s(birlesik.sureSonuAksiyonu),
    dagitimKurali: s(birlesik.dagitimKurali),
    eskiUrunIade: Boolean(birlesik.eskiUrunIade),
    yoneticiOnayi: Boolean(birlesik.yoneticiOnayi),
    aciklamaZorunlu: Boolean(birlesik.aciklamaZorunlu),
    fotoZorunlu: Boolean(birlesik.fotoZorunlu),
    imzaZorunlu: Boolean(birlesik.imzaZorunlu),
    qrZorunlu: Boolean(birlesik.qrZorunlu),
    barkodZorunlu: Boolean(birlesik.barkodZorunlu),
    hedefYaka: s(birlesik.hedefYaka),
    hedefBolum: s(birlesik.hedefBolum),
    hedefPozisyon: s(birlesik.hedefPozisyon),
    hedefLokasyon: s(birlesik.hedefLokasyon),
    hedefVardiya: s(birlesik.hedefVardiya),
    calismaSekli: s(birlesik.calismaSekli),
    personelHedefTipi: s(birlesik.personelHedefTipi),
    atamaTipi: s(birlesik.atamaTipi),
    tahminiDagitim: s(birlesik.tahminiDagitim),
    sonrakiDagitimTarihi:
      birlesik.sonrakiDagitimTarihi instanceof Date
        ? birlesik.sonrakiDagitimTarihi.toISOString().slice(0, 10)
        : s(birlesik.sonrakiDagitimTarihi).slice(0, 10),
    seciliPersoneller: [],
  }
  assertValidEnvanterUrunForm(formSekli as unknown as EnvanterUrunForm)

  let urun
  try {
    urun = await prisma.envanterUrun.update({
      where: { id: urunId },
      data: data as never,
    })
  } catch (err) {
    const kod = (err as { code?: string })?.code
    if (kod === 'P2002' && data.kod) {
      throw new Error(
        `"${String(data.kod)}" kodu başka bir üründe kullanılıyor. Ürün kodu benzersiz olmalıdır.`,
      )
    }
    throw err
  }

  // İşlem izi — URUN_SIL/URUN_PASIFLESTIR ile aynı desen, yeni altyapı yok.
  await logEnvanterIslem({
    actorId,
    actorAd,
    islemTipi: 'URUN_GUNCELLE',
    hedefTip: 'EnvanterUrun',
    hedefId: urunId,
    detay: {
      kod: urun.kod,
      ad: urun.ad,
      aktorAd: actorAd,
      degisenAlanlar: Object.keys(degisiklikler),
      degisiklikler,
    },
  })

  return { urun, degisiklikler, degisiklikVar: true }
}

export async function createEnvanterStokHareket(input: {
  personnelId?: string
  stokId: string
  hareketTipi: 'GIRIS' | 'CIKIS' | 'ZIMMET' | 'IADE' | 'HURDA' | 'SAYIM_DUZELTME'
  miktar: number
  aciklama?: string
  // Faz 2 — sarf/dağıtım alan personeli + bölüm (hepsi opsiyonel, additive)
  bolum?: string
  alanPersonelId?: string
  alanPersonelAd?: string
  actorId?: string
  actorAd?: string
}) {
  if (!input.stokId) {
    throw new Error('Stok kaydı seçilmelidir.')
  }

  if (!Number.isFinite(input.miktar) || input.miktar < 0) {
    throw new Error('Miktar geçerli olmalıdır.')
  }

  return prisma.$transaction(async (tx) => {
    const stok = await tx.envanterStok.findUnique({
      where: { id: input.stokId },
    })

    if (!stok) {
      throw new Error('Stok kaydı bulunamadı.')
    }

    let yeniMevcut = stok.mevcut

    if (input.hareketTipi === 'GIRIS' || input.hareketTipi === 'IADE') {
      yeniMevcut = stok.mevcut + input.miktar
    }

    if (
      input.hareketTipi === 'CIKIS' ||
      input.hareketTipi === 'ZIMMET' ||
      input.hareketTipi === 'HURDA'
    ) {
      yeniMevcut = stok.mevcut - input.miktar
    }

    if (input.hareketTipi === 'SAYIM_DUZELTME') {
      yeniMevcut = input.miktar
    }

    if (yeniMevcut < 0) {
      throw new Error('Stok eksiye düşemez.')
    }

    let durum: 'NORMAL' | 'MINIMUM' | 'KRITIK' | 'EKSIK' = 'NORMAL'

    if (stok.minStok === null || stok.kritikStok === null) {
      durum = 'EKSIK'
    } else if (yeniMevcut <= stok.kritikStok) {
      durum = 'KRITIK'
    } else if (yeniMevcut <= stok.minStok) {
      durum = 'MINIMUM'
    }

    const updatedStok = await tx.envanterStok.update({
      where: { id: stok.id },
      data: {
        mevcut: yeniMevcut,
        durum,
      },
    })

    const hareket = await tx.envanterStokHareket.create({
      data: {
        personnelId: input.personnelId || null,
        urunId: stok.urunId,
        varyantId: stok.varyantId,
        hareketTipi: input.hareketTipi,
        miktar: input.miktar,
        depo: stok.depo,
        raf: stok.raf,
        aciklama: input.aciklama || null,
        // Faz 2 — sarf dağıtım alan personeli + bölüm
        bolum: input.bolum || null,
        alanPersonelId: input.alanPersonelId || null,
        alanPersonelAd: input.alanPersonelAd || null,
        createdById: input.actorId || null,
      },
    })

    return {
      stok: updatedStok,
      hareket,
    }
  }).then(async (sonuc) => {
    await logEnvanterIslem({
      actorId: input.actorId,
      actorAd: input.actorAd,
      islemTipi: 'STOK_HAREKET',
      hedefTip: 'STOK_HAREKET',
      hedefId: sonuc.hareket.id,
      detay: {
        hareketTipi: input.hareketTipi,
        miktar: input.miktar,
        stokId: input.stokId,
        bolum: input.bolum,
        alanPersonelId: input.alanPersonelId,
        alanPersonelAd: input.alanPersonelAd,
      },
    })
    return sonuc
  })
}

export async function createZimmet(input: {
  personnelId: string
  stokId: string
  miktar: number
  aciklama?: string
  // KKD grubu + verilme tarihi: teslim takip listesi (getTeslimListesi) bu iki
  // alandan besleniyor; yazılmazsa zimmet listede görünmez.
  kkdUstGrubu?: string
  kkdAltGrubu?: string
  verilmeTarihi?: Date
  createdById?: string
  createdByAd?: string
}) {
  if (!input.personnelId) {
    throw new Error('Personel seçilmelidir.')
  }
  if (!input.stokId) {
    throw new Error('Stok kaydı seçilmelidir.')
  }
  if (!Number.isFinite(input.miktar) || input.miktar < 1) {
    throw new Error('Miktar en az 1 olmalıdır.')
  }

  return prisma.$transaction(async (tx) => {
    const stok = await tx.envanterStok.findUnique({
      where: { id: input.stokId },
    })
    if (!stok) {
      throw new Error('Stok kaydı bulunamadı.')
    }

    const yeniMevcut = stok.mevcut - input.miktar
    if (yeniMevcut < 0) {
      throw new Error(`Yetersiz stok. Mevcut: ${stok.mevcut}, istenen: ${input.miktar}.`)
    }

    let durum: 'NORMAL' | 'MINIMUM' | 'KRITIK' | 'EKSIK' = 'NORMAL'
    if (stok.minStok === null || stok.kritikStok === null) {
      durum = 'EKSIK'
    } else if (yeniMevcut <= stok.kritikStok) {
      durum = 'KRITIK'
    } else if (yeniMevcut <= stok.minStok) {
      durum = 'MINIMUM'
    }

    const updatedStok = await tx.envanterStok.update({
      where: { id: stok.id },
      data: { mevcut: yeniMevcut, durum },
    })

    const zimmet = await tx.envanterZimmet.create({
      data: {
        urunId: stok.urunId,
        stokId: stok.id,
        personnelId: input.personnelId,
        miktar: input.miktar,
        aciklama: input.aciklama || null,
        kkdUstGrubu: input.kkdUstGrubu || null,
        kkdAltGrubu: input.kkdAltGrubu || null,
        verilmeTarihi: input.verilmeTarihi || null,
        createdById: input.createdById || null,
      },
      include: {
        urun: { select: { kod: true, ad: true } },
        personnel: { select: { sicilNo: true, adSoyad: true } },
      },
    })

    const hareket = await tx.envanterStokHareket.create({
      data: {
        personnelId: input.personnelId,
        urunId: stok.urunId,
        varyantId: stok.varyantId,
        hareketTipi: 'ZIMMET',
        miktar: input.miktar,
        depo: stok.depo,
        raf: stok.raf,
        aciklama: input.aciklama || null,
        createdById: input.createdById || null,
      },
    })

    return { zimmet, stok: updatedStok, hareket }
  }).then(async (sonuc) => {
    await logEnvanterIslem({
      actorId: input.createdById,
      actorAd: input.createdByAd,
      islemTipi: 'ZIMMET_OLUSTUR',
      hedefTip: 'ZIMMET',
      hedefId: sonuc.zimmet.id,
      detay: { personnelId: input.personnelId, stokId: input.stokId, miktar: input.miktar },
    })
    return sonuc
  })
}

export async function iadeZimmet(input: {
  zimmetId: string
  iadeMiktar: number
  aciklama?: string
  createdById?: string
  createdByAd?: string
}) {
  if (!input.zimmetId) {
    throw new Error('Zimmet kaydı seçilmelidir.')
  }
  if (!Number.isFinite(input.iadeMiktar) || input.iadeMiktar < 1) {
    throw new Error('İade miktarı en az 1 olmalıdır.')
  }

  return prisma.$transaction(async (tx) => {
    const zimmet = await tx.envanterZimmet.findUnique({
      where: { id: input.zimmetId },
    })
    if (!zimmet) {
      throw new Error('Zimmet kaydı bulunamadı.')
    }
    if (zimmet.durum !== 'AKTIF') {
      throw new Error('Bu zimmet aktif değil.')
    }
    if (input.iadeMiktar > zimmet.miktar) {
      throw new Error(`İade miktarı zimmet miktarını aşamaz. Zimmette: ${zimmet.miktar}.`)
    }

    const stok = await tx.envanterStok.findUnique({
      where: { id: zimmet.stokId },
    })
    if (!stok) {
      throw new Error('Stok kaydı bulunamadı.')
    }

    let guncelZimmet
    let yeniIadeZimmet = null

    if (input.iadeMiktar === zimmet.miktar) {
      guncelZimmet = await tx.envanterZimmet.update({
        where: { id: zimmet.id },
        data: {
          durum: 'IADE_EDILDI',
          iadeTarihi: new Date(),
          aciklama: input.aciklama
            ? `${zimmet.aciklama ? `${zimmet.aciklama} | ` : ''}İade: ${input.aciklama}`
            : zimmet.aciklama,
        },
      })
    } else {
      guncelZimmet = await tx.envanterZimmet.update({
        where: { id: zimmet.id },
        data: {
          miktar: zimmet.miktar - input.iadeMiktar,
        },
      })

      yeniIadeZimmet = await tx.envanterZimmet.create({
        data: {
          urunId: zimmet.urunId,
          stokId: zimmet.stokId,
          personnelId: zimmet.personnelId,
          miktar: input.iadeMiktar,
          durum: 'IADE_EDILDI',
          teslimTarihi: zimmet.teslimTarihi,
          iadeTarihi: new Date(),
          aciklama: input.aciklama || 'Kısmi iade',
          createdById: input.createdById || null,
        },
      })
    }

    const yeniMevcut = stok.mevcut + input.iadeMiktar

    let durum: 'NORMAL' | 'MINIMUM' | 'KRITIK' | 'EKSIK' = 'NORMAL'
    if (stok.minStok === null || stok.kritikStok === null) {
      durum = 'EKSIK'
    } else if (yeniMevcut <= stok.kritikStok) {
      durum = 'KRITIK'
    } else if (yeniMevcut <= stok.minStok) {
      durum = 'MINIMUM'
    }

    const updatedStok = await tx.envanterStok.update({
      where: { id: stok.id },
      data: { mevcut: yeniMevcut, durum },
    })

    const hareket = await tx.envanterStokHareket.create({
      data: {
        personnelId: zimmet.personnelId,
        urunId: stok.urunId,
        varyantId: stok.varyantId,
        hareketTipi: 'IADE',
        miktar: input.iadeMiktar,
        depo: stok.depo,
        raf: stok.raf,
        aciklama: input.aciklama || null,
        createdById: input.createdById || null,
      },
    })

    return {
      zimmet: yeniIadeZimmet ? [guncelZimmet, yeniIadeZimmet] : guncelZimmet,
      stok: updatedStok,
      hareket,
    }
  }).then(async (sonuc) => {
    await logEnvanterIslem({
      actorId: input.createdById,
      actorAd: input.createdByAd,
      islemTipi: 'ZIMMET_IADE',
      hedefTip: 'ZIMMET',
      hedefId: input.zimmetId,
      detay: { iadeMiktar: input.iadeMiktar },
    })
    return sonuc
  })
}
export async function silZimmet(zimmetId: string, actorId?: string, actorAd?: string) {
  if (!zimmetId) {
    throw new Error('Zimmet kaydı seçilmelidir.')
  }
  const zimmet = await prisma.envanterZimmet.findUnique({
    where: { id: zimmetId },
  })
  if (!zimmet) {
    throw new Error('Zimmet kaydı bulunamadı.')
  }
  if (zimmet.durum !== 'AKTIF') {
    throw new Error(
      'Sadece aktif (henüz iade edilmemiş) zimmet kayıtları silinebilir. Bu kayıt için İptal Et seçeneğini kullanın.',
    )
  }

  const sonuc = await prisma.$transaction(async (tx) => {
    const stok = await tx.envanterStok.findUnique({
      where: { id: zimmet.stokId },
    })
    if (!stok) {
      throw new Error('Stok kaydı bulunamadı.')
    }

    const yeniMevcut = stok.mevcut + zimmet.miktar
    let durum: 'NORMAL' | 'MINIMUM' | 'KRITIK' | 'EKSIK' = 'NORMAL'
    if (stok.minStok === null || stok.kritikStok === null) durum = 'EKSIK'
    else if (yeniMevcut <= stok.kritikStok) durum = 'KRITIK'
    else if (yeniMevcut <= stok.minStok) durum = 'MINIMUM'

    const updatedStok = await tx.envanterStok.update({
      where: { id: stok.id },
      data: { mevcut: yeniMevcut, durum },
    })

    const hareket = await tx.envanterStokHareket.create({
      data: {
        urunId: stok.urunId,
        varyantId: stok.varyantId,
        personnelId: zimmet.personnelId,
        hareketTipi: 'IADE',
        miktar: zimmet.miktar,
        depo: stok.depo,
        raf: stok.raf,
        aciklama: 'Hatalı zimmet kaydı silindi',
        createdById: actorId || null,
      },
    })

    await tx.envanterZimmet.delete({
      where: { id: zimmetId },
    })

    return {
      stok: updatedStok,
      hareket,
      silinenZimmet: {
        personnelId: zimmet.personnelId,
        urunId: zimmet.urunId,
        miktar: zimmet.miktar,
      },
    }
  })

  await logEnvanterIslem({
    actorId,
    actorAd,
    islemTipi: 'ZIMMET_SIL',
    hedefTip: 'ZIMMET',
    hedefId: zimmetId,
    detay: sonuc.silinenZimmet,
  })

  return sonuc
}

export async function iptalZimmet(
  zimmetId: string,
  actorId?: string,
  sebep?: string,
  actorAd?: string,
) {
  if (!zimmetId) {
    throw new Error('Zimmet kaydı seçilmelidir.')
  }
  const zimmet = await prisma.envanterZimmet.findUnique({
    where: { id: zimmetId },
  })
  if (!zimmet) {
    throw new Error('Zimmet kaydı bulunamadı.')
  }
  if (zimmet.durum === 'AKTIF') {
    throw new Error('Aktif zimmet kayıtları iptal edilemez, Sil seçeneğini kullanın.')
  }
  if (zimmet.durum === 'IPTAL') {
    throw new Error('Bu zimmet kaydı zaten iptal edilmiş.')
  }

  const guncelZimmet = await prisma.envanterZimmet.update({
    where: { id: zimmetId },
    data: {
      durum: 'IPTAL',
      aciklama: sebep
        ? `${zimmet.aciklama ? `${zimmet.aciklama} | ` : ''}İptal: ${sebep}`
        : zimmet.aciklama,
    },
  })

  await logEnvanterIslem({
    actorId,
    actorAd,
    islemTipi: 'ZIMMET_IPTAL',
    hedefTip: 'ZIMMET',
    hedefId: zimmetId,
    detay: { sebep: sebep || null },
  })

  return guncelZimmet
}

// ============ Faz 2 — yeni servis fonksiyonları ============

export async function geriAlStokHareket(hareketId: string, actorId?: string, actorAd?: string) {
  const orijinal = await prisma.envanterStokHareket.findUnique({
    where: { id: hareketId },
  })

  if (!orijinal) {
    throw new Error('Hareket bulunamadı.')
  }
  if (orijinal.geriAlindi) {
    throw new Error('Bu hareket zaten geri alınmış.')
  }

  const tersTip: Record<string, 'GIRIS' | 'CIKIS' | 'IADE'> = {
    CIKIS: 'IADE',
    GIRIS: 'CIKIS',
    IADE: 'CIKIS',
    ZIMMET: 'IADE',
    HURDA: 'IADE',
  }

  const yeniTip = tersTip[orijinal.hareketTipi]
  if (!yeniTip) {
    throw new Error('Bu hareket tipi geri alınamaz (ör. sayım düzeltme).')
  }

  return prisma.$transaction(async (tx) => {
    // Orijinali işaretle
    await tx.envanterStokHareket.update({
      where: { id: orijinal.id },
      data: { geriAlindi: true },
    })

    // Ters hareketi oluştur (stok mevcut buna göre güncellenir)
    const stok = await tx.envanterStok.findFirst({
      where: { urunId: orijinal.urunId, varyantId: orijinal.varyantId },
    })
    if (!stok) throw new Error('Stok kaydı bulunamadı.')

    let yeniMevcut = stok.mevcut
    if (yeniTip === 'IADE') yeniMevcut = stok.mevcut + orijinal.miktar
    if (yeniTip === 'CIKIS') yeniMevcut = stok.mevcut - orijinal.miktar
    if (yeniMevcut < 0) throw new Error('Geri alma stoğu eksiye düşürüyor.')

    let durum: 'NORMAL' | 'MINIMUM' | 'KRITIK' | 'EKSIK' = 'NORMAL'
    if (stok.minStok === null || stok.kritikStok === null) durum = 'EKSIK'
    else if (yeniMevcut <= stok.kritikStok) durum = 'KRITIK'
    else if (yeniMevcut <= stok.minStok) durum = 'MINIMUM'

    const updatedStok = await tx.envanterStok.update({
      where: { id: stok.id },
      data: { mevcut: yeniMevcut, durum },
    })

    const tersHareket = await tx.envanterStokHareket.create({
      data: {
        urunId: orijinal.urunId,
        varyantId: orijinal.varyantId,
        hareketTipi: yeniTip,
        miktar: orijinal.miktar,
        depo: orijinal.depo,
        raf: orijinal.raf,
        aciklama: `Geri alma: ${orijinal.hareketTipi} hareketi iptal edildi`,
        bolum: orijinal.bolum,
        alanPersonelId: orijinal.alanPersonelId,
        alanPersonelAd: orijinal.alanPersonelAd,
        geriAlindi: true,
        createdById: actorId || null,
      },
    })

    return { stok: updatedStok, tersHareket }
  }).then(async (sonuc) => {
    await logEnvanterIslem({
      actorId,
      actorAd,
      islemTipi: 'STOK_HAREKET_GERI_ALMA',
      hedefTip: 'STOK_HAREKET',
      hedefId: hareketId,
      detay: { yeniHareketId: sonuc.tersHareket.id, orijinalTip: orijinal.hareketTipi },
    })
    return sonuc
  })
}

export async function addVaryantToUrun(input: {
  urunId: string
  tip: 'BEDEN' | 'NUMARA' | 'RENK'
  deger: string
  depo?: string | null
  actorId?: string
  actorAd?: string
}) {
  const deger = input.deger.trim()
  if (!deger) throw new Error('Varyant değeri boş olamaz.')

  return prisma.$transaction(async (tx) => {
    const urun = await tx.envanterUrun.findUnique({ where: { id: input.urunId } })
    if (!urun) throw new Error('Ürün bulunamadı.')

    // Mükerrer kontrol
    const mevcut = await tx.envanterUrunVaryant.findFirst({
      where: { urunId: input.urunId, varyantAdi: deger },
    })
    if (mevcut) throw new Error('Bu varyant zaten mevcut.')

    // Varyantı oluştur
    const varyant = await tx.envanterUrunVaryant.create({
      data: {
        urunId: input.urunId,
        varyantAdi: deger,
        beden: input.tip === 'BEDEN' ? deger : null,
        numara: input.tip === 'NUMARA' ? deger : null,
        renk: input.tip === 'RENK' ? deger : null,
      },
    })

    // Ürünün varyantTipi'sini güncelle (YOK -> ilk eklenen tip; 
    // farklı tip eklenirse karma tipe geç)
    const yeniTip =
      urun.varyantTipi === 'YOK'
        ? input.tip
        : urun.varyantTipi === input.tip
          ? input.tip
          : input.tip === 'RENK' || urun.varyantTipi === 'RENK'
            ? (urun.varyantTipi === 'BEDEN' || input.tip === 'BEDEN' ? 'BEDEN_RENK' : 'NUMARA_RENK')
            : urun.varyantTipi
    if (yeniTip !== urun.varyantTipi) {
      await tx.envanterUrun.update({
        where: { id: input.urunId },
        data: { varyantTipi: yeniTip as never },
      })
    }

    // Stok kaydı aç (mevcut 0)
    await tx.envanterStok.create({
      data: {
        urunId: input.urunId,
        varyantId: varyant.id,
        mevcut: 0,
        minStok: null,
        kritikStok: null,
        maxStok: null,
        depo: input.depo?.trim() || null,
        raf: null,
        durum: 'EKSIK',
      },
    })

    return { varyant }
  }).then(async (sonuc) => {
    await logEnvanterIslem({
      actorId: input.actorId,
      actorAd: input.actorAd,
      islemTipi: 'VARYANT_EKLE',
      hedefTip: 'VARYANT',
      hedefId: sonuc.varyant.id,
      detay: { urunId: input.urunId, tip: input.tip, deger: input.deger },
    })
    return sonuc
  })
}

export async function updateStokEsik(input: {
  stokId: string
  minStok: number | null
  kritikStok: number | null
  actorId?: string
  actorAd?: string
}) {
  const stok = await prisma.envanterStok.findUnique({ where: { id: input.stokId } })
  if (!stok) throw new Error('Stok kaydı bulunamadı.')

  // Durumu yeni eşiklere göre yeniden hesapla
  let durum: 'NORMAL' | 'MINIMUM' | 'KRITIK' | 'EKSIK' = 'NORMAL'
  if (input.minStok === null || input.kritikStok === null) durum = 'EKSIK'
  else if (stok.mevcut <= input.kritikStok) durum = 'KRITIK'
  else if (stok.mevcut <= input.minStok) durum = 'MINIMUM'

  const sonuc = await prisma.envanterStok.update({
    where: { id: input.stokId },
    data: { minStok: input.minStok, kritikStok: input.kritikStok, durum },
  })
  await logEnvanterIslem({
    actorId: input.actorId,
    actorAd: input.actorAd,
    islemTipi: 'STOK_ESIK_GUNCELLE',
    hedefTip: 'STOK',
    hedefId: input.stokId,
    detay: { minStok: input.minStok, kritikStok: input.kritikStok },
  })
  return sonuc
}

export async function updateStokMaliyet(input: {
  stokId: string
  birimMaliyet: number | null
  paraBirimi: string | null
  actorId?: string
  actorAd?: string
}) {
  const stok = await prisma.envanterStok.findUnique({ where: { id: input.stokId } })
  if (!stok) throw new Error('Stok kaydı bulunamadı.')
  const sonuc = await prisma.envanterStok.update({
    where: { id: input.stokId },
    data: {
      birimMaliyet: input.birimMaliyet,
      paraBirimi: input.paraBirimi || 'TL',
    },
  })
  await logEnvanterIslem({
    actorId: input.actorId,
    actorAd: input.actorAd,
    islemTipi: 'STOK_MALIYET_GUNCELLE',
    hedefTip: 'STOK',
    hedefId: input.stokId,
    detay: { birimMaliyet: input.birimMaliyet, paraBirimi: input.paraBirimi },
  })
  return sonuc
}

export async function updateVaryant(input: {
  varyantId: string
  varyantAdi?: string
  beden?: string | null
  numara?: string | null
  renk?: string | null
  actorId?: string
  actorAd?: string
}) {
  const varyant = await prisma.envanterUrunVaryant.findUnique({ where: { id: input.varyantId } })
  if (!varyant) throw new Error('Varyant bulunamadı.')

  const data: Record<string, unknown> = {}
  if (input.varyantAdi !== undefined && input.varyantAdi.trim()) {
    data.varyantAdi = input.varyantAdi.trim()
  }
  if (input.beden !== undefined) data.beden = input.beden
  if (input.numara !== undefined) data.numara = input.numara
  if (input.renk !== undefined) data.renk = input.renk

  if (Object.keys(data).length === 0) {
    throw new Error('Güncellenecek alan gönderilmedi.')
  }

  const sonuc = await prisma.envanterUrunVaryant.update({
    where: { id: input.varyantId },
    data,
  })
  await logEnvanterIslem({
    actorId: input.actorId,
    actorAd: input.actorAd,
    islemTipi: 'VARYANT_GUNCELLE',
    hedefTip: 'VARYANT',
    hedefId: input.varyantId,
    detay: data,
  })
  return sonuc
}

export async function deleteVaryant(varyantId: string, actorId?: string, actorAd?: string) {
  const varyant = await prisma.envanterUrunVaryant.findUnique({
    where: { id: varyantId },
    include: { stoklar: { select: { id: true } } },
  })
  if (!varyant) throw new Error('Varyant bulunamadı.')
  if (!varyant.aktif) {
    return { pasifleştirildi: false, silindi: false, mesaj: 'Varyant zaten pasif.' }
  }

  const stokIdleri = varyant.stoklar.map((s) => s.id)

  const hareketSayisi = await prisma.envanterStokHareket.count({
    where: { varyantId },
  })

  const zimmetSayisi =
    stokIdleri.length > 0
      ? await prisma.envanterZimmet.count({
          where: { stokId: { in: stokIdleri } },
        })
      : 0

  if (hareketSayisi > 0 || zimmetSayisi > 0) {
    // Geçmişi var — hard-delete edilemez, pasifleştir.
    await prisma.envanterUrunVaryant.update({
      where: { id: varyantId },
      data: { aktif: false },
    })
    await logEnvanterIslem({
      actorId,
      actorAd,
      islemTipi: 'VARYANT_SIL',
      hedefTip: 'VARYANT',
      hedefId: varyantId,
      detay: { sonuc: 'pasiflestirildi', hareketSayisi, zimmetSayisi },
    })
    return {
      pasifleştirildi: true,
      silindi: false,
      mesaj: `Varyantın ${hareketSayisi} hareket ve ${zimmetSayisi} zimmet geçmişi var, bu yüzden pasifleştirildi (silinmedi).`,
    }
  }

  // Geçmişi yok — hard-delete (varyant + boş stok kayıtları).
  await prisma.$transaction([
    prisma.envanterStok.deleteMany({ where: { varyantId } }),
    prisma.envanterUrunVaryant.delete({ where: { id: varyantId } }),
  ])

  await logEnvanterIslem({
    actorId,
    actorAd,
    islemTipi: 'VARYANT_SIL',
    hedefTip: 'VARYANT',
    hedefId: varyantId,
    detay: { sonuc: 'silindi' },
  })

  return { pasifleştirildi: false, silindi: true, mesaj: 'Varyant silindi.' }
}
