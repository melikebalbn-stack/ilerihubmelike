/**
 * RMA/SMA KPI hesaplaması (KAL-KYT-16).
 *
 * TEK KAYNAK: uç (api/quality/rma/kpi) yalnız filtreyi çözer, hesap burada.
 * Filtre `buildRmaWhere` ile listeyle BİREBİR aynı — ıraksamasın.
 *
 * HESAP DB TARAFINDA: groupBy/aggregate/count. Tüm kayıtları çekip JS'te
 * toplama YOK. Tek istisna ortalama kapanma süresi — Prisma tarih farkının
 * AVG'sini alamaz ve dinamik `where` objesi ham SQL'e güvenle taşınamaz;
 * orada YALNIZ kapalı kayıtların 3 tarih kolonu çekilir (dar projeksiyon).
 *
 * "YETERSİZ VERİ": eşik SABİT KODLANMAZ, doluluk her istekte hesaplanır →
 * alan doldukça metrik kendiliğinden açılır (kod değişikliği gerekmez).
 */
import { prisma } from '@/lib/prisma'
import { Prisma, RmaDurum, RmaIadeTuru, RmaKarar, RmaTip } from '@/generated/prisma'

/** İlgili alan kayıtların %20'sinden azında doluysa metrik hesaplanmaz. */
export const YETERSIZ_ESIK = 0.2

/** Aylık kırılım penceresi (bu ay dahil, geriye doğru). */
export const AYLIK_PENCERE = 12

/** Top-N listelerinin uzunluğu. */
const TOP_N = 10

export type Doluluk = { dolu: number; toplam: number; oran: number }

export type Metrik<T> =
  | { durum: 'hesaplandi'; doluluk: Doluluk; veri: T; not?: string }
  | { durum: 'yetersiz'; doluluk: Doluluk; sebep: string }

export type RmaKpi = {
  filtreAktif: boolean
  toplam: {
    kayit: number
    satir: number
    iadeMiktari: number
    ortSatirPerKayit: number
  }
  tipKirilim: { tip: RmaTip; adet: number; yuzde: number }[]
  aylik: { ay: string; label: string; adet: number }[]
  topMusteri: { musteriId: string; kod: string; ad: string; kayit: number }[]
  topUrun: { urunKodu: string; satir: number; miktar: number }[]
  kararDagilim: { karar: RmaKarar | null; adet: number; yuzde: number }[]
  hurdaRework: {
    hurda: number
    rework: number
    iadeMiktari: number
    hurdaOran: number
    reworkOran: number
  }
  yetersiz: {
    kapanmaSuresi: Metrik<{ ortalamaGun: number; medyanGun: number; kapaliSayi: number }>
    acikKapali: Metrik<{ dagilim: { durum: RmaDurum; adet: number; yuzde: number }[] }>
    iadeTuru: Metrik<{ dagilim: { iadeTuru: RmaIadeTuru; adet: number; yuzde: number }[] }>
    sorumluYuk: Metrik<{ dagilim: { sorumluId: string; ad: string; adet: number }[] }>
    kokNeden: Metrik<{ dagilim: { kokNeden: string; adet: number }[] }>
  }
}

// ── Yardımcılar ──

/** Sıfıra bölme guard'lı yüzde (0..100, 1 ondalık). */
function yuzde(pay: number, payda: number): number {
  if (payda <= 0) return 0
  return Math.round((pay / payda) * 1000) / 10
}

/** Sıfıra bölme guard'lı oran (0..1). */
function oran(pay: number, payda: number): number {
  if (payda <= 0) return 0
  return pay / payda
}

function birOndalik(n: number): number {
  return Math.round(n * 10) / 10
}

function doluluk(dolu: number, toplam: number): Doluluk {
  return { dolu, toplam, oran: oran(dolu, toplam) }
}

/**
 * "115 kaydın 8 tanesinde iade türü dolu (%7) — eşik %20"
 *
 * "8'inde" yerine "8 tanesinde": Türkçe sayı+bulunma eki düzensiz
 * (0'ında · 3'ünde · 8'inde · 6'sında) ve sayı runtime'da değişiyor;
 * "tanesinde" her sayıda doğru okunur. `birim` GENİTİF halde verilir.
 */
function dolulukSebebi(d: Doluluk, alanAdi: string, birim = 'kaydın'): string {
  const yuzdeStr = yuzde(d.dolu, d.toplam)
  return `${d.toplam} ${birim} ${d.dolu} tanesinde ${alanAdi} dolu (%${yuzdeStr}) — eşik %${YETERSIZ_ESIK * 100}`
}

// Türkçe kısa ay adları — toLocaleDateString yerine sabit dizi: sunucu locale'i
// (ICU eksik/farklı) sonucu değiştirmesin.
const AY_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

/** Son AYLIK_PENCERE ayın [başlangıç, bitiş) sınırları + etiketleri. */
function aylikKovalar(now = new Date()): { ay: string; label: string; bas: Date; son: Date }[] {
  const out: { ay: string; label: string; bas: Date; son: Date }[] = []
  for (let i = AYLIK_PENCERE - 1; i >= 0; i--) {
    const bas = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const son = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const y = bas.getFullYear()
    const m = bas.getMonth()
    out.push({
      ay: `${y}-${String(m + 1).padStart(2, '0')}`,
      label: `${AY_KISA[m]} ${String(y).slice(2)}`,
      bas,
      son,
    })
  }
  return out
}

/** Liste ucundaki filtre parametrelerinden biri geldi mi. */
export function rmaFiltreAktif(sp: URLSearchParams): boolean {
  return ['tip', 'musteriId', 'durum', 'from', 'to', 'q', 'sadeceBana'].some((k) => {
    const v = sp.get(k)
    return v !== null && v.trim() !== ''
  })
}

// ── Ana hesap ──

export async function rmaKpiHesapla(
  where: Prisma.RmaKayitWhereInput,
  filtreAktif: boolean,
): Promise<RmaKpi> {
  // Satır seviyesi filtre = başlık filtresinin ilişki üzerinden yansıması.
  const satirWhere: Prisma.RmaSatirWhereInput = { rmaKayit: where }

  const kovalar = aylikKovalar()

  const [
    toplamKayit,
    satirOzet,
    tipGrup,
    aylikSayilar,
    musteriGrup,
    urunGrup,
    kararGrup,
    durumGrup,
    iadeTuruGrup,
    sorumluGrup,
    kokNedenDolu,
    kapanisDolu,
    toplamSatirSayisi,
  ] = await Promise.all([
    prisma.rmaKayit.count({ where }),

    // #1 + #7 tek sorguda: satır sayısı + miktar + hurda + rework
    prisma.rmaSatir.aggregate({
      where: satirWhere,
      _count: { _all: true },
      _sum: { iadeMiktari: true, hurdaAdedi: true, reworkAdedi: true },
    }),

    prisma.rmaKayit.groupBy({ by: ['tip'], where, _count: { _all: true } }),

    // #3: 12 indeksli COUNT. Mevcut from/to filtresi AND ile KORUNUR (ezilmez).
    Promise.all(
      kovalar.map((k) =>
        prisma.rmaKayit.count({
          where: { AND: [where, { irsaliyeTarihi: { gte: k.bas, lt: k.son } }] },
        }),
      ),
    ),

    // #4: kayıt adedine göre top 10 (miktar kolonu YOK — ek aggregate yapılmıyor)
    prisma.rmaKayit.groupBy({
      by: ['musteriId'],
      where,
      _count: { _all: true },
      orderBy: { _count: { musteriId: 'desc' } },
      take: TOP_N,
    }),

    // #5
    prisma.rmaSatir.groupBy({
      by: ['urunKodu'],
      where: satirWhere,
      _count: { _all: true },
      _sum: { iadeMiktari: true },
      orderBy: { _count: { urunKodu: 'desc' } },
      take: TOP_N,
    }),

    // #6 — null kovası "Karar bekliyor"
    prisma.rmaSatir.groupBy({ by: ['karar'], where: satirWhere, _count: { _all: true } }),

    // #10
    prisma.rmaKayit.groupBy({ by: ['durum'], where, _count: { _all: true } }),

    // #11 — null kovası doluluğu aynı sorgudan verir
    prisma.rmaKayit.groupBy({ by: ['iadeTuru'], where, _count: { _all: true } }),

    // #12 — null kovası doluluğu aynı sorgudan verir
    prisma.rmaKayit.groupBy({
      by: ['sorumluId'],
      where,
      _count: { _all: true },
      orderBy: { _count: { sorumluId: 'desc' } },
    }),

    // #13 doluluk (satır seviyesi)
    prisma.rmaSatir.count({ where: { ...satirWhere, kokNeden: { not: null } } }),

    // #9 doluluk
    prisma.rmaKayit.count({ where: { AND: [where, { kapanisTarihi: { not: null } }] } }),

    prisma.rmaSatir.count({ where: satirWhere }),
  ])

  const toplamSatir = satirOzet._count._all
  const toplamMiktar = satirOzet._sum.iadeMiktari ?? 0
  const hurda = satirOzet._sum.hurdaAdedi ?? 0
  const rework = satirOzet._sum.reworkAdedi ?? 0

  // ── #2 tip kırılımı ──
  const tipKirilim = (['RMA', 'SMA'] as RmaTip[]).map((tip) => {
    const adet = tipGrup.find((g) => g.tip === tip)?._count._all ?? 0
    return { tip, adet, yuzde: yuzde(adet, toplamKayit) }
  })

  // ── #4 müşteri adları (top 10 için tek toplu sorgu) ──
  const musteriIdler = musteriGrup.map((g) => g.musteriId)
  const musteriler = musteriIdler.length
    ? await prisma.costCustomer.findMany({
        where: { id: { in: musteriIdler } },
        select: { id: true, name: true, code: true },
      })
    : []
  const musteriMap = new Map(musteriler.map((m) => [m.id, m]))
  const topMusteri = musteriGrup.map((g) => ({
    musteriId: g.musteriId,
    kod: musteriMap.get(g.musteriId)?.code ?? '—',
    ad: musteriMap.get(g.musteriId)?.name ?? '(bilinmeyen müşteri)',
    kayit: g._count._all,
  }))

  // ── #6 karar dağılımı (adet azalan) ──
  const kararDagilim = kararGrup
    .map((g) => ({
      karar: g.karar,
      adet: g._count._all,
      yuzde: yuzde(g._count._all, toplamSatir),
    }))
    .sort((a, b) => b.adet - a.adet)

  // ── #9 ortalama kapanma süresi ──
  const kapanisDol = doluluk(kapanisDolu, toplamKayit)
  const kapanmaSuresi = await hesaplaKapanmaSuresi(where, kapanisDol)

  // ── #10 açık/kapalı — doluluk %100 (kolon NOT NULL), EK OLARAK varyans kuralı ──
  const durumDagilim = (['ACIK', 'KAPALI'] as RmaDurum[]).map((d) => {
    const adet = durumGrup.find((g) => g.durum === d)?._count._all ?? 0
    return { durum: d, adet, yuzde: yuzde(adet, toplamKayit) }
  })
  const durumDoluluk = doluluk(toplamKayit, toplamKayit) // kolon NOT NULL
  // VARYANS KURALI — YALNIZ bu metrikte: tek kova %100 ise kırılım anlamsız.
  const tekKova = toplamKayit > 0 ? durumDagilim.find((d) => d.adet === toplamKayit) : undefined
  const acikKapali: Metrik<{ dagilim: typeof durumDagilim }> = tekKova
    ? {
        durum: 'yetersiz',
        doluluk: durumDoluluk,
        sebep: `tüm kayıtlar aynı durumda (${tekKova.durum})`,
      }
    : { durum: 'hesaplandi', doluluk: durumDoluluk, veri: { dagilim: durumDagilim } }

  // ── #11 iade türü ──
  const iadeTuruDolu = iadeTuruGrup
    .filter((g) => g.iadeTuru !== null)
    .reduce((s, g) => s + g._count._all, 0)
  const iadeTuruDol = doluluk(iadeTuruDolu, toplamKayit)
  const iadeTuru: RmaKpi['yetersiz']['iadeTuru'] =
    iadeTuruDol.oran >= YETERSIZ_ESIK
      ? {
          durum: 'hesaplandi',
          doluluk: iadeTuruDol,
          veri: {
            dagilim: iadeTuruGrup
              .filter((g): g is typeof g & { iadeTuru: RmaIadeTuru } => g.iadeTuru !== null)
              .map((g) => ({
                iadeTuru: g.iadeTuru,
                adet: g._count._all,
                yuzde: yuzde(g._count._all, iadeTuruDolu),
              }))
              .sort((a, b) => b.adet - a.adet),
          },
        }
      : { durum: 'yetersiz', doluluk: iadeTuruDol, sebep: dolulukSebebi(iadeTuruDol, 'iade türü') }

  // ── #12 sorumlu yükü ──
  const sorumluDoluGruplar = sorumluGrup.filter(
    (g): g is typeof g & { sorumluId: string } => g.sorumluId !== null,
  )
  const sorumluDolu = sorumluDoluGruplar.reduce((s, g) => s + g._count._all, 0)
  const sorumluDol = doluluk(sorumluDolu, toplamKayit)
  let sorumluYuk: RmaKpi['yetersiz']['sorumluYuk']
  if (sorumluDol.oran >= YETERSIZ_ESIK) {
    const kisiler = await prisma.personnel.findMany({
      where: { id: { in: sorumluDoluGruplar.map((g) => g.sorumluId) } },
      select: { id: true, adSoyad: true },
    })
    const adMap = new Map(kisiler.map((k) => [k.id, k.adSoyad]))
    sorumluYuk = {
      durum: 'hesaplandi',
      doluluk: sorumluDol,
      veri: {
        dagilim: sorumluDoluGruplar.slice(0, TOP_N).map((g) => ({
          sorumluId: g.sorumluId,
          ad: adMap.get(g.sorumluId) ?? '(bilinmeyen personel)',
          adet: g._count._all,
        })),
      },
    }
  } else {
    sorumluYuk = {
      durum: 'yetersiz',
      doluluk: sorumluDol,
      sebep: dolulukSebebi(sorumluDol, 'sorumlu'),
    }
  }

  // ── #13 kök neden (ham metin, normalize YOK) ──
  const kokNedenDol = doluluk(kokNedenDolu, toplamSatirSayisi)
  let kokNeden: RmaKpi['yetersiz']['kokNeden']
  if (kokNedenDol.oran >= YETERSIZ_ESIK) {
    const grup = await prisma.rmaSatir.groupBy({
      by: ['kokNeden'],
      where: { ...satirWhere, kokNeden: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { kokNeden: 'desc' } },
      take: TOP_N,
    })
    kokNeden = {
      durum: 'hesaplandi',
      doluluk: kokNedenDol,
      veri: {
        dagilim: grup
          .filter((g): g is typeof g & { kokNeden: string } => g.kokNeden !== null)
          .map((g) => ({ kokNeden: g.kokNeden, adet: g._count._all })),
      },
      not: 'Serbest metin — yazım farkları ayrı satır olarak görünür.',
    }
  } else {
    kokNeden = {
      durum: 'yetersiz',
      doluluk: kokNedenDol,
      sebep: dolulukSebebi(kokNedenDol, 'kök neden', 'satırın'),
    }
  }

  return {
    filtreAktif,
    toplam: {
      kayit: toplamKayit,
      satir: toplamSatir,
      iadeMiktari: toplamMiktar,
      ortSatirPerKayit: birOndalik(oran(toplamSatir, toplamKayit)),
    },
    tipKirilim,
    aylik: kovalar.map((k, i) => ({ ay: k.ay, label: k.label, adet: aylikSayilar[i] })),
    topMusteri,
    topUrun: urunGrup
      .map((g) => ({
        urunKodu: g.urunKodu,
        satir: g._count._all,
        miktar: g._sum.iadeMiktari ?? 0,
      }))
      .sort((a, b) => b.satir - a.satir),
    kararDagilim,
    hurdaRework: {
      hurda,
      rework,
      iadeMiktari: toplamMiktar,
      hurdaOran: yuzde(hurda, toplamMiktar),
      reworkOran: yuzde(rework, toplamMiktar),
    },
    yetersiz: { kapanmaSuresi, acikKapali, iadeTuru, sorumluYuk, kokNeden },
  }
}

/**
 * Ortalama/medyan kapanma süresi.
 *
 * Eşik aşılmazsa SORGU YAPILMAZ. Aşarsa YALNIZ kapalı kayıtların 3 tarih
 * kolonu çekilir (dar projeksiyon) — Prisma tarih farkının AVG'sini alamıyor,
 * dinamik `where` objesi de ham SQL'e taşınamıyor.
 *
 * Başlangıç: irsaliyeTarihi ?? urunGelisTarihi. İkisi de boşsa kayıt HESAP
 * DIŞI; bu düşüm `not` (ya da hepsi düşerse `sebep`) metninde görünür.
 */
async function hesaplaKapanmaSuresi(
  where: Prisma.RmaKayitWhereInput,
  dol: Doluluk,
): Promise<RmaKpi['yetersiz']['kapanmaSuresi']> {
  if (dol.oran < YETERSIZ_ESIK) {
    return { durum: 'yetersiz', doluluk: dol, sebep: dolulukSebebi(dol, 'kapanış tarihi') }
  }

  const kapalilar = await prisma.rmaKayit.findMany({
    where: { AND: [where, { kapanisTarihi: { not: null } }] },
    select: { irsaliyeTarihi: true, urunGelisTarihi: true, kapanisTarihi: true },
  })

  const gunler: number[] = []
  let hesapDisi = 0
  for (const k of kapalilar) {
    const bas = k.irsaliyeTarihi ?? k.urunGelisTarihi
    if (!bas || !k.kapanisTarihi) {
      hesapDisi++
      continue
    }
    gunler.push((k.kapanisTarihi.getTime() - bas.getTime()) / 86_400_000)
  }

  if (gunler.length === 0) {
    return {
      durum: 'yetersiz',
      doluluk: dol,
      sebep: `${kapalilar.length} kapalı kaydın tamamında başlangıç tarihi (irsaliye / ürün geliş) boş — süre hesaplanamıyor`,
    }
  }

  gunler.sort((a, b) => a - b)
  const orta = Math.floor(gunler.length / 2)
  const medyan = gunler.length % 2 === 0 ? (gunler[orta - 1] + gunler[orta]) / 2 : gunler[orta]

  return {
    durum: 'hesaplandi',
    doluluk: dol,
    veri: {
      ortalamaGun: birOndalik(gunler.reduce((s, g) => s + g, 0) / gunler.length),
      medyanGun: birOndalik(medyan),
      kapaliSayi: gunler.length,
    },
    ...(hesapDisi > 0
      ? {
          not: `${hesapDisi} kapalı kayıt başlangıç tarihi (irsaliye / ürün geliş) boş olduğu için hesap dışı.`,
        }
      : {}),
  }
}
