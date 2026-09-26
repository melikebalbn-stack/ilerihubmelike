// MASTER Madde 47 — Servis firması performans ölçüleri (şikâyet tabanlı).
//
// Yapı emsali: src/lib/quality/rma-kpi.ts — ayrı bir *-kpi.ts dosyası,
// kırılımlar DB tarafında groupBy ile. FARK: rma-kpi.ts yüzde/oran da
// üretiyor, BURADA ÜRETİLMİYOR (aşağıya bakın).
//
// 🔴 ORAN/YÜZDE YOK (Ders 79). Şikâyet KENDİ KENDİNE BİLDİRİLEN veridir:
// kaç sefer yapıldığını bilmiyoruz, yalnız kaçının şikâyet edildiğini
// biliyoruz. Paydası olmayan bir sayıdan "zamanında hizmet %93" türetmek
// uydurmadır. Tüm ölçüler MUTLAK SAYI.
// TEK İSTİSNA ortalama kapanış süresi: onun paydası VAR (kapanan şikâyet
// sayısı) ve o sayı `kapananKayitSayisi` olarak AÇIKÇA döndürülür — çağıran
// "N kapanan kayıt üzerinden" diye gösterebilsin.
//
// 🔴 REDDEDILDI FİRMAYI CEZALANDIRMAZ (şema notu, madde 47): reddedilen
// şikâyet "incelendi, yersiz" demektir. `toplamSikayet`e DAHİL EDİLMEZ,
// `reddedilenSayisi` olarak AYRI döner. Ortalama kapanış süresine de
// girmez — o yalnız KAPANDI üzerinden hesaplanır.
import { prisma } from '@/lib/prisma'
import type { ServisSikayetDurumu, ServisSikayetKategori } from '@/generated/prisma'
import { sikayetWhereOlustur, type SikayetFiltresi } from './sikayet'

export interface SikayetKpi {
  /** 🔴 REDDEDILDI HARİÇ toplam. Firma performansının paydası bu değil,
   *  yalnız hacim göstergesi — oran hesaplamak için KULLANILMAZ. */
  toplamSikayet: number
  /** Ayrı gösterilir; toplama dahil DEĞİL. */
  reddedilenSayisi: number

  durumKirilim: { durum: ServisSikayetDurumu; adet: number }[]
  kategoriKirilim: { kategori: ServisSikayetKategori; adet: number }[]
  /** 🟢 durakId main'e girdiği için artık ölçülebiliyor (madde 47 kör noktası). */
  durakKirilim: { durakId: string | null; adet: number }[]

  /** Gün cinsinden ortalama; kapanan kayıt yoksa null. */
  ortalamaKapanisGunu: number | null
  /** Ortalamanın PAYDASI — açıkça döndürülür, "N kapanan kayıt üzerinden". */
  kapananKayitSayisi: number

  /** KAPANDI/REDDEDILDI → ACIK geçişi yaşamış AYRI kayıt sayısı. */
  yenidenAcilanSayisi: number
}

/** REDDEDILDI'yi dışarıda bırakan where — toplam ve kırılımlar bunu kullanır. */
function reddedilenHaricWhere(filtre: SikayetFiltresi) {
  const temel = sikayetWhereOlustur(filtre)
  // Çağıran açıkça durum filtrelediyse ona saygı duyulur; aksi hâlde
  // REDDEDILDI dışarıda bırakılır.
  if (temel.durum) return temel
  return { ...temel, durum: { not: 'REDDEDILDI' as ServisSikayetDurumu } }
}

export async function sikayetKpiHesapla(filtre: SikayetFiltresi = {}): Promise<SikayetKpi> {
  const where = reddedilenHaricWhere(filtre)
  const tumWhere = sikayetWhereOlustur(filtre)

  const [
    toplamSikayet,
    reddedilenSayisi,
    durumGrup,
    kategoriGrup,
    durakGrup,
    kapananlar,
    yenidenAcmaIzleri,
  ] = await Promise.all([
    prisma.servisSikayet.count({ where }),
    prisma.servisSikayet.count({ where: { ...tumWhere, durum: 'REDDEDILDI' } }),

    // Durum kırılımı TÜM durumları gösterir (reddedilen dahil) — kırılımın
    // amacı dağılımı göstermek; toplamdan dışlama yalnız `toplamSikayet`te.
    prisma.servisSikayet.groupBy({ by: ['durum'], where: tumWhere, _count: { _all: true } }),
    prisma.servisSikayet.groupBy({ by: ['kategori'], where, _count: { _all: true } }),
    prisma.servisSikayet.groupBy({ by: ['durakId'], where, _count: { _all: true } }),

    // 🔴 YALNIZ KAPANDI. Reddedilenler buraya girmez.
    //
    // Ortalama JS'te alınıyor: Prisma iki tarih kolonunun FARKINI aggregate
    // edemiyor (AVG yalnız tek sayısal kolon üzerinde çalışır), ham SQL ise
    // esnek filtreyi elle kurmayı gerektirirdi. Emsalin "hesap DB tarafında"
    // ilkesinden BİLİNÇLİ sapma; iki koruma altında:
    //   1. Yalnız İKİ tarih kolonu seçiliyor — kişisel veri çekilmiyor.
    //   2. `tumWhere` filtreyi taşıyor; bildirimBaslangic/bildirimBitis
    //      verildiğinde satır kümesi o aralıkla SINIRLI kalıyor. Rapor
    //      ekranı (5E) dönem seçimiyle çalışacağı için pratikte hep sınırlı.
    // HACİM BÜYÜRSE (filtresiz çağrı binlerce kapanmış kayıt döndürmeye
    // başlarsa) hesap DB tarafına, $queryRaw AVG(EXTRACT(EPOCH ...))'a
    // TAŞINACAK.
    prisma.servisSikayet.findMany({
      where: { ...tumWhere, durum: 'KAPANDI', kapanisTarihi: { not: null } },
      select: { bildirimTarihi: true, kapanisTarihi: true },
    }),

    // Yeniden açılma tarihçeden okunur: yeniDeger.durum = ACIK ve
    // oncekiDeger.durum kapalı bir durum. Kaydın kendisi şu an hangi
    // durumda olursa olsun, GEÇMİŞTE yeniden açılmış olması sayılır.
    prisma.servisIslemGecmisi.findMany({
      where: {
        hedefTipi: 'SIKAYET',
        yeniDeger: { path: ['durum'], equals: 'ACIK' },
        OR: [
          { oncekiDeger: { path: ['durum'], equals: 'KAPANDI' } },
          { oncekiDeger: { path: ['durum'], equals: 'REDDEDILDI' } },
        ],
      },
      select: { hedefId: true },
      distinct: ['hedefId'],
    }),
  ])

  const sureler = kapananlar
    .filter(k => k.kapanisTarihi)
    .map(k => (k.kapanisTarihi!.getTime() - k.bildirimTarihi.getTime()) / 86_400_000)

  return {
    toplamSikayet,
    reddedilenSayisi,
    durumKirilim: durumGrup.map(g => ({ durum: g.durum, adet: g._count._all })),
    kategoriKirilim: kategoriGrup.map(g => ({ kategori: g.kategori, adet: g._count._all })),
    durakKirilim: durakGrup.map(g => ({ durakId: g.durakId, adet: g._count._all })),
    ortalamaKapanisGunu:
      sureler.length === 0 ? null : Math.round((sureler.reduce((a, b) => a + b, 0) / sureler.length) * 10) / 10,
    kapananKayitSayisi: sureler.length,
    yenidenAcilanSayisi: yenidenAcmaIzleri.length,
  }
}
