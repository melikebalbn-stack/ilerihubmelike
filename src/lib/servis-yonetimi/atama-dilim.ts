import { prisma } from '@/lib/prisma'
import { kaydetIslemGecmisi } from './audit'
import {
  AtamaDilimHatasi,
  asimOnayiKontrol,
  atamaGunuKapsar,
  etkiSatiriOlustur,
  kapasiteEtkisiHesapla,
  type AtamaDilimHataKodu,
  type KapasiteEtkisiSatiri,
} from './kapasite-asim'
import { bugunTR } from './tarih-kurallari'

// C0: ortak kapasite aşımı kuralı kapasite-asim.ts'te; geriye dönük import yolları korunur.
export { AtamaDilimHatasi, atamaGunuKapsar, etkiSatiriOlustur }
export type { AtamaDilimHataKodu, KapasiteEtkisiSatiri }

// ============================================================================
// Personel atamasına SEFER DİLİMİ ekleme / çıkarma (B5) — tek ve toplu.
// ============================================================================
//
// NEDEN: Kapasite motoru personeli (güzergâh × dilim) çiftlerinden sayar; dilim bağlantısı
// olmayan atama (ör. göçle gelen IMPORT atamaları) kapasiteye girmez. Dilim seçimi daha önce
// yalnız atama OLUŞTURURKEN yapılabiliyordu ("immutable"); bu dosya sonradan ekleme/çıkarmayı
// güvenli yapar.
//
// ŞEMA DEĞİŞİKLİĞİ YOK: servis_personel_atama_dilim satırları eklenir/silinir (unique atamaId+dilimId),
// tarihçe mevcut PERSONEL_ATAMA_DILIM hedef tipi + GUNCELLEME işlemiyle yazılır.
//
// KURALLAR
//  • Yalnız AKTİF atama ve AKTİF dilim; atama bu güzergâha ait olmalı.
//  • Tek transaction: bir satır başarısızsa HİÇBİRİ uygulanmaz; tarihçe AYNI transaction'da
//    (yazılamazsa işlem geri alınır — fail-closed).
//  • Her atama için AYRI tarihçe satırı (önceki/sonraki dilim listesi + kodlar); toplu işlemde
//    ortak `topluIslemId`. Hiçbir şey fiziksel olarak izsiz silinmez: çıkarılan dilim önceki
//    listede kalır → tarihçeden geri alınabilir.
//  • Kapasite AŞIMI: eklenen dilimde personel > koltuk olacaksa işlem ONAY ister (asimOnayi).
//    Araçsız dilimde koltuk yoktur; aşım sayılmaz (motorla aynı kural).
//  • Çıkarma sonucu atamanın hiç dilimi kalacaksa ONAY ister (dilimsizOnayi).
//  • KVKK: tarihçede kişi adı/sicil yok; yalnız dilim kimlik/kodları.

/** Toplu işlemde tek seferde en fazla atama (öneri: 63 atamalık göç + pay; aşırı büyük işlemi önler). */
export const TOPLU_DILIM_ATAMA_LIMITI = 200

type Dilim = { id: string; kod: string; ad: string }

type AtamaOzeti = {
  id: string
  guzergahId: string
  aktif: boolean
  baslangicTarihi: Date
  bitisTarihi: Date | null
  dilimler: { dilimId: string }[]
}

export type DilimOnizlemeSonucu = {
  atamaSayisi: number
  /** Dilim eklenecek (en az bir dilimi eksik) atama sayısı. */
  degisecek: number
  /** Seçilen dilimlerin hepsi zaten bağlı olan atama sayısı. */
  zatenVar: number
  dilimler: { id: string; kod: string; ad: string }[]
  etki: KapasiteEtkisiSatiri[]
  asimVar: boolean
}

// ---------------------------------------------------------------------------
// Saf yardımcılar (DB'siz, test edilebilir)
// ---------------------------------------------------------------------------

export function dilimFarki(onceki: string[], ekle: string[], cikar: string[]) {
  const mevcut = new Set(onceki)
  const eklenen = [...new Set(ekle)].filter((d) => !mevcut.has(d))
  const cikarilan = [...new Set(cikar)].filter((d) => mevcut.has(d))
  const sonraki = [...onceki.filter((d) => !cikarilan.includes(d)), ...eklenen]
  return { eklenen, cikarilan, sonraki }
}

const tekil = (l: string[] | undefined) => [...new Set((l ?? []).map((x) => x.trim()).filter(Boolean))]

// ---------------------------------------------------------------------------
// DB
// ---------------------------------------------------------------------------

async function dilimleriDogrula(dilimIdleri: string[]): Promise<Dilim[]> {
  if (dilimIdleri.length === 0) return []
  const dilimler = await prisma.servisSeferDilimi.findMany({
    where: { id: { in: dilimIdleri } },
    select: { id: true, kod: true, ad: true, aktif: true },
  })
  if (dilimler.length !== dilimIdleri.length) throw new AtamaDilimHatasi('Seçilen sefer dilimlerinden biri veya birkaçı bulunamadı.')
  const pasif = dilimler.find((d) => !d.aktif)
  if (pasif) throw new AtamaDilimHatasi(`"${pasif.kod}" dilimi pasif, atama yapılamaz.`)
  return dilimler.map(({ id, kod, ad }) => ({ id, kod, ad }))
}

async function atamalariYukle(guzergahId: string | null, atamaIdleri: string[]): Promise<AtamaOzeti[]> {
  const atamalar = await prisma.servisPersonelAtama.findMany({
    where: { id: { in: atamaIdleri } },
    select: { id: true, guzergahId: true, aktif: true, baslangicTarihi: true, bitisTarihi: true, dilimler: { select: { dilimId: true } } },
  })
  if (atamalar.length !== atamaIdleri.length) throw new AtamaDilimHatasi('Seçilen atamalardan biri veya birkaçı bulunamadı.')
  if (guzergahId && atamalar.some((a) => a.guzergahId !== guzergahId)) {
    throw new AtamaDilimHatasi('Seçilen atamalardan biri bu güzergâha ait değil.')
  }
  if (atamalar.some((a) => !a.aktif)) throw new AtamaDilimHatasi('Pasif atamaya dilim eklenemez/çıkarılamaz. Önce atamayı geri alın.')
  return atamalar
}

type Plan = {
  atama: AtamaOzeti
  eklenen: string[]
  cikarilan: string[]
  onceki: string[]
  sonraki: string[]
}

function planlaAtamalar(atamalar: AtamaOzeti[], ekle: string[], cikar: string[]): Plan[] {
  return atamalar.map((atama) => {
    const onceki = atama.dilimler.map((d) => d.dilimId)
    const { eklenen, cikarilan, sonraki } = dilimFarki(onceki, ekle, cikar)
    return { atama, eklenen, cikarilan, onceki, sonraki }
  })
}

async function kapasiteEtkisi(
  guzergahId: string,
  planlar: Plan[],
  dilimler: Dilim[],
  gun: string,
): Promise<KapasiteEtkisiSatiri[]> {
  // Yalnız bugün kapasiteye girecek (tarihi kapsayan) ve bu dilimi KAZANAN atamalar etkiler.
  const eklenen = new Map(
    dilimler.map((d) => [d.id, planlar.filter((p) => p.eklenen.includes(d.id) && atamaGunuKapsar(p.atama, gun)).length] as const),
  )
  return kapasiteEtkisiHesapla({ id: guzergahId }, dilimler, eklenen, gun)
}

function atamaIdleriniDogrula(atamaIdleri: string[] | undefined): string[] {
  const idler = tekil(atamaIdleri)
  if (idler.length === 0) throw new AtamaDilimHatasi('En az bir atama seçilmelidir.')
  if (idler.length > TOPLU_DILIM_ATAMA_LIMITI) {
    throw new AtamaDilimHatasi(`Tek seferde en fazla ${TOPLU_DILIM_ATAMA_LIMITI} atama işlenebilir (seçilen: ${idler.length}).`)
  }
  return idler
}

/** TOPLU ÖNİZLEME (yazmaz): "N atama, dilim X; kapasite etkisi …". */
export async function topluDilimOnizle(
  guzergahId: string,
  girdi: { atamaIdleri: string[]; dilimIdleri: string[] },
  gun: string = bugunTR(),
): Promise<DilimOnizlemeSonucu> {
  const atamaIdleri = atamaIdleriniDogrula(girdi.atamaIdleri)
  const dilimIdleri = tekil(girdi.dilimIdleri)
  if (dilimIdleri.length === 0) throw new AtamaDilimHatasi('En az bir sefer dilimi seçilmelidir.')

  const [dilimler, atamalar] = await Promise.all([dilimleriDogrula(dilimIdleri), atamalariYukle(guzergahId, atamaIdleri)])
  const planlar = planlaAtamalar(atamalar, dilimIdleri, [])
  const etki = await kapasiteEtkisi(guzergahId, planlar, dilimler, gun)
  const degisecek = planlar.filter((p) => p.eklenen.length > 0).length
  return {
    atamaSayisi: atamalar.length,
    degisecek,
    zatenVar: atamalar.length - degisecek,
    dilimler,
    etki,
    asimVar: etki.some((e) => e.asim),
  }
}

export type DilimUygulamaSonucu = {
  topluIslemId: string | null
  degisen: number
  degismeyen: number
}

async function planiYaz(
  planlar: Plan[],
  yapanId: string,
  aciklama: string,
  topluIslemId: string | null,
): Promise<DilimUygulamaSonucu> {
  // Tarihçede kimlik yanında OKUNABİLİR kodlar da tutulur (önceki + sonraki listedeki tüm dilimler).
  const dilimAdlari = await tekilDilimAdlari([...new Set(planlar.flatMap((p) => [...p.onceki, ...p.sonraki]))])
  const kodlar = (idler: string[]) => idler.map((id) => dilimAdlari.get(id) ?? id)
  let degisen = 0
  await prisma.$transaction(async (tx) => {
    for (const p of planlar) {
      if (p.eklenen.length === 0 && p.cikarilan.length === 0) continue
      // İşlem sırasında atama kapanmış olabilir: tx içinde yeniden doğrula.
      const guncel = await tx.servisPersonelAtama.findUnique({ where: { id: p.atama.id }, select: { aktif: true } })
      if (!guncel || !guncel.aktif) throw new AtamaDilimHatasi('Atamalardan biri bu sırada kapatıldı; işlem uygulanmadı.')

      if (p.cikarilan.length > 0) {
        await tx.servisPersonelAtamaDilim.deleteMany({ where: { atamaId: p.atama.id, dilimId: { in: p.cikarilan } } })
      }
      if (p.eklenen.length > 0) {
        await tx.servisPersonelAtamaDilim.createMany({ data: p.eklenen.map((dilimId) => ({ atamaId: p.atama.id, dilimId })) })
      }
      await kaydetIslemGecmisi({
        tx,
        hedefTipi: 'PERSONEL_ATAMA_DILIM',
        hedefId: p.atama.id,
        islem: 'GUNCELLEME',
        yapanId,
        oncekiDeger: { dilimIdleri: p.onceki, dilimKodlari: kodlar(p.onceki) },
        yeniDeger: {
          dilimIdleri: p.sonraki, dilimKodlari: kodlar(p.sonraki),
          ...(topluIslemId ? { topluIslemId } : {}),
        },
        aciklama,
      })
      degisen++
    }
  })
  return { topluIslemId, degisen, degismeyen: planlar.length - degisen }
}

/** TOPLU UYGULAMA: seçilen atamalara dilim EKLER (mod: ekle). Hepsi ya da hiçbiri. */
export async function topluDilimAta(
  guzergahId: string,
  girdi: { atamaIdleri: string[]; dilimIdleri: string[]; asimOnayi?: boolean },
  yapanId: string,
  gun: string = bugunTR(),
): Promise<DilimUygulamaSonucu> {
  const onizleme = await topluDilimOnizle(guzergahId, girdi, gun)
  if (onizleme.degisecek === 0) {
    throw new AtamaDilimHatasi('Seçilen atamaların hepsinde bu dilimler zaten var; değişiklik yok.')
  }
  asimOnayiKontrol(onizleme.etki, girdi.asimOnayi, 'Bu işlem bir veya daha fazla dilimde kapasiteyi aşacak. Devam etmek için aşım onayı gerekir.')
  const atamalar = await atamalariYukle(guzergahId, atamaIdleriniDogrula(girdi.atamaIdleri))
  const planlar = planlaAtamalar(atamalar, tekil(girdi.dilimIdleri), [])
  const topluIslemId = crypto.randomUUID()
  return planiYaz(planlar, yapanId, `Toplu dilim atama (${onizleme.degisecek} atama)`, topluIslemId)
}

/** TEK ATAMA: dilim ekle/çıkar. Hiç dilim kalacaksa dilimsizOnayi, aşım olacaksa asimOnayi ister. */
export async function atamaDilimleriniGuncelle(
  atamaId: string,
  girdi: { ekle?: string[]; cikar?: string[]; asimOnayi?: boolean; dilimsizOnayi?: boolean },
  yapanId: string,
  gun: string = bugunTR(),
): Promise<DilimUygulamaSonucu & { sonraki: string[] }> {
  const ekle = tekil(girdi.ekle)
  const cikar = tekil(girdi.cikar)
  if (ekle.length === 0 && cikar.length === 0) throw new AtamaDilimHatasi('Değişiklik yok.')
  if (ekle.some((d) => cikar.includes(d))) throw new AtamaDilimHatasi('Aynı dilim hem eklenip hem çıkarılamaz.')

  const [atama] = await atamalariYukle(null, [atamaId])
  const dilimler = await dilimleriDogrula(ekle)
  const [plan] = planlaAtamalar([atama], ekle, cikar)
  if (plan.eklenen.length === 0 && plan.cikarilan.length === 0) throw new AtamaDilimHatasi('Değişiklik yok.')

  if (plan.sonraki.length === 0 && !girdi.dilimsizOnayi) {
    throw new AtamaDilimHatasi(
      'Bu işlem atamanın hiç sefer dilimini bırakmayacak; dilimsiz atama kapasiteye girmez. Devam etmek için onay gerekir.',
      'DILIMSIZ_ONAYI_GEREKLI',
    )
  }

  const eklenenDilimler = dilimler.filter((d) => plan.eklenen.includes(d.id))
  const etki = await kapasiteEtkisi(atama.guzergahId, [plan], eklenenDilimler, gun)
  asimOnayiKontrol(etki, girdi.asimOnayi, 'Bu işlem bir dilimde kapasiteyi aşacak. Devam etmek için aşım onayı gerekir.')

  const sonuc = await planiYaz([plan], yapanId, 'Dilim düzenleme', null)
  return { ...sonuc, sonraki: plan.sonraki }
}

async function tekilDilimAdlari(idler: string[]): Promise<Map<string, string>> {
  if (idler.length === 0) return new Map()
  const satirlar = await prisma.servisSeferDilimi.findMany({ where: { id: { in: idler } }, select: { id: true, kod: true } })
  return new Map(satirlar.map((d) => [d.id, d.kod]))
}
