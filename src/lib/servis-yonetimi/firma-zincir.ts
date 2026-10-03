import { randomUUID } from 'node:crypto'
import type { Prisma } from '@/generated/prisma'
import { kaydetIslemGecmisi } from './audit'
import { bugunTR } from './tarih-kurallari'

// A5 — Firma pasifleştirilince ZİNCİRLEME pasif (Elif ürün kararı).
//
// Onay verilirse TEK transaction'da: firma + firmanın aktif araçları + aktif
// şoförleri pasif; bu araç/şoförlerin aktif varsayılan atamaları BUGÜNÜN
// tarihiyle kapatılır. Her kayıt için ayrı audit satırı yazılır; hepsi ortak bir
// `zincirIslemId` taşır (şema eklenmeden, audit JSON'unda — yeniDeger).
//
// Geri alma: yalnız O zincirleme işlemle pasifleşen araç/şoförler (isteğe bağlı)
// geri gelir. Önceden ayrıca pasifleştirilmiş kayıtlar zincirde HİÇ audit satırı
// almadığı için dokunulmaz; zincirden sonra tek başına yeniden
// aktifleştirilip/pasifleştirilmiş kayıtlar da (son audit olayı zincir satırı
// değilse) dokunulmaz. Kapatılan atamalar geri ALINMAZ (yalnız sayısı bilgi).
//
// Yerleşke ve güzergâh pasifinde zincirleme YOKTUR (mevcut uyarı kalır).

type Db = Prisma.TransactionClient

export const ZINCIR_ALANI = 'zincirIslemId'
const ZINCIR_HEDEF_TIPLERI = ['ARAC', 'SOFOR', 'GUZERGAH_ARAC_VARSAYILAN', 'GUZERGAH_SOFOR_VARSAYILAN'] as const

export const zincirPasifAciklamasi = (firmaAd: string) => `Firma pasifleştirildiği için (firma: ${firmaAd})`
export const zincirGeriAlAciklamasi = (firmaAd: string) =>
  `Firma geri alındığı için birlikte geri alındı (firma: ${firmaAd})`

export type ZincirSonucu = {
  islemId: string
  arac: number
  sofor: number
  aracAtama: number
  soforAtama: number
}

/** Kapatma tarihi: bugün; atama başlangıcı gelecekteyse başlangıç günü (bitiş >= başlangıç kuralı). */
function kapatmaGunu(baslangic: Date, bugun: string): Date {
  const bugunDate = new Date(`${bugun}T00:00:00.000Z`)
  return baslangic > bugunDate ? baslangic : bugunDate
}

export async function firmaZincirPasiflestir(
  tx: Db,
  firma: { id: string; ad: string },
  yapanId?: string | null,
  simdi: Date = new Date(),
): Promise<ZincirSonucu> {
  const islemId = randomUUID()
  const bugun = bugunTR(simdi)
  const aciklama = zincirPasifAciklamasi(firma.ad)

  const [aktifAraclar, aktifSoforler, tumAraclar, tumSoforler] = await Promise.all([
    tx.servisArac.findMany({ where: { firmaId: firma.id, aktif: true }, select: { id: true } }),
    tx.servisSofor.findMany({ where: { firmaId: firma.id, aktif: true }, select: { id: true } }),
    tx.servisArac.findMany({ where: { firmaId: firma.id }, select: { id: true } }),
    tx.servisSofor.findMany({ where: { firmaId: firma.id }, select: { id: true } }),
  ])
  const [aracAtamalari, soforAtamalari] = await Promise.all([
    tx.servisGuzergahAracVarsayilan.findMany({
      where: { aracId: { in: tumAraclar.map((a) => a.id) }, aktif: true },
      select: { id: true, baslangicTarihi: true, bitisTarihi: true },
    }),
    tx.servisGuzergahSoforVarsayilan.findMany({
      where: { soforId: { in: tumSoforler.map((s) => s.id) }, aktif: true },
      select: { id: true, baslangicTarihi: true, bitisTarihi: true },
    }),
  ])

  for (const a of aktifAraclar) {
    await tx.servisArac.update({ where: { id: a.id }, data: { aktif: false } })
    await kaydetIslemGecmisi({
      tx, hedefTipi: 'ARAC', hedefId: a.id, islem: 'PASIFLESTIRME', yapanId, aciklama,
      oncekiDeger: { aktif: true }, yeniDeger: { aktif: false, [ZINCIR_ALANI]: islemId },
    })
  }
  for (const s of aktifSoforler) {
    await tx.servisSofor.update({ where: { id: s.id }, data: { aktif: false } })
    await kaydetIslemGecmisi({
      tx, hedefTipi: 'SOFOR', hedefId: s.id, islem: 'PASIFLESTIRME', yapanId, aciklama,
      oncekiDeger: { aktif: true }, yeniDeger: { aktif: false, [ZINCIR_ALANI]: islemId },
    })
  }
  for (const v of aracAtamalari) {
    const bitis = kapatmaGunu(v.baslangicTarihi, bugun)
    await tx.servisGuzergahAracVarsayilan.update({
      where: { id: v.id },
      data: { bitisTarihi: bitis, aktif: false, updatedById: yapanId ?? null },
    })
    await kaydetIslemGecmisi({
      tx, hedefTipi: 'GUZERGAH_ARAC_VARSAYILAN', hedefId: v.id, islem: 'PASIFLESTIRME', yapanId, aciklama,
      oncekiDeger: { bitisTarihi: v.bitisTarihi, aktif: true },
      yeniDeger: { bitisTarihi: bitis, aktif: false, [ZINCIR_ALANI]: islemId },
    })
  }
  for (const v of soforAtamalari) {
    const bitis = kapatmaGunu(v.baslangicTarihi, bugun)
    await tx.servisGuzergahSoforVarsayilan.update({
      where: { id: v.id },
      data: { bitisTarihi: bitis, aktif: false, updatedById: yapanId ?? null },
    })
    await kaydetIslemGecmisi({
      tx, hedefTipi: 'GUZERGAH_SOFOR_VARSAYILAN', hedefId: v.id, islem: 'PASIFLESTIRME', yapanId, aciklama,
      oncekiDeger: { bitisTarihi: v.bitisTarihi, aktif: true },
      yeniDeger: { bitisTarihi: bitis, aktif: false, [ZINCIR_ALANI]: islemId },
    })
  }

  return {
    islemId,
    arac: aktifAraclar.length,
    sofor: aktifSoforler.length,
    aracAtama: aracAtamalari.length,
    soforAtama: soforAtamalari.length,
  }
}

// ----------------------------------------------------------------------------
// Geri alma
// ----------------------------------------------------------------------------

function zincirIdOku(yeniDeger: Prisma.JsonValue | null | undefined): string | null {
  if (yeniDeger && typeof yeniDeger === 'object' && !Array.isArray(yeniDeger)) {
    const deger = (yeniDeger as Record<string, unknown>)[ZINCIR_ALANI]
    return typeof deger === 'string' && deger ? deger : null
  }
  return null
}

/** Firmanın EN SON pasifleştirme audit satırındaki zincir kimliği (zincirsiz pasifleştirmede null). */
async function sonZincirIslemId(db: Db, firmaId: string): Promise<string | null> {
  const sonPasif = await db.servisIslemGecmisi.findFirst({
    where: { hedefTipi: 'FIRMA', hedefId: firmaId, islem: 'PASIFLESTIRME' },
    orderBy: [{ tarih: 'desc' }, { id: 'desc' }],
    select: { yeniDeger: true },
  })
  return zincirIdOku(sonPasif?.yeniDeger)
}

/** Kayıt için SON audit olayı, verilen satır mı? (sonradan ayrıca değiştirilmişse hayır.) */
async function sonOlayBuSatirMi(db: Db, hedefTipi: 'ARAC' | 'SOFOR', hedefId: string, satirId: string) {
  const son = await db.servisIslemGecmisi.findFirst({
    where: { hedefTipi, hedefId },
    orderBy: [{ tarih: 'desc' }, { id: 'desc' }],
    select: { id: true },
  })
  return son?.id === satirId
}

export type ZincirOnizleme = {
  zincirIslemId: string | null
  /** Zincirle pasifleşmiş VE hâlâ pasif/dokunulmamış → geri alınabilecek */
  geriAlinabilirArac: number
  geriAlinabilirSofor: number
  /** Zincirde kapatılan atamalar — geri ALINMAZ, yalnız bilgi */
  kapananAtama: number
}

type ZincirSatiri = { id: string; hedefTipi: string; hedefId: string }

async function zincirSatirlari(db: Db, zincirIslemId: string): Promise<ZincirSatiri[]> {
  return db.servisIslemGecmisi.findMany({
    where: {
      islem: 'PASIFLESTIRME',
      hedefTipi: { in: [...ZINCIR_HEDEF_TIPLERI] },
      yeniDeger: { path: [ZINCIR_ALANI], equals: zincirIslemId },
    },
    select: { id: true, hedefTipi: true, hedefId: true },
  })
}

async function geriAlinabilirler(db: Db, satirlar: ZincirSatiri[]) {
  const araclar: string[] = []
  const soforler: string[] = []
  for (const s of satirlar) {
    if (s.hedefTipi !== 'ARAC' && s.hedefTipi !== 'SOFOR') continue
    const kayit =
      s.hedefTipi === 'ARAC'
        ? await db.servisArac.findUnique({ where: { id: s.hedefId }, select: { aktif: true } })
        : await db.servisSofor.findUnique({ where: { id: s.hedefId }, select: { aktif: true } })
    if (!kayit || kayit.aktif) continue // zaten aktif (elle geri alınmış)
    if (!(await sonOlayBuSatirMi(db, s.hedefTipi, s.hedefId, s.id))) continue // sonradan ayrıca değişmiş
    ;(s.hedefTipi === 'ARAC' ? araclar : soforler).push(s.hedefId)
  }
  return { araclar, soforler }
}

/** Geri alma diyaloğu için: yazma YOK. */
export async function firmaZincirOnizleme(db: Db, firmaId: string): Promise<ZincirOnizleme> {
  const zincirIslemId = await sonZincirIslemId(db, firmaId)
  if (!zincirIslemId) return { zincirIslemId: null, geriAlinabilirArac: 0, geriAlinabilirSofor: 0, kapananAtama: 0 }
  const satirlar = await zincirSatirlari(db, zincirIslemId)
  const { araclar, soforler } = await geriAlinabilirler(db, satirlar)
  return {
    zincirIslemId,
    geriAlinabilirArac: araclar.length,
    geriAlinabilirSofor: soforler.length,
    kapananAtama: satirlar.filter((s) => s.hedefTipi.endsWith('_VARSAYILAN')).length,
  }
}

export type ZincirGeriAlSonucu = { arac: number; sofor: number; kapananAtama: number }

/** Firma ZATEN aktifleştirildikten sonra, aynı transaction'da çağrılır. */
export async function firmaZincirGeriAl(
  tx: Db,
  firma: { id: string; ad: string },
  zincirIslemId: string,
  yapanId?: string | null,
): Promise<ZincirGeriAlSonucu> {
  const satirlar = await zincirSatirlari(tx, zincirIslemId)
  const { araclar, soforler } = await geriAlinabilirler(tx, satirlar)
  const aciklama = zincirGeriAlAciklamasi(firma.ad)

  for (const id of araclar) {
    await tx.servisArac.update({ where: { id }, data: { aktif: true } })
    await kaydetIslemGecmisi({
      tx, hedefTipi: 'ARAC', hedefId: id, islem: 'AKTIFLESTIRME', yapanId, aciklama,
      oncekiDeger: { aktif: false }, yeniDeger: { aktif: true, [ZINCIR_ALANI]: zincirIslemId },
    })
  }
  for (const id of soforler) {
    await tx.servisSofor.update({ where: { id }, data: { aktif: true } })
    await kaydetIslemGecmisi({
      tx, hedefTipi: 'SOFOR', hedefId: id, islem: 'AKTIFLESTIRME', yapanId, aciklama,
      oncekiDeger: { aktif: false }, yeniDeger: { aktif: true, [ZINCIR_ALANI]: zincirIslemId },
    })
  }
  return {
    arac: araclar.length,
    sofor: soforler.length,
    kapananAtama: satirlar.filter((s) => s.hedefTipi.endsWith('_VARSAYILAN')).length,
  }
}

/** Geri alma sırasında firmanın son pasifleştirmesinin zincir kimliği (yoksa null). */
export const firmaSonZincirIslemId = sonZincirIslemId
