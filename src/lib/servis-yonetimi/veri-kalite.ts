// ============================================================================
// MASTER Madde 43 — Veri Kalite Merkezi
// ============================================================================
//
// Salt okunur tespit ekranının servis/query katmanı. Madde 21 gereği HİÇBİR
// kayıt burada otomatik düzeltilmez — her kontrol yalnız anomali listesi
// döner, ekran tarafı bu listeleri ilgili kaydın mevcut yönetim ekranına
// link/yönlendirme olarak sunar.
//
// 14 madde → 13 kontrol (14, 14a+14b olarak ikiye bölündü; 8 ve 10
// kurulamıyor, veri kaynağı yok — bkz. keşif raporu B.8/B.10; 12 kapasite
// motoru main'e girene kadar yer tutucu — bkz. F).
//
// Tarih aralığı kesişim kontrollerinde (9, 13) POZİTİF AND-of-OR formu
// kullanılır: (bitis IS NULL OR bitis >= digerBaslangic) AND
// (digerBitis IS NULL OR digerBitis >= baslangic). NOT/NEGATİF form
// kullanılmaz — NULL semantiği satırı sessizce atlayabilir.
//
// KVKK: Personnel'den yalnız id/sicilNo/adSoyad/bolum seçilir. Telefon,
// adres, e-posta bu ekranda YOK.

import { prisma } from '@/lib/prisma'

export interface VeriKaliteBulgu {
  kod: string
  baslik: string
  adet: number
  kayitlar: Record<string, unknown>[]
}

export type VeriKaliteRaporSatiri = VeriKaliteBulgu & { hata?: string }

function araliklarKesisiyorMu(
  aBaslangic: Date,
  aBitis: Date | null,
  bBaslangic: Date,
  bBitis: Date | null,
): boolean {
  return (aBitis === null || aBitis >= bBaslangic) && (bBitis === null || bBitis >= aBaslangic)
}

// ----------------------------------------------------------------------------
// 1. Aktif personel / servis yok
// ----------------------------------------------------------------------------
// KENDI_GELIYOR / KULLANMIYOR / SIRKET_ARACI durumundaki personel bilinçli
// olarak servis kullanmıyor — anomali SAYILMAZ (bkz. keşif raporu madde C).
export async function aktifPersonelServisYok(): Promise<VeriKaliteBulgu> {
  const kod = 'aktif-personel-servis-yok'
  const baslik = 'Aktif personel / servis yok'
  const kayitlar = await prisma.personnel.findMany({
    where: {
      aktif: true,
      servisAtamalari: { none: { aktif: true } },
      servisDurumlari: { none: { aktif: true, durum: { not: 'SERVIS_KULLANIYOR' } } },
    },
    select: { id: true, sicilNo: true, adSoyad: true, bolum: true },
    orderBy: { adSoyad: 'asc' },
  })
  return { kod, baslik, adet: kayitlar.length, kayitlar }
}

// ----------------------------------------------------------------------------
// 2. Pasif personel / servis aktif
// ----------------------------------------------------------------------------
export async function pasifPersonelServisAktif(): Promise<VeriKaliteBulgu> {
  const kod = 'pasif-personel-servis-aktif'
  const baslik = 'Pasif personel / servis aktif'
  const kayitlar = await prisma.personnel.findMany({
    where: { aktif: false, servisAtamalari: { some: { aktif: true } } },
    select: { id: true, sicilNo: true, adSoyad: true, bolum: true },
    orderBy: { adSoyad: 'asc' },
  })
  return { kod, baslik, adet: kayitlar.length, kayitlar }
}

// ----------------------------------------------------------------------------
// 3. Mükerrer aktif servis — TARİHTEN BAĞIMSIZ (aynı personelin 2+ aktif=true
// satırı olması, tarih aralıkları kesişsin ya da kesişmesin). 9'dan farkı:
// burada tarih boyutuna hiç bakılmaz, yalnız "aynı anda 2+ aktif" sayılır.
// ----------------------------------------------------------------------------
export async function mukerrerAktifServis(): Promise<VeriKaliteBulgu> {
  const kod = 'mukerrer-aktif-servis'
  const baslik = 'Mükerrer aktif servis (tarihten bağımsız — aynı personelin 2+ aktif atama satırı)'

  const gruplar = await prisma.servisPersonelAtama.groupBy({
    by: ['personnelId'],
    where: { aktif: true },
    _count: { _all: true },
    having: { personnelId: { _count: { gt: 1 } } },
  })
  if (gruplar.length === 0) return { kod, baslik, adet: 0, kayitlar: [] }

  const personnelIds = gruplar.map(g => g.personnelId)
  const [atamalar, personeller] = await Promise.all([
    prisma.servisPersonelAtama.findMany({
      where: { personnelId: { in: personnelIds }, aktif: true },
      select: {
        id: true,
        personnelId: true,
        baslangicTarihi: true,
        bitisTarihi: true,
        guzergah: { select: { kod: true, ad: true } },
      },
      orderBy: { baslangicTarihi: 'asc' },
    }),
    prisma.personnel.findMany({
      where: { id: { in: personnelIds } },
      select: { id: true, sicilNo: true, adSoyad: true, bolum: true },
    }),
  ])

  const personelById = new Map(personeller.map(p => [p.id, p]))
  const atamalarByPersonel = new Map<string, typeof atamalar>()
  for (const a of atamalar) {
    const liste = atamalarByPersonel.get(a.personnelId) ?? []
    liste.push(a)
    atamalarByPersonel.set(a.personnelId, liste)
  }

  const kayitlar = personnelIds.map(id => {
    const p = personelById.get(id)
    const liste = atamalarByPersonel.get(id) ?? []
    return {
      personnelId: id,
      sicilNo: p?.sicilNo ?? null,
      adSoyad: p?.adSoyad ?? null,
      bolum: p?.bolum ?? null,
      aktifAtamaSayisi: liste.length,
      atamalar: liste.map(a => ({
        id: a.id,
        guzergahKod: a.guzergah.kod,
        guzergahAd: a.guzergah.ad,
        baslangicTarihi: a.baslangicTarihi,
        bitisTarihi: a.bitisTarihi,
      })),
    }
  })

  return { kod, baslik, adet: kayitlar.length, kayitlar }
}

// ----------------------------------------------------------------------------
// 4 / 5. Servis var / araç-şoför yok
// ----------------------------------------------------------------------------
// Taban küme: aktif güzergah × aktif dilim TAM ÇAPRAZ ÇARPIMI DEĞİL — her
// güzergah her dilime hizmet vermek zorunda değil (örn. yalnız sabah çalışan
// güzergah için "akşam diliminde araç yok" yanlış pozitif olur). Bir
// güzergahın hangi dilim(ler)e hizmet verdiği şemada TEK yapısal kaynaktan
// çıkarılabiliyor: ServisGuzergahDurakSaat (guzergahDurakId → guzergahId,
// dilimId) — o güzergahın duraklarından en az birinde o dilim için aktif
// saat tanımlıysa güzergah o dilime hizmet veriyordur. ServisGuzergah'ta
// veya ServisSeferDilimi'nde başka/doğrudan bir ilişki YOK (Ders 58 — şemadan
// doğrulandı). Karşılık gelen aktif ANA varsayılan yoksa anomali.
// etkilenenPersonelSayisi 0 olabilir — ekranda önem sırası için kullanılır,
// filtre için kullanılmaz.

async function guzergahDilimHizmetVerisiGetir(): Promise<{
  guzergahIdsWithAnySaat: Set<string>
  hizmetVerilenCiftler: { guzergahId: string; dilimId: string }[]
}> {
  const saatKayitlari = await prisma.servisGuzergahDurakSaat.findMany({
    where: { aktif: true, guzergahDurak: { aktif: true, guzergah: { aktif: true } } },
    select: {
      dilimId: true,
      dilim: { select: { aktif: true } },
      guzergahDurak: { select: { guzergahId: true } },
    },
  })

  const guzergahIdsWithAnySaat = new Set(saatKayitlari.map(s => s.guzergahDurak.guzergahId))

  const ciftSet = new Set<string>()
  const hizmetVerilenCiftler: { guzergahId: string; dilimId: string }[] = []
  for (const s of saatKayitlari) {
    if (!s.dilim.aktif) continue
    const guzergahId = s.guzergahDurak.guzergahId
    const anahtar = `${guzergahId}::${s.dilimId}`
    if (ciftSet.has(anahtar)) continue
    ciftSet.add(anahtar)
    hizmetVerilenCiftler.push({ guzergahId, dilimId: s.dilimId })
  }

  return { guzergahIdsWithAnySaat, hizmetVerilenCiftler }
}

async function eksikVarsayilanCiftleriBul(
  varsayilanlarGetir: () => Promise<{ guzergahId: string; dilimId: string }[]>,
) {
  const [guzergahlar, dilimler, varsayilanlar, { hizmetVerilenCiftler }] = await Promise.all([
    prisma.servisGuzergah.findMany({ where: { aktif: true }, select: { id: true, kod: true, ad: true } }),
    prisma.servisSeferDilimi.findMany({ where: { aktif: true }, select: { id: true, kod: true, ad: true } }),
    varsayilanlarGetir(),
    guzergahDilimHizmetVerisiGetir(),
  ])

  const varOlanCiftler = new Set(varsayilanlar.map(v => `${v.guzergahId}::${v.dilimId}`))
  const eksikCiftler = hizmetVerilenCiftler.filter(c => !varOlanCiftler.has(`${c.guzergahId}::${c.dilimId}`))

  return {
    eksikCiftler,
    guzergahById: new Map(guzergahlar.map(g => [g.id, g])),
    dilimById: new Map(dilimler.map(d => [d.id, d])),
  }
}

// Ayrı ve gerçek bir anomali: aktif güzergahın hiçbir durağında hiçbir dilim
// için saat tanımlanmamışsa (ServisGuzergahDurakSaat hiç yok) — araç/şoför
// eksikliğiyle karıştırılmaz, güzergahın kendisi hiç sefer tanımı almamıştır.
export async function guzergahSeferDilimiTanimsiz(): Promise<VeriKaliteBulgu> {
  const kod = 'guzergah-sefer-dilimi-tanimsiz'
  const baslik = 'Güzergah var ama hiç sefer dilimi tanımlı değil (ServisGuzergahDurakSaat kaydı yok)'

  const [guzergahlar, { guzergahIdsWithAnySaat }] = await Promise.all([
    prisma.servisGuzergah.findMany({ where: { aktif: true }, select: { id: true, kod: true, ad: true } }),
    guzergahDilimHizmetVerisiGetir(),
  ])

  const kayitlar = guzergahlar
    .filter(g => !guzergahIdsWithAnySaat.has(g.id))
    .map(g => ({ guzergahId: g.id, guzergahKod: g.kod, guzergahAd: g.ad }))

  return { kod, baslik, adet: kayitlar.length, kayitlar }
}

async function etkilenenPersonelSayisiHesapla(
  eksikCiftler: { guzergahId: string; dilimId: string }[],
): Promise<Map<string, Set<string>>> {
  const sonuc = new Map<string, Set<string>>()
  if (eksikCiftler.length === 0) return sonuc

  const atamaDilimler = await prisma.servisPersonelAtamaDilim.findMany({
    where: {
      dilimId: { in: [...new Set(eksikCiftler.map(c => c.dilimId))] },
      atama: { aktif: true, guzergahId: { in: [...new Set(eksikCiftler.map(c => c.guzergahId))] } },
    },
    select: { dilimId: true, atama: { select: { guzergahId: true, personnelId: true } } },
  })

  for (const ad of atamaDilimler) {
    const anahtar = `${ad.atama.guzergahId}::${ad.dilimId}`
    const set = sonuc.get(anahtar) ?? new Set<string>()
    set.add(ad.atama.personnelId)
    sonuc.set(anahtar, set)
  }
  return sonuc
}

function eksikVarsayilanKayitlariOlustur(
  eksikCiftler: { guzergahId: string; dilimId: string }[],
  guzergahById: Map<string, { kod: string; ad: string }>,
  dilimById: Map<string, { kod: string; ad: string }>,
  personelSayisiByCift: Map<string, Set<string>>,
) {
  return eksikCiftler
    .map(({ guzergahId, dilimId }) => {
      const g = guzergahById.get(guzergahId)!
      const d = dilimById.get(dilimId)!
      return {
        guzergahId,
        guzergahKod: g.kod,
        guzergahAd: g.ad,
        dilimId,
        dilimKod: d.kod,
        dilimAd: d.ad,
        etkilenenPersonelSayisi: personelSayisiByCift.get(`${guzergahId}::${dilimId}`)?.size ?? 0,
      }
    })
    .sort((a, b) => b.etkilenenPersonelSayisi - a.etkilenenPersonelSayisi)
}

export async function servisVarAracYok(): Promise<VeriKaliteBulgu> {
  const kod = 'servis-var-arac-yok'
  const baslik = 'Servis var / araç yok'

  const { eksikCiftler, guzergahById, dilimById } = await eksikVarsayilanCiftleriBul(() =>
    prisma.servisGuzergahAracVarsayilan.findMany({
      where: { rol: 'ANA', aktif: true },
      select: { guzergahId: true, dilimId: true },
    }),
  )
  const personelSayisiByCift = await etkilenenPersonelSayisiHesapla(eksikCiftler)
  const kayitlar = eksikVarsayilanKayitlariOlustur(eksikCiftler, guzergahById, dilimById, personelSayisiByCift)

  return { kod, baslik, adet: kayitlar.length, kayitlar }
}

export async function servisVarSoforYok(): Promise<VeriKaliteBulgu> {
  const kod = 'servis-var-sofor-yok'
  const baslik = 'Servis var / sürücü yok'

  const { eksikCiftler, guzergahById, dilimById } = await eksikVarsayilanCiftleriBul(() =>
    prisma.servisGuzergahSoforVarsayilan.findMany({
      where: { rol: 'ANA', aktif: true },
      select: { guzergahId: true, dilimId: true },
    }),
  )
  const personelSayisiByCift = await etkilenenPersonelSayisiHesapla(eksikCiftler)
  const kayitlar = eksikVarsayilanKayitlariOlustur(eksikCiftler, guzergahById, dilimById, personelSayisiByCift)

  return { kod, baslik, adet: kayitlar.length, kayitlar }
}

// ----------------------------------------------------------------------------
// 6. Kapasitesi eksik araç
// ----------------------------------------------------------------------------
export async function kapasitesiEksikArac(): Promise<VeriKaliteBulgu> {
  const kod = 'kapasitesi-eksik-arac'
  const baslik = 'Kapasitesi eksik araç'
  const araclar = await prisma.servisArac.findMany({
    where: { aktif: true, kapasite: { lte: 0 } },
    select: { id: true, plaka: true, kapasite: true, firma: { select: { ad: true } } },
    orderBy: { plaka: 'asc' },
  })
  const kayitlar = araclar.map(a => ({ id: a.id, plaka: a.plaka, kapasite: a.kapasite, firmaAd: a.firma.ad }))
  return { kod, baslik, adet: kayitlar.length, kayitlar }
}

// ----------------------------------------------------------------------------
// 7. Koordinatsız durak
// ----------------------------------------------------------------------------
// Kapsam DARALTILMAZ — aktif filtresi YOK, MASTER'ın istediği toplam sayı
// (2026-09-21 doğrulama: dev DB'de 107 durağın 106'sı eksik, GEBZE_DEVELI
// örneğiyle teyitli) korunur. Eylem alınabilirlik için her satıra durağın
// kendi aktif/pasif durumu VE aktif bir güzergaha bağlı olup olmadığı
// (aktif ServisGuzergahDurak satırı + o satırın güzergahı da aktif) eklenir
// — haritayı fiilen bozan (aktif + güzergaha bağlı) duraklar ekranda önem
// sırası için ayırt edilebilir.
export async function koordinatsizDurak(): Promise<VeriKaliteBulgu> {
  const kod = 'koordinatsiz-durak'
  const baslik = 'Koordinatsız durak'
  const duraklar = await prisma.servisDurak.findMany({
    where: { OR: [{ enlem: null }, { boylam: null }] },
    select: {
      id: true,
      kod: true,
      ad: true,
      il: true,
      ilce: true,
      aktif: true,
      guzergahlar: { where: { aktif: true, guzergah: { aktif: true } }, select: { id: true }, take: 1 },
    },
    orderBy: { kod: 'asc' },
  })
  const kayitlar = duraklar.map(d => ({
    id: d.id,
    kod: d.kod,
    ad: d.ad,
    il: d.il,
    ilce: d.ilce,
    aktif: d.aktif,
    aktifGuzergahaBagli: d.guzergahlar.length > 0,
  }))
  return { kod, baslik, adet: kayitlar.length, kayitlar }
}

// ----------------------------------------------------------------------------
// 9. Çakışan atamalar — aynı personelin TARİH ARALIĞI KESİŞEN 2+ aktif
// ataması. 3'ten farkı: burada yalnız gerçekten kesişen çiftler sayılır.
// ----------------------------------------------------------------------------
export async function cakisanAtamalar(): Promise<VeriKaliteBulgu> {
  const kod = 'cakisan-atamalar'
  const baslik = "Çakışan atamalar (aynı personelin tarih aralığı kesişen 2+ aktif ataması — madde 3'ten farkı tarih boyutu)"

  const atamalar = await prisma.servisPersonelAtama.findMany({
    where: { aktif: true },
    select: {
      id: true,
      personnelId: true,
      baslangicTarihi: true,
      bitisTarihi: true,
      guzergah: { select: { kod: true } },
    },
  })

  const byPersonel = new Map<string, typeof atamalar>()
  for (const a of atamalar) {
    const liste = byPersonel.get(a.personnelId) ?? []
    liste.push(a)
    byPersonel.set(a.personnelId, liste)
  }

  type Cift = { atama1: (typeof atamalar)[number]; atama2: (typeof atamalar)[number] }
  const ciftlerByPersonel = new Map<string, Cift[]>()
  for (const [personnelId, liste] of byPersonel) {
    if (liste.length < 2) continue
    const ciftler: Cift[] = []
    for (let i = 0; i < liste.length; i++) {
      for (let j = i + 1; j < liste.length; j++) {
        if (
          araliklarKesisiyorMu(liste[i].baslangicTarihi, liste[i].bitisTarihi, liste[j].baslangicTarihi, liste[j].bitisTarihi)
        ) {
          ciftler.push({ atama1: liste[i], atama2: liste[j] })
        }
      }
    }
    if (ciftler.length > 0) ciftlerByPersonel.set(personnelId, ciftler)
  }

  if (ciftlerByPersonel.size === 0) return { kod, baslik, adet: 0, kayitlar: [] }

  const personnelIds = [...ciftlerByPersonel.keys()]
  const personeller = await prisma.personnel.findMany({
    where: { id: { in: personnelIds } },
    select: { id: true, sicilNo: true, adSoyad: true, bolum: true },
  })
  const personelById = new Map(personeller.map(p => [p.id, p]))

  const kayitlar = personnelIds.map(id => {
    const p = personelById.get(id)
    const ciftler = ciftlerByPersonel.get(id) ?? []
    return {
      personnelId: id,
      sicilNo: p?.sicilNo ?? null,
      adSoyad: p?.adSoyad ?? null,
      bolum: p?.bolum ?? null,
      cakisanCiftSayisi: ciftler.length,
      ciftler: ciftler.map(c => ({
        atama1: { id: c.atama1.id, guzergahKod: c.atama1.guzergah.kod, baslangicTarihi: c.atama1.baslangicTarihi, bitisTarihi: c.atama1.bitisTarihi },
        atama2: { id: c.atama2.id, guzergahKod: c.atama2.guzergah.kod, baslangicTarihi: c.atama2.baslangicTarihi, bitisTarihi: c.atama2.bitisTarihi },
      })),
    }
  })

  return { kod, baslik, adet: kayitlar.length, kayitlar }
}

// ----------------------------------------------------------------------------
// 11. Süresi bitmiş geçici atama
// ----------------------------------------------------------------------------
export async function suresiBitmisGeciciAtama(): Promise<VeriKaliteBulgu> {
  const kod = 'suresi-bitmis-gecici-atama'
  const baslik = 'Süresi bitmiş geçici atama'
  const bugun = new Date()
  bugun.setUTCHours(0, 0, 0, 0)

  const atamalar = await prisma.servisPersonelAtama.findMany({
    where: { aktif: true, bitisTarihi: { lt: bugun } },
    select: {
      id: true,
      baslangicTarihi: true,
      bitisTarihi: true,
      personnel: { select: { id: true, sicilNo: true, adSoyad: true, bolum: true } },
      guzergah: { select: { kod: true, ad: true } },
    },
    orderBy: { bitisTarihi: 'asc' },
  })

  const kayitlar = atamalar.map(a => ({
    id: a.id,
    personnelId: a.personnel.id,
    sicilNo: a.personnel.sicilNo,
    adSoyad: a.personnel.adSoyad,
    bolum: a.personnel.bolum,
    guzergahKod: a.guzergah.kod,
    guzergahAd: a.guzergah.ad,
    baslangicTarihi: a.baslangicTarihi,
    bitisTarihi: a.bitisTarihi,
  }))

  return { kod, baslik, adet: kayitlar.length, kayitlar }
}

// ----------------------------------------------------------------------------
// 13. Tarih çakışması — aynı araç/şoförün aynı dilimde FARKLI güzergaha
// çakışan tarihli ANA ataması. 9'dan farkı: personel değil araç/şoför boyutu.
// ----------------------------------------------------------------------------
function cakisanCiftleriBul<
  T extends { dilimId: string; guzergahId: string; baslangicTarihi: Date; bitisTarihi: Date | null },
>(satirlar: T[], varlikIdAl: (satir: T) => string): { satir1: T; satir2: T }[] {
  const gruplar = new Map<string, T[]>()
  for (const satir of satirlar) {
    const anahtar = `${varlikIdAl(satir)}::${satir.dilimId}`
    const liste = gruplar.get(anahtar) ?? []
    liste.push(satir)
    gruplar.set(anahtar, liste)
  }

  const sonuc: { satir1: T; satir2: T }[] = []
  for (const liste of gruplar.values()) {
    if (liste.length < 2) continue
    for (let i = 0; i < liste.length; i++) {
      for (let j = i + 1; j < liste.length; j++) {
        const a = liste[i]
        const b = liste[j]
        if (a.guzergahId === b.guzergahId) continue
        if (araliklarKesisiyorMu(a.baslangicTarihi, a.bitisTarihi, b.baslangicTarihi, b.bitisTarihi)) {
          sonuc.push({ satir1: a, satir2: b })
        }
      }
    }
  }
  return sonuc
}

export async function tarihCakismasiAracSofor(): Promise<VeriKaliteBulgu> {
  const kod = 'tarih-cakismasi-arac-sofor'
  const baslik = "Tarih çakışması (araç/şoför — madde 9'dan farkı personel değil araç/şoför boyutu)"

  const [aracVarsayilanlar, soforVarsayilanlar] = await Promise.all([
    prisma.servisGuzergahAracVarsayilan.findMany({
      where: { rol: 'ANA', aktif: true },
      select: {
        id: true,
        aracId: true,
        dilimId: true,
        guzergahId: true,
        baslangicTarihi: true,
        bitisTarihi: true,
        arac: { select: { plaka: true } },
        guzergah: { select: { kod: true } },
        dilim: { select: { kod: true } },
      },
    }),
    prisma.servisGuzergahSoforVarsayilan.findMany({
      where: { rol: 'ANA', aktif: true },
      select: {
        id: true,
        soforId: true,
        dilimId: true,
        guzergahId: true,
        baslangicTarihi: true,
        bitisTarihi: true,
        sofor: { select: { adSoyad: true } },
        guzergah: { select: { kod: true } },
        dilim: { select: { kod: true } },
      },
    }),
  ])

  const aracCiftleri = cakisanCiftleriBul(aracVarsayilanlar, s => s.aracId)
  const soforCiftleri = cakisanCiftleriBul(soforVarsayilanlar, s => s.soforId)

  const kayitlar: Record<string, unknown>[] = [
    ...aracCiftleri.map(c => ({
      tur: 'ARAC',
      aracPlaka: c.satir1.arac.plaka,
      dilimKod: c.satir1.dilim.kod,
      atama1: { id: c.satir1.id, guzergahKod: c.satir1.guzergah.kod, baslangicTarihi: c.satir1.baslangicTarihi, bitisTarihi: c.satir1.bitisTarihi },
      atama2: { id: c.satir2.id, guzergahKod: c.satir2.guzergah.kod, baslangicTarihi: c.satir2.baslangicTarihi, bitisTarihi: c.satir2.bitisTarihi },
    })),
    ...soforCiftleri.map(c => ({
      tur: 'SOFOR',
      soforAdSoyad: c.satir1.sofor.adSoyad,
      dilimKod: c.satir1.dilim.kod,
      atama1: { id: c.satir1.id, guzergahKod: c.satir1.guzergah.kod, baslangicTarihi: c.satir1.baslangicTarihi, bitisTarihi: c.satir1.bitisTarihi },
      atama2: { id: c.satir2.id, guzergahKod: c.satir2.guzergah.kod, baslangicTarihi: c.satir2.baslangicTarihi, bitisTarihi: c.satir2.bitisTarihi },
    })),
  ]

  return { kod, baslik, adet: kayitlar.length, kayitlar }
}

// ----------------------------------------------------------------------------
// 14a. Eksik firma ilişkisi — aktif araç, pasif firmaya bağlı
// ----------------------------------------------------------------------------
export async function aktifAracPasifFirma(): Promise<VeriKaliteBulgu> {
  const kod = 'aktif-arac-pasif-firma'
  const baslik = 'Eksik firma ilişkisi (a): aktif araç, pasif firmaya bağlı'
  const araclar = await prisma.servisArac.findMany({
    where: { aktif: true, firma: { aktif: false } },
    select: { id: true, plaka: true, firma: { select: { id: true, ad: true } } },
    orderBy: { plaka: 'asc' },
  })
  const kayitlar = araclar.map(a => ({ id: a.id, plaka: a.plaka, firmaId: a.firma.id, firmaAd: a.firma.ad }))
  return { kod, baslik, adet: kayitlar.length, kayitlar }
}

// ----------------------------------------------------------------------------
// 14b. Eksik firma ilişkisi — dış firma şoförü (personnelId yok) iken
// firmaId de yok. Dahili şoförde (personnelId dolu) firmaId'nin NULL olması
// XOR tasarımı gereği NORMALDİR, anomali değildir — bu kontrol yalnız
// personnelId NULL olan satırları hedefler.
// ----------------------------------------------------------------------------
export async function disFirmaSoforuFirmasiz(): Promise<VeriKaliteBulgu> {
  const kod = 'dis-firma-soforu-firmasiz'
  const baslik = 'Eksik firma ilişkisi (b): dış firma şoförü, firma yok'
  const kayitlar = await prisma.servisSofor.findMany({
    where: { aktif: true, personnelId: null, firmaId: null },
    select: { id: true, adSoyad: true, disFirmaSoforKodu: true },
    orderBy: { adSoyad: 'asc' },
  })
  return { kod, baslik, adet: kayitlar.length, kayitlar }
}

// ----------------------------------------------------------------------------
// Orkestrasyon — Promise.allSettled (Promise.all DEĞİL): bir kontrol patlarsa
// diğer 11'i çalışmaya devam eder, patlayan kendi satırında hata bilgisiyle
// döner (rule 17, güvenli geri dönüş).
// ----------------------------------------------------------------------------
interface KontrolTanimi {
  kod: string
  baslik: string
  calistir: () => Promise<VeriKaliteBulgu>
}

const KONTROLLER: KontrolTanimi[] = [
  { kod: 'aktif-personel-servis-yok', baslik: 'Aktif personel / servis yok', calistir: aktifPersonelServisYok },
  { kod: 'pasif-personel-servis-aktif', baslik: 'Pasif personel / servis aktif', calistir: pasifPersonelServisAktif },
  { kod: 'mukerrer-aktif-servis', baslik: 'Mükerrer aktif servis', calistir: mukerrerAktifServis },
  { kod: 'servis-var-arac-yok', baslik: 'Servis var / araç yok', calistir: servisVarAracYok },
  { kod: 'servis-var-sofor-yok', baslik: 'Servis var / sürücü yok', calistir: servisVarSoforYok },
  // Madde 4/5'in düzeltmesi sırasında ortaya çıkan, MASTER'ın 14 maddesinin
  // dışında ama gerçek bir ek bulgu: güzergah var, hiç sefer dilimi tanımlı
  // değil. Araç/şoför eksikliğiyle karıştırılmasın diye ayrı bulgu.
  { kod: 'guzergah-sefer-dilimi-tanimsiz', baslik: 'Güzergah var / sefer dilimi tanımsız', calistir: guzergahSeferDilimiTanimsiz },
  { kod: 'kapasitesi-eksik-arac', baslik: 'Kapasitesi eksik araç', calistir: kapasitesiEksikArac },
  { kod: 'koordinatsiz-durak', baslik: 'Koordinatsız durak', calistir: koordinatsizDurak },
  // 8. Vardiya uyumsuzluğu — ATLANDI: kurulamıyor (Personnel'de vardiya alanı
  // yok, ServisSeferDilimi.grupKodu IproVardiya'ya kasıtlı bağsız serbest
  // etiket). Bkz. keşif raporu madde B.8.
  { kod: 'cakisan-atamalar', baslik: 'Çakışan atamalar', calistir: cakisanAtamalar },
  // 10. Adres değişmiş / servis yeniden değerlendirilmemiş — ATLANDI:
  // Personnel için izlenebilir bir adres tarihçesi/audit kaynağı yok.
  // Bkz. keşif raporu madde B.10 (madde 31'in aynı açık sorunuyla birlikte).
  { kod: 'suresi-bitmis-gecici-atama', baslik: 'Süresi bitmiş geçici atama', calistir: suresiBitmisGeciciAtama },
  // TODO: madde 43/12 — "kapasite aşımı". Kapasite motoru
  // (servisKapasiteOzetiGetir, src/lib/servis-yonetimi/kapasite.ts) main'e
  // girdiğinde buraya bir kontrol olarak eklenecek.
  { kod: 'tarih-cakismasi-arac-sofor', baslik: 'Tarih çakışması (araç/şoför)', calistir: tarihCakismasiAracSofor },
  { kod: 'aktif-arac-pasif-firma', baslik: 'Eksik firma ilişkisi (a)', calistir: aktifAracPasifFirma },
  { kod: 'dis-firma-soforu-firmasiz', baslik: 'Eksik firma ilişkisi (b)', calistir: disFirmaSoforuFirmasiz },
]

export async function veriKaliteRaporuGetir(): Promise<VeriKaliteRaporSatiri[]> {
  const sonuclar = await Promise.allSettled(KONTROLLER.map(k => k.calistir()))
  return sonuclar.map((sonuc, i) => {
    if (sonuc.status === 'fulfilled') return sonuc.value
    const { kod, baslik } = KONTROLLER[i]
    return {
      kod,
      baslik,
      adet: 0,
      kayitlar: [],
      hata: sonuc.reason instanceof Error ? sonuc.reason.message : String(sonuc.reason),
    }
  })
}
