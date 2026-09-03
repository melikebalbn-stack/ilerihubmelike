// FAZ 1B-EK — Madde 31 "Bu Ay Ne Değişti?" ekranı, Adım 1 (servis/query
// katmanı). Şema/migration YOK — tamamen mevcut ServisIslemGecmisi audit
// tablosundan ve ilgili tabloların CANLI (şu anki) durumundan besleniyor.
//
// Tasarım notu — "önceki atama" nasıl bulunuyor: ServisPersonelAtama'nın
// personnelId/guzergahId/durakId/dilim seçimi OLUŞTURULDUKTAN SONRA
// DEĞİŞMEZ (guncelle/pasiflestir/geriAl yalnız bitisTarihi/aktif'i
// değiştirir — bkz. service.ts). Bu yüzden bir audit kaydının hedefId'si
// (atama id) üzerinden CANLI servisPersonelAtama tablosuna JOIN yapmak,
// audit ANINDAKİ o alanları da doğru verir — audit payload'una
// personnelId/guzergahId gibi FK'ları AYRICA yazmaya gerek kalmaz (zaten
// KVKK madde 23 gereği yalnız fiilen değişen alanlar audit'e yazılıyor).
// Aynı mantık ServisGuzergahAracVarsayilan/ServisGuzergahSoforVarsayilan
// için de geçerli.
//
// KVKK (madde 61 — Elif'in talimatı): Personnel'den YALNIZ sicilNo,
// adSoyad, bolum seçilir. Telefon/adres/e-posta YOK.
//
// BİLİNÇLİ OLARAK BU ADIMDA YOK:
//   - Madde 7 (Adres değişiklikleri): Personnel adres alanı bizim
//     audit'imizde YOK, KVKK nedeniyle zaten minimum veri çekiliyor.
//     Kod yazılmadı — bkz. BuAyNeDegistiSonucu.adresDegisiklikleri (sabit
//     null + açıklayıcı not). Elif ayrıca Melih'e/ürüne soracak.
//   - "Yeni kapasite riskleri" ve "boşalan kapasite": kapasite motorunun
//     (servisKapasiteOzetiGetir) canlı hesaplamasına ihtiyaç duyuyor, o
//     fonksiyon henüz main'de değil. TODO: kapasite motoru main'e girince
//     BuAyNeDegistiSonucu'na eklenecek (bkz. altındaki iki alan).

import { prisma } from '@/lib/prisma'

// ── Ay aralığı (saf, DB'siz) ─────────────────────────────────────────────
export function ayAraligiHesapla(yil?: number, ay?: number): { baslangic: Date; bitis: Date } {
  const simdi = new Date()
  const y = yil ?? simdi.getUTCFullYear()
  const a = ay ?? simdi.getUTCMonth() + 1 // 1-12
  const baslangic = new Date(Date.UTC(y, a - 1, 1, 0, 0, 0, 0))
  const bitis = new Date(Date.UTC(y, a, 0, 23, 59, 59, 999)) // ayın son günü, son ms
  return { baslangic, bitis }
}

// ── Personel ataması değişiklik sınıflandırması (saf, DB'siz) ───────────
// Madde 1/3/4/8'in ortak karar ağacı: personelin bu ayki YENİ atamasını,
// bundan hemen önceki atamasıyla (varsa) karşılaştırır.
export type PersonelAtamaOzet = { guzergahId: string; durakId: string | null; dilimIdleri: string[] }

export type PersonelAtamaDegisiklikTuru = 'YENI' | 'SERVIS_DEGISTI' | 'DURAK_DEGISTI' | 'VARDIYA_DEGISTI' | 'DIGER'

function diziEsitMi(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const bSet = new Set(b)
  return a.every((x) => bSet.has(x))
}

export function personelAtamaDegisikligiSiniflandir(
  sonraki: PersonelAtamaOzet,
  onceki: PersonelAtamaOzet | null,
): PersonelAtamaDegisiklikTuru {
  if (!onceki) return 'YENI'
  if (onceki.guzergahId !== sonraki.guzergahId) return 'SERVIS_DEGISTI'
  if (onceki.durakId !== sonraki.durakId) return 'DURAK_DEGISTI'
  if (!diziEsitMi(onceki.dilimIdleri, sonraki.dilimIdleri)) return 'VARDIYA_DEGISTI'
  return 'DIGER'
}

// ── Araç/şoför "kaynak" değişikliği (saf, DB'siz) — madde 5/6 ───────────
// Aynı güzergah+dilim+rol'de bir önceki kayıttan farklı bir araç/şoför
// atanmışsa true. Önceki kayıt yoksa (ilk atama) false — bu bir "değişim"
// değil.
export function kaynakDegistiMi(oncekiId: string | null, sonrakiId: string): boolean {
  return oncekiId !== null && oncekiId !== sonrakiId
}

// ── Ortak personel özeti (KVKK — yalnız bu 3 alan) ──────────────────────
export type PersonelOzeti = { personnelId: string; adSoyad: string; sicilNo: string | null; bolum: string }

export type YeniServisKullanicisi = PersonelOzeti & { guzergahKod: string; guzergahAd: string; tarih: Date }
export type ServistenAyrilan = PersonelOzeti & { guzergahKod: string; guzergahAd: string; tarih: Date }
export type ServisDegistiren = PersonelOzeti & {
  eskiGuzergahKod: string
  eskiGuzergahAd: string
  yeniGuzergahKod: string
  yeniGuzergahAd: string
  tarih: Date
}
export type DurakDegistiren = PersonelOzeti & {
  guzergahKod: string
  guzergahAd: string
  eskiDurakKod: string | null
  eskiDurakAd: string | null
  yeniDurakKod: string | null
  yeniDurakAd: string | null
  tarih: Date
}
export type VardiyaDegistiren = PersonelOzeti & { guzergahKod: string; guzergahAd: string; tarih: Date }

export type AracDegisenServis = {
  guzergahKod: string
  guzergahAd: string
  dilimKod: string
  eskiPlaka: string | null
  yeniPlaka: string
  tarih: Date
}
export type SoforDegisenServis = {
  guzergahKod: string
  guzergahAd: string
  dilimKod: string
  eskiAdSoyad: string | null
  yeniAdSoyad: string
  tarih: Date
}

export type BuAyNeDegistiSonucu = {
  yil: number
  ay: number
  // Madde 1
  yeniServisKullanicilari: YeniServisKullanicisi[]
  // Madde 2
  servistenAyrilanlar: ServistenAyrilan[]
  // Madde 3
  servisDegistirenler: ServisDegistiren[]
  // Madde 4
  durakDegistirenler: DurakDegistiren[]
  // Madde 5
  aracDegisenServisler: AracDegisenServis[]
  // Madde 6
  soforDegisenServisler: SoforDegisenServis[]
  // Madde 7 — BİLEREK boş, bkz. dosya üstü not.
  adresDegisiklikleri: { kapsamDisi: true; not: string }
  // Madde 8
  vardiyaDegistirenler: VardiyaDegistiren[]
  // TODO(kapasite-motoru): main'e girince eklenecek.
  yeniKapasiteRiskleri: null
  bosalanKapasite: null
}

function personelOzetOlustur(personnelId: string, personnel: { adSoyad: string; sicilNo: string | null; bolum: string }): PersonelOzeti {
  return { personnelId, adSoyad: personnel.adSoyad, sicilNo: personnel.sicilNo, bolum: personnel.bolum }
}

export async function buAyNeDegistiGetir(yil?: number, ay?: number): Promise<BuAyNeDegistiSonucu> {
  const { baslangic, bitis } = ayAraligiHesapla(yil, ay)
  const simdi = new Date()
  const cariYil = yil ?? simdi.getUTCFullYear()
  const cariAy = ay ?? simdi.getUTCMonth() + 1

  const sonuc: BuAyNeDegistiSonucu = {
    yil: cariYil,
    ay: cariAy,
    yeniServisKullanicilari: [],
    servistenAyrilanlar: [],
    servisDegistirenler: [],
    durakDegistirenler: [],
    aracDegisenServisler: [],
    soforDegisenServisler: [],
    adresDegisiklikleri: {
      kapsamDisi: true,
      not: 'Personnel adres değişikliği bizim sistemimizin tetikleyebileceği bir olay değil — audit tablomuzda bu veri yok, KVKK nedeniyle zaten minimum veri çekiliyor. Kapsam Elif tarafından ayrıca değerlendirilecek.',
    },
    vardiyaDegistirenler: [],
    yeniKapasiteRiskleri: null,
    bosalanKapasite: null,
  }

  await Promise.all([
    personelAtamaDegisikliklerini(baslangic, bitis, sonuc),
    aracDegisikliklerini(baslangic, bitis, sonuc),
    soforDegisikliklerini(baslangic, bitis, sonuc),
  ])

  return sonuc
}

// ── Madde 1/2/3/4/8: PERSONEL_ATAMA audit'i ─────────────────────────────
async function personelAtamaDegisikliklerini(
  baslangic: Date,
  bitis: Date,
  sonuc: BuAyNeDegistiSonucu,
): Promise<void> {
  const kayitlar = await prisma.servisIslemGecmisi.findMany({
    where: {
      hedefTipi: 'PERSONEL_ATAMA',
      islem: { in: ['OLUSTURMA', 'PASIFLESTIRME'] },
      tarih: { gte: baslangic, lte: bitis },
    },
    orderBy: { tarih: 'asc' },
  })
  if (kayitlar.length === 0) return

  const atamaIdleri = [...new Set(kayitlar.map((k) => k.hedefId))]
  const atamalar = await prisma.servisPersonelAtama.findMany({
    where: { id: { in: atamaIdleri } },
    include: {
      personnel: { select: { adSoyad: true, sicilNo: true, bolum: true } },
      guzergah: { select: { kod: true, ad: true } },
      durak: { select: { kod: true, ad: true } },
      dilimler: { select: { dilimId: true } },
    },
  })
  const atamaMap = new Map(atamalar.map((a) => [a.id, a]))

  for (const kayit of kayitlar) {
    const atama = atamaMap.get(kayit.hedefId)
    if (!atama) continue // atama sonradan silinemez ama savunmacı kontrol

    if (kayit.islem === 'OLUSTURMA') {
      const onceki = await prisma.servisPersonelAtama.findFirst({
        where: { personnelId: atama.personnelId, baslangicTarihi: { lt: atama.baslangicTarihi } },
        orderBy: { baslangicTarihi: 'desc' },
        include: { guzergah: { select: { kod: true, ad: true } }, durak: { select: { kod: true, ad: true } }, dilimler: { select: { dilimId: true } } },
      })

      const tur = personelAtamaDegisikligiSiniflandir(
        { guzergahId: atama.guzergahId, durakId: atama.durakId, dilimIdleri: atama.dilimler.map((d) => d.dilimId) },
        onceki
          ? { guzergahId: onceki.guzergahId, durakId: onceki.durakId, dilimIdleri: onceki.dilimler.map((d) => d.dilimId) }
          : null,
      )

      const ozet = personelOzetOlustur(atama.personnelId, atama.personnel)

      if (tur === 'YENI') {
        sonuc.yeniServisKullanicilari.push({ ...ozet, guzergahKod: atama.guzergah.kod, guzergahAd: atama.guzergah.ad, tarih: kayit.tarih })
      } else if (tur === 'SERVIS_DEGISTI' && onceki) {
        sonuc.servisDegistirenler.push({
          ...ozet,
          eskiGuzergahKod: onceki.guzergah.kod,
          eskiGuzergahAd: onceki.guzergah.ad,
          yeniGuzergahKod: atama.guzergah.kod,
          yeniGuzergahAd: atama.guzergah.ad,
          tarih: kayit.tarih,
        })
      } else if (tur === 'DURAK_DEGISTI' && onceki) {
        sonuc.durakDegistirenler.push({
          ...ozet,
          guzergahKod: atama.guzergah.kod,
          guzergahAd: atama.guzergah.ad,
          eskiDurakKod: onceki.durak?.kod ?? null,
          eskiDurakAd: onceki.durak?.ad ?? null,
          yeniDurakKod: atama.durak?.kod ?? null,
          yeniDurakAd: atama.durak?.ad ?? null,
          tarih: kayit.tarih,
        })
      } else if (tur === 'VARDIYA_DEGISTI') {
        sonuc.vardiyaDegistirenler.push({ ...ozet, guzergahKod: atama.guzergah.kod, guzergahAd: atama.guzergah.ad, tarih: kayit.tarih })
      }
      // 'DIGER': hiçbir alan değişmemiş yeni bir atama — bu rapor
      // kapsamında sınıflandırılamıyor, listelenmiyor.
      continue
    }

    // PASIFLESTIRME: personelin RAPOR AYININ SONU İTİBARIYLA (bitis
    // parametresi — "şu an"/sorgu anı DEĞİL) geçerli başka bir ataması
    // yoksa "ayrıldı" sayılır. Varsa (transfer/servis değişikliği) zaten
    // OLUSTURMA tarafında madde 3/4/8'de yakalanmıştır — burada tekrar
    // "ayrılma" olarak SAYILMAZ.
    //
    // DÜZELTME (Elif'in sorusu üzerine): önceki sürüm burada `aktif:true`
    // ile CANLI/sorgu-anı durumuna bakıyordu. Bu, GEÇMİŞ bir ay
    // sorgulandığında yanlış sonuç verebiliyordu — örn. Temmuz'da ayrılan
    // ama Kasım'da (rapor bugün çalıştırıldığında) tekrar servise
    // başlayan biri, "Temmuz'da ne değişti" raporunda YANLIŞLIKLA
    // "ayrılmadı" görünürdü. Şimdi `baslangicTarihi <= ayBitisi` VE
    // (bitisTarihi null VEYA bitisTarihi >= ayBitisi) — yani "o ayın
    // sonunda GEÇERLİ miydi" sorusu tarihsel olarak sorulur. Cari ay için
    // davranış DEĞİŞMEDİ (ayBitisi ileri bir tarih olduğunda bu sorgu
    // pratikte aktif:true ile aynı sonucu verir).
    const ayBitisindeGecerliAtama = await prisma.servisPersonelAtama.findFirst({
      where: {
        personnelId: atama.personnelId,
        baslangicTarihi: { lte: bitis },
        OR: [{ bitisTarihi: null }, { bitisTarihi: { gte: bitis } }],
      },
    })
    if (!ayBitisindeGecerliAtama) {
      sonuc.servistenAyrilanlar.push({
        ...personelOzetOlustur(atama.personnelId, atama.personnel),
        guzergahKod: atama.guzergah.kod,
        guzergahAd: atama.guzergah.ad,
        tarih: kayit.tarih,
      })
    }
  }
}

// ── Madde 5: GUZERGAH_ARAC_VARSAYILAN audit'i ───────────────────────────
async function aracDegisikliklerini(baslangic: Date, bitis: Date, sonuc: BuAyNeDegistiSonucu): Promise<void> {
  const kayitlar = await prisma.servisIslemGecmisi.findMany({
    where: { hedefTipi: 'GUZERGAH_ARAC_VARSAYILAN', islem: 'OLUSTURMA', tarih: { gte: baslangic, lte: bitis } },
    orderBy: { tarih: 'asc' },
  })
  if (kayitlar.length === 0) return

  const idler = [...new Set(kayitlar.map((k) => k.hedefId))]
  const atamalar = await prisma.servisGuzergahAracVarsayilan.findMany({
    where: { id: { in: idler } },
    include: { guzergah: { select: { kod: true, ad: true } }, dilim: { select: { kod: true } }, arac: { select: { plaka: true } } },
  })
  const atamaMap = new Map(atamalar.map((a) => [a.id, a]))

  for (const kayit of kayitlar) {
    const atama = atamaMap.get(kayit.hedefId)
    if (!atama) continue

    const onceki = await prisma.servisGuzergahAracVarsayilan.findFirst({
      where: {
        guzergahId: atama.guzergahId,
        dilimId: atama.dilimId,
        rol: atama.rol,
        baslangicTarihi: { lt: atama.baslangicTarihi },
      },
      orderBy: { baslangicTarihi: 'desc' },
      include: { arac: { select: { plaka: true } } },
    })

    if (kaynakDegistiMi(onceki?.aracId ?? null, atama.aracId)) {
      sonuc.aracDegisenServisler.push({
        guzergahKod: atama.guzergah.kod,
        guzergahAd: atama.guzergah.ad,
        dilimKod: atama.dilim.kod,
        eskiPlaka: onceki?.arac.plaka ?? null,
        yeniPlaka: atama.arac.plaka,
        tarih: kayit.tarih,
      })
    }
  }
}

// ── Madde 6: GUZERGAH_SOFOR_VARSAYILAN audit'i ──────────────────────────
async function soforDegisikliklerini(baslangic: Date, bitis: Date, sonuc: BuAyNeDegistiSonucu): Promise<void> {
  const kayitlar = await prisma.servisIslemGecmisi.findMany({
    where: { hedefTipi: 'GUZERGAH_SOFOR_VARSAYILAN', islem: 'OLUSTURMA', tarih: { gte: baslangic, lte: bitis } },
    orderBy: { tarih: 'asc' },
  })
  if (kayitlar.length === 0) return

  const idler = [...new Set(kayitlar.map((k) => k.hedefId))]
  const atamalar = await prisma.servisGuzergahSoforVarsayilan.findMany({
    where: { id: { in: idler } },
    include: { guzergah: { select: { kod: true, ad: true } }, dilim: { select: { kod: true } }, sofor: { select: { adSoyad: true } } },
  })
  const atamaMap = new Map(atamalar.map((a) => [a.id, a]))

  for (const kayit of kayitlar) {
    const atama = atamaMap.get(kayit.hedefId)
    if (!atama) continue

    const onceki = await prisma.servisGuzergahSoforVarsayilan.findFirst({
      where: {
        guzergahId: atama.guzergahId,
        dilimId: atama.dilimId,
        rol: atama.rol,
        baslangicTarihi: { lt: atama.baslangicTarihi },
      },
      orderBy: { baslangicTarihi: 'desc' },
      include: { sofor: { select: { adSoyad: true } } },
    })

    if (kaynakDegistiMi(onceki?.soforId ?? null, atama.soforId)) {
      sonuc.soforDegisenServisler.push({
        guzergahKod: atama.guzergah.kod,
        guzergahAd: atama.guzergah.ad,
        dilimKod: atama.dilim.kod,
        eskiAdSoyad: onceki?.sofor.adSoyad ?? null,
        yeniAdSoyad: atama.sofor.adSoyad,
        tarih: kayit.tarih,
      })
    }
  }
}
