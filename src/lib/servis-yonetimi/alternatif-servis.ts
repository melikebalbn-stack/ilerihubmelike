import { prisma } from '@/lib/prisma'

// FAZ 1B — Alternatif Servis Önerisi. Bir personelin mevcut atamasına göre
// (aynı durağa uğrayan + boş koltuğu olan servisler, yoksa mesafe eşiği
// içindeki servisler) alternatif güzergah önerir. Bu dosya YALNIZ öneri
// ÜRETİR — transfer (atama güncelleme) ayrı bir onay adımıdır, bkz.
// transferServisPersonelAtama() (service.ts).

const DUNYA_YARICAPI_KM = 6371

export type Koordinat = { enlem: number; boylam: number }

// İki koordinat arası düz hat (kuş uçuşu) mesafe — haversine formülü.
export function haversineKm(a: Koordinat, b: Koordinat): number {
  const radyan = (derece: number) => (derece * Math.PI) / 180
  const dEnlem = radyan(b.enlem - a.enlem)
  const dBoylam = radyan(b.boylam - a.boylam)
  const lat1 = radyan(a.enlem)
  const lat2 = radyan(b.enlem)

  const h = Math.sin(dEnlem / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dBoylam / 2) ** 2
  return 2 * DUNYA_YARICAPI_KM * Math.asin(Math.sqrt(h))
}

// SystemSetting üzerinden okunan mesafe eşiği — hardcode değil, DB'de kayıt
// yoksa bu varsayılana düşülür. Desen: src/lib/sla/index.ts (SLA_AYAR_KEY).
export const ALTERNATIF_ESIK_KM_AYAR_KEY = 'servis_alternatif_esik_km'
export const VARSAYILAN_ESIK_KM = 5

export async function alternatifEsikKmGetir(): Promise<number> {
  const kayit = await prisma.systemSetting.findUnique({ where: { key: ALTERNATIF_ESIK_KM_AYAR_KEY } })
  if (!kayit) return VARSAYILAN_ESIK_KM

  const deger = Number(kayit.value)
  if (!Number.isFinite(deger) || deger <= 0) {
    console.warn(`[servis-yonetimi] '${ALTERNATIF_ESIK_KM_AYAR_KEY}' geçersiz değer ("${kayit.value}") → varsayılan ${VARSAYILAN_ESIK_KM} km`)
    return VARSAYILAN_ESIK_KM
  }
  return deger
}

export type OneriKategorisi = 'ORTAK_DURAK_BOS_KOLTUK' | 'MESAFE_ESIGI_ICINDE'

export type OneriAday<T> = T & {
  ortakDurakVar: boolean
  bosKoltukVar: boolean
  mesafeKm: number | null
}

export type Oneri<T> = T & {
  kategori: OneriKategorisi
  mesafeKm: number | null
}

// Öneri sıralama kuralı: önce ORTAK_DURAK_BOS_KOLTUK (personelin zaten
// kullandığı durağa uğrayan VE boş koltuğu olan servisler), sonra
// MESAFE_ESIGI_ICINDE (yalnız mesafe eşiği içinde kalanlar, ortak durak/boş
// koltuk şartı aranmaz). Her iki şartı da sağlamayan adaylar listeye hiç
// girmez. Kategori içinde mesafeye göre (yakın önce) sıralanır — mesafeKm
// null olan (mesafe hesaplanamayan, örn. koordinatı eksik durak) adaylar o
// kategorinin sonuna düşer.
export function oneriSirala<T>(adaylar: OneriAday<T>[], esikKm: number): Oneri<T>[] {
  const kategoriser = (aday: OneriAday<T>): OneriKategorisi | null => {
    if (aday.ortakDurakVar && aday.bosKoltukVar) return 'ORTAK_DURAK_BOS_KOLTUK'
    if (aday.mesafeKm !== null && aday.mesafeKm <= esikKm) return 'MESAFE_ESIGI_ICINDE'
    return null
  }

  const siraDegeri: Record<OneriKategorisi, number> = { ORTAK_DURAK_BOS_KOLTUK: 0, MESAFE_ESIGI_ICINDE: 1 }

  return adaylar
    .map((aday) => ({ ...aday, kategori: kategoriser(aday) }))
    .filter((aday): aday is OneriAday<T> & { kategori: OneriKategorisi } => aday.kategori !== null)
    .sort((a, b) => {
      const kategoriFarki = siraDegeri[a.kategori] - siraDegeri[b.kategori]
      if (kategoriFarki !== 0) return kategoriFarki
      if (a.mesafeKm === null && b.mesafeKm === null) return 0
      if (a.mesafeKm === null) return 1
      if (b.mesafeKm === null) return -1
      return a.mesafeKm - b.mesafeKm
    })
}

// ── GEÇİCİ boş-koltuk hesaplaması ───────────────────────────────────────────
// TODO(kapasite-dalı): dev/elif/servis-yonetimi-shared-surfaces (veya onu
// izleyen kapasite dalı) main'e girdiğinde bu fonksiyon CANONICAL kapasite
// fonksiyonuyla değiştirilecek. Bu, yalnız ANLIK duruma bakan (zaman dilimi/
// tarih aralığı FARKI GÖZETMEYEN, sadece "şu an aktif" kayıtları sayan) basit
// bir yaklaşımdır — iki dal da main'e girmeden önce MUTLAKA reconcile
// edilmeli. Elif bunu açık madde olarak takip ediyor.
export async function bosKoltukSayisiGetirGECICI(guzergahId: string, dilimId: string): Promise<number> {
  const [anaAraclar, doluKoltukSayisi] = await Promise.all([
    prisma.servisGuzergahAracVarsayilan.findMany({
      where: { guzergahId, dilimId, rol: 'ANA', aktif: true },
      include: { arac: { select: { kapasite: true } } },
    }),
    prisma.servisPersonelAtama.count({
      where: { guzergahId, aktif: true, dilimler: { some: { dilimId } } },
    }),
  ])
  const kapasiteToplami = anaAraclar.reduce((toplam, v) => toplam + v.arac.kapasite, 0)

  return Math.max(0, kapasiteToplami - doluKoltukSayisi)
}

// Prisma.Decimal (enlem/boylam) → number. Duck-type — audit.ts'teki
// normalizeKarsilastirma ile aynı gerekçe (bkz. orada).
function decimalSayi(deger: unknown): number | null {
  if (deger === null || deger === undefined) return null
  if (typeof deger === 'object' && 'toNumber' in deger && typeof (deger as { toNumber: unknown }).toNumber === 'function') {
    return (deger as { toNumber: () => number }).toNumber()
  }
  return Number(deger)
}

export type AlternatifServisOnerisi = {
  guzergahId: string
  guzergahKod: string
  guzergahAd: string
  kategori: OneriKategorisi
  mesafeKm: number | null
  enYakinDurak: { id: string; kod: string; ad: string } | null
  uygunDilimIdleri: string[]
}

// Bir personel atamasına (mevcut güzergah+durak+dilimler) göre alternatif
// güzergah önerileri üretir. YALNIZ öneri üretir — hiçbir yazma işlemi
// yapmaz. Personelin sabit bir durağı yoksa (durakId null) ortak-durak/
// mesafe kıyaslaması yapılamayacağından boş dizi döner.
export async function alternatifServisOnerileriGetir(atamaId: string): Promise<AlternatifServisOnerisi[]> {
  const atama = await prisma.servisPersonelAtama.findUnique({
    where: { id: atamaId },
    include: {
      durak: { select: { id: true, enlem: true, boylam: true } },
      dilimler: { select: { dilimId: true } },
    },
  })
  if (!atama) throw new Error('Personel ataması bulunamadı.')
  if (!atama.aktif) throw new Error('Pasif bir atama için öneri üretilemez.')
  if (!atama.durak) return []

  const personelKoordinat: Koordinat | null =
    decimalSayi(atama.durak.enlem) !== null && decimalSayi(atama.durak.boylam) !== null
      ? { enlem: decimalSayi(atama.durak.enlem)!, boylam: decimalSayi(atama.durak.boylam)! }
      : null

  const dilimIdleri = atama.dilimler.map((d) => d.dilimId)

  const adayGuzergahlar = await prisma.servisGuzergah.findMany({
    where: { id: { not: atama.guzergahId }, aktif: true },
    select: {
      id: true,
      kod: true,
      ad: true,
      duraklar: {
        where: { aktif: true },
        select: { durakId: true, durak: { select: { id: true, kod: true, ad: true, enlem: true, boylam: true } } },
      },
    },
  })

  const esikKm = await alternatifEsikKmGetir()

  const adaylar = await Promise.all(
    adayGuzergahlar.map(async (guzergah) => {
      const ortakDurakVar = guzergah.duraklar.some((gd) => gd.durakId === atama.durakId)

      let mesafeKm: number | null = null
      let enYakinDurak: AlternatifServisOnerisi['enYakinDurak'] = null
      if (personelKoordinat) {
        for (const gd of guzergah.duraklar) {
          const enlem = decimalSayi(gd.durak.enlem)
          const boylam = decimalSayi(gd.durak.boylam)
          if (enlem === null || boylam === null) continue
          const mesafe = haversineKm(personelKoordinat, { enlem, boylam })
          if (mesafeKm === null || mesafe < mesafeKm) {
            mesafeKm = mesafe
            enYakinDurak = { id: gd.durak.id, kod: gd.durak.kod, ad: gd.durak.ad }
          }
        }
      }

      // Personelin kullandığı dilimlerden HERHANGİ birinde boş koltuk varsa
      // "bosKoltukVar" true sayılır — tüm dilimlerde uygunluk şartı aranmaz,
      // hangi dilim(ler)de uygun olduğu ayrıca uygunDilimIdleri'nde raporlanır.
      const dilimSonuclari = await Promise.all(
        dilimIdleri.map(async (dilimId) => ({
          dilimId,
          bosKoltuk: await bosKoltukSayisiGetirGECICI(guzergah.id, dilimId),
        })),
      )
      const uygunDilimIdleri = dilimSonuclari.filter((d) => d.bosKoltuk > 0).map((d) => d.dilimId)

      return {
        guzergahId: guzergah.id,
        guzergahKod: guzergah.kod,
        guzergahAd: guzergah.ad,
        ortakDurakVar,
        bosKoltukVar: uygunDilimIdleri.length > 0,
        mesafeKm,
        enYakinDurak,
        uygunDilimIdleri,
      }
    }),
  )

  return oneriSirala(adaylar, esikKm).map(({ ortakDurakVar: _ortakDurakVar, bosKoltukVar: _bosKoltukVar, ...oneri }) => oneri)
}
