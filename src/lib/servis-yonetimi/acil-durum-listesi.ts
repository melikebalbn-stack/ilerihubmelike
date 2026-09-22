// ============================================================================
// MASTER Madde 49 — Acil Durum Servis Listesi
// ============================================================================
//
// Kaza/arıza anında yetkili kişinin TEK ekranda görmesi gerekenler: hangi araç,
// hangi şoför (ve telefonu), o seferde kimler olmalı (ve telefonları), hangi
// duraklar, kim aranacak (güzergâh sorumlusu + taşeron firma yetkilisi).
//
// ZAMAN SEMANTİĞİ — madde 29/30'dan FARKLI: bu ekran "şimdi"ye bakar. Eksen
// güzergâh + sefer dilimi + BUGÜN. Point-in-time yok.
//
// EKSİK SEMANTİĞİ (acil durumun en kritik tasarım kararı): sessiz boşluk
// KABUL EDİLEMEZ. Her blok üç durumdan birini AÇIKÇA taşır —
//   VERI_VAR            : kayıt var
//   ATANMAMIS           : kayıt YOK, düzeltilmesi gereken gerçek boşluk
//   SEFER_TANIMLI_DEGIL : boşluğun sebebi bu güzergâhın o dilimde sefer
//                         yapmaması (ServisGuzergahDurakSaat kaydı yok)
// UI "boş dizi" ile "atanmamış"ı karıştırmasın diye durum HER ZAMAN ayrı
// alanda; kayitlar boş olsa da durum okunabilir. Veri varsa durum her zaman
// VERI_VAR'dır (acil anda eldeki bilgi gizlenmez); boşluğun SEBEBİ ancak
// gerçekten boşken raporlanır.
//
// Ders 59: tarih aralığı kontrolleri POZİTİF AND-of-OR formunda
// (baslangicTarihi <= bugün AND (bitisTarihi IS NULL OR bitisTarihi >= bugün)).
//
// KVKK: madde 49 telefonu BİLEREK gösterir (MASTER zorunlu kılıyor) ama
// Personnel select'i minimumda — id/sicilNo/adSoyad/telefon. Adres, e-posta,
// TC, bölüm YOK.

import { prisma } from '@/lib/prisma'
import {
  operasyonelServisListesiGetir,
  type OperasyonelServisListesiSatiri,
} from './operasyonel-servis-listesi'

export type BlokDurumu = 'VERI_VAR' | 'ATANMAMIS' | 'SEFER_TANIMLI_DEGIL'

export interface Blok<T> {
  durum: BlokDurumu
  kayitlar: T[]
}

/** ANA/YEDEK ayrı bloklar — "ANA yok ama YEDEK var" durumu görünür kalsın.
 *  (YEDEK'in ATANMAMIS olması normaldir; UI ikisini farklı vurgular.) */
export interface RolluBlok<T> {
  ana: Blok<T>
  yedek: Blok<T>
}

export interface AcilDurumDurak {
  sira: number
  durakId: string
  durakKod: string
  durakAd: string
  il: string | null
  ilce: string | null
  /** Seçilen DİLİME ait saat (sabaha sabit değil). */
  saat: string | null
}

export interface AcilDurumArac {
  aracId: string
  plaka: string
  kapasite: number
  firmaId: string
  firmaAd: string
}

export interface AcilDurumSofor {
  soforId: string
  adSoyad: string
  /** ServisSofor.telefon birincil; boşsa dahili şoförün Personnel.telefon'u. */
  telefon: string | null
  dahiliMi: boolean
}

export interface AcilDurumSorumlu {
  personnelId: string
  sicilNo: string | null
  adSoyad: string
  telefon: string | null
}

export interface AcilDurumFirma {
  firmaId: string
  ad: string
  yetkiliAdi: string | null
  telefon: string | null
  eposta: string | null
}

export interface AcilDurumYolcu {
  personnelId: string
  sicilNo: string | null
  adSoyad: string
  durakKod: string | null
  durakAd: string | null
  telefon: string | null
}

export interface AcilDurumListesiSonucu {
  tarih: string
  guzergah: { id: string; kod: string; ad: string; yerleskeKod: string; yerleskeAd: string }
  dilim: { id: string; kod: string; ad: string; yon: string }
  /** Bu güzergâh bu dilimde sefer yapıyor mu (aktif ServisGuzergahDurakSaat). */
  seferTanimli: boolean
  duraklar: Blok<AcilDurumDurak>
  arac: RolluBlok<AcilDurumArac>
  sofor: RolluBlok<AcilDurumSofor>
  sorumlu: RolluBlok<AcilDurumSorumlu>
  firmalar: Blok<AcilDurumFirma>
  yolcular: Blok<AcilDurumYolcu>
}

export class AcilDurumListesiError extends Error {}

function gunBaslangici(d: Date): Date {
  const g = new Date(d)
  g.setUTCHours(0, 0, 0, 0)
  return g
}

/** Boşluğun SEBEBİNİ ayırt eden tek yer — veri varsa her zaman VERI_VAR. */
function blok<T>(kayitlar: T[], seferTanimli: boolean): Blok<T> {
  if (kayitlar.length > 0) return { durum: 'VERI_VAR', kayitlar }
  return { durum: seferTanimli ? 'ATANMAMIS' : 'SEFER_TANIMLI_DEGIL', kayitlar: [] }
}

export async function acilDurumListesiGetir(params: {
  guzergahId: string
  dilimId: string
}): Promise<AcilDurumListesiSonucu> {
  const { guzergahId, dilimId } = params
  const bugun = gunBaslangici(new Date())
  // Ders 59 — pozitif AND-of-OR; NOT/negatif form NULL'lu satırı sessizce atar.
  const bugunGecerli = {
    baslangicTarihi: { lte: bugun },
    OR: [{ bitisTarihi: null }, { bitisTarihi: { gte: bugun } }],
  }

  const [guzergah, dilim] = await Promise.all([
    prisma.servisGuzergah.findUnique({
      where: { id: guzergahId },
      select: { id: true, kod: true, ad: true, yerleske: { select: { kod: true, ad: true } } },
    }),
    prisma.servisSeferDilimi.findUnique({
      where: { id: dilimId },
      select: { id: true, kod: true, ad: true, yon: true },
    }),
  ])
  if (!guzergah) throw new AcilDurumListesiError('Güzergâh bulunamadı.')
  if (!dilim) throw new AcilDurumListesiError('Sefer dilimi bulunamadı.')

  const [saatSayisi, guzergahDuraklar, aracAtamalari, soforAtamalari, sorumlular, yolcuSonucu] =
    await Promise.all([
      // Bu güzergâh bu dilimde sefer yapıyor mu — güzergâh↔dilim arasındaki
      // TEK yapısal bağ (ServisGuzergahDurakSaat).
      prisma.servisGuzergahDurakSaat.count({
        where: { aktif: true, dilimId, guzergahDurak: { aktif: true, guzergahId } },
      }),
      prisma.servisGuzergahDurak.findMany({
        where: { guzergahId, aktif: true },
        orderBy: { sira: 'asc' },
        select: {
          sira: true,
          durak: { select: { id: true, kod: true, ad: true, il: true, ilce: true } },
          saatler: { where: { aktif: true, dilimId }, select: { saat: true }, take: 1 },
        },
      }),
      prisma.servisGuzergahAracVarsayilan.findMany({
        where: { guzergahId, dilimId, aktif: true, ...bugunGecerli },
        select: {
          rol: true,
          arac: {
            select: { id: true, plaka: true, kapasite: true, firmaId: true, firma: { select: { ad: true } } },
          },
        },
      }),
      prisma.servisGuzergahSoforVarsayilan.findMany({
        where: { guzergahId, dilimId, aktif: true, ...bugunGecerli },
        select: {
          rol: true,
          sofor: {
            select: {
              id: true,
              adSoyad: true,
              telefon: true,
              firmaId: true,
              personnelId: true,
              personnel: { select: { telefon: true } },
            },
          },
        },
      }),
      // ServisSorumlusu güzergâh düzeyinde (dilim kırılımı YOK) — dilimId ile
      // süzülmez, bilinçli.
      prisma.servisSorumlusu.findMany({
        where: { guzergahId, aktif: true, ...bugunGecerli },
        select: {
          rol: true,
          personnel: { select: { id: true, sicilNo: true, adSoyad: true, telefon: true } },
        },
      }),
      // Yolcu sorgusu MADDE 29'un fonksiyonundan — ikinci kez yazılmıyor.
      // Not: o fonksiyonun `sabahSaati` alanı GIDIS'e sabit olduğu için burada
      // KULLANILMAZ; saat bilgisi durak bloğundan (seçilen dilime ait) gelir.
      operasyonelServisListesiGetir({ guzergahId, dilimId }),
    ])

  const seferTanimli = saatSayisi > 0

  const duraklar = guzergahDuraklar.map(gd => ({
    sira: gd.sira,
    durakId: gd.durak.id,
    durakKod: gd.durak.kod,
    durakAd: gd.durak.ad,
    il: gd.durak.il,
    ilce: gd.durak.ilce,
    saat: gd.saatler[0]?.saat ?? null,
  }))

  const aracAna: AcilDurumArac[] = []
  const aracYedek: AcilDurumArac[] = []
  for (const a of aracAtamalari) {
    const satir: AcilDurumArac = {
      aracId: a.arac.id,
      plaka: a.arac.plaka,
      kapasite: a.arac.kapasite,
      firmaId: a.arac.firmaId,
      firmaAd: a.arac.firma.ad,
    }
    ;(a.rol === 'ANA' ? aracAna : aracYedek).push(satir)
  }

  const soforAna: AcilDurumSofor[] = []
  const soforYedek: AcilDurumSofor[] = []
  const soforFirmaIdler: string[] = []
  for (const s of soforAtamalari) {
    const satir: AcilDurumSofor = {
      soforId: s.sofor.id,
      adSoyad: s.sofor.adSoyad,
      // Telefon önceliği: ServisSofor.telefon → (dahili ise) Personnel.telefon
      telefon: s.sofor.telefon || s.sofor.personnel?.telefon || null,
      dahiliMi: s.sofor.personnelId !== null,
    }
    if (s.sofor.firmaId) soforFirmaIdler.push(s.sofor.firmaId)
    ;(s.rol === 'ANA' ? soforAna : soforYedek).push(satir)
  }

  const sorumluAna: AcilDurumSorumlu[] = []
  const sorumluYedek: AcilDurumSorumlu[] = []
  for (const s of sorumlular) {
    const satir: AcilDurumSorumlu = {
      personnelId: s.personnel.id,
      sicilNo: s.personnel.sicilNo,
      adSoyad: s.personnel.adSoyad,
      telefon: s.personnel.telefon,
    }
    ;(s.rol === 'ANA' ? sorumluAna : sorumluYedek).push(satir)
  }

  // Taşeron firma iletişimi — bu sefere atanmış araç ve şoförlerin firmaları.
  const firmaIdler = [...new Set([...aracAtamalari.map(a => a.arac.firmaId), ...soforFirmaIdler])]
  const firmalar =
    firmaIdler.length === 0
      ? []
      : await prisma.servisFirma.findMany({
          where: { id: { in: firmaIdler } },
          select: { id: true, ad: true, yetkiliAdi: true, telefon: true, eposta: true },
          orderBy: { ad: 'asc' },
        })

  const yolcular = yolcuSonucu.satirlar.map((y: OperasyonelServisListesiSatiri) => ({
    personnelId: y.personnelId,
    sicilNo: y.sicilNo,
    adSoyad: y.adSoyad,
    durakKod: y.durakKod,
    durakAd: y.durakAd,
    telefon: y.telefon,
  }))

  return {
    tarih: bugun.toISOString().slice(0, 10),
    guzergah: {
      id: guzergah.id,
      kod: guzergah.kod,
      ad: guzergah.ad,
      yerleskeKod: guzergah.yerleske.kod,
      yerleskeAd: guzergah.yerleske.ad,
    },
    dilim: { id: dilim.id, kod: dilim.kod, ad: dilim.ad, yon: dilim.yon },
    seferTanimli,
    duraklar: blok(duraklar, seferTanimli),
    arac: { ana: blok(aracAna, seferTanimli), yedek: blok(aracYedek, seferTanimli) },
    sofor: { ana: blok(soforAna, seferTanimli), yedek: blok(soforYedek, seferTanimli) },
    sorumlu: { ana: blok(sorumluAna, seferTanimli), yedek: blok(sorumluYedek, seferTanimli) },
    firmalar: blok(
      firmalar.map(f => ({
        firmaId: f.id,
        ad: f.ad,
        yetkiliAdi: f.yetkiliAdi,
        telefon: f.telefon,
        eposta: f.eposta,
      })),
      seferTanimli,
    ),
    yolcular: blok(yolcular, seferTanimli),
  }
}
