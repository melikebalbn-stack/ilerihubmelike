import 'server-only'
import type { Prisma, PrismaClient } from '@/generated/prisma'
import { SISTEM_AKTOR_ID } from '@/lib/audit-log'
import { IsapiHata, kimlikTanimliMi, type IsapiCihaz } from './isapi-istemci'
import { kartSil, kartYaz, kullaniciSil, kullaniciYaz, paneldekiKartlar } from './isapi-kart'
import { kartNoGoster } from './kart-no'

/**
 * PDKS Hub → panel senkronu (plan §3.2). İstenen durum Hub'da (PdksKart), gerçek durum
 * PdksKartCihaz defterinde. UI panele DOĞRUDAN yazmaz; bu işçi yakınsatır.
 *
 * Tur (senkronCalistir):
 *   0. Pasif personelin AKTİF kartlarını kapat (offboarding süpürmesi — her turda).
 *   1. Aktif HIKVISION cihaz yoksa (ya da env kimliği yoksa) → NO-OP.
 *   2. Defter tamamlama: AKTİF kart × aktif cihaz için satır yoksa BEKLIYOR aç;
 *      PASİF kartın BEKLIYOR/YUKLENDI satırı SILINECEK'e çekilir.
 *   3. Kuyruk: ÖNCE SILINECEK (güvenlik — pasifleme öncelikli), sonra BEKLIYOR; deneme<5,
 *      üstel geri çekilme (2^deneme dk). Tur başına en fazla TUR_LIMIT iş.
 *   4. Hata → deneme+1, 5. denemede HATA (elle müdahale). Cihaz erişilemiyorsa (zaman aşımı /
 *      bağlantı / kimlik) o cihazın kalan işleri bu turda denenmez (10 sn × 50 iş israfı yok).
 */

export const MAKS_DENEME = 5
export const TUR_LIMIT = 50
export const MUTABAKAT_ANAHTARI = 'pdks_mutabakat_son'

type Db = PrismaClient
type Tx = Prisma.TransactionClient

// ── Offboarding süpürmesi ────────────────────────────────────────────────────

/**
 * Güvenlik ağı: tek turda bundan FAZLA kart kapatılacaksa HİÇBİRİ kapatılmaz. Girdi
 * Personnel.aktif — IFS personel senkronundan gelir; hatalı bir tur toplu pasifleştirme yapıp
 * tüm fabrikayı turnikede bırakabilir. deaktive-ayrilan DEACTIVATION_ABORT_LIMIT (10) ile aynı desen.
 */
export const PASIF_KART_ABORT_LIMIT = 10

export interface PasifSupurmeSonucu {
  dryRun: boolean
  adet: number
  siciller: string[]
  /** Limit aşıldı → hiçbir kart kapatılmadı (elle karar). */
  abortedLimit: boolean
}

/**
 * Personnel.aktif=false olan kişilerin AKTİF kartlarını PASİF yapar ve panel satırlarını
 * SILINECEK'e çeker. Kaynağı ne olursa olsun (IFS senkronu, Excel import, elle düzenleme,
 * ilişik kesme) pasifleşen herkesi yakalar — tek tek yazma yollarına kanca atmaktan sağlam.
 * Çağıranlar: senkronCalistir (her tur) + deaktive-ayrilan-personel cron'u (gecelik, dry-run'a uyar).
 */
export async function pasifPersonelKartlariniKapat(db: Db, { dryRun }: { dryRun: boolean }): Promise<PasifSupurmeSonucu> {
  const kartlar = await db.pdksKart.findMany({
    where: { durum: 'AKTIF', personnel: { aktif: false } },
    select: { id: true, kartNoHam: true, personnel: { select: { sicilNo: true } } },
  })
  const sonuc: PasifSupurmeSonucu = {
    dryRun,
    adet: kartlar.length,
    siciller: kartlar.map((k) => k.personnel.sicilNo ?? '?'),
    abortedLimit: kartlar.length > PASIF_KART_ABORT_LIMIT,
  }
  if (dryRun || kartlar.length === 0 || sonuc.abortedLimit) return sonuc
  const simdi = new Date()
  await db.$transaction(async (tx) => {
    for (const k of kartlar) {
      await kartiPasifYap(tx, k.id, 'AYRILDI', SISTEM_AKTOR_ID, simdi)
      await tx.permissionAuditLog.create({
        data: {
          action: 'PDKS_KART_PASIFLENDI',
          actorId: SISTEM_AKTOR_ID,
          targetType: 'PDKS_KART',
          targetId: k.id,
          details: { neden: 'AYRILDI', kaynak: 'personel-pasif-supurmesi', sicil: k.personnel.sicilNo, kart: kartNoGoster(k.kartNoHam) },
        },
      })
    }
  })
  return sonuc
}

/** Kartı PASİF yapar ve panel satırlarını SILINECEK'e çeker (deneme sıfırlanır). tx içinde çağrılır. */
export async function kartiPasifYap(tx: Tx, kartId: string, neden: string, aktorId: string, zaman = new Date()) {
  await tx.pdksKart.update({
    where: { id: kartId },
    data: { durum: 'PASIF', pasifNedeni: neden, pasifAt: zaman, pasifYapanId: aktorId, gecerliBitis: zaman },
  })
  await tx.pdksKartCihaz.updateMany({
    where: { kartId, durum: { in: ['BEKLIYOR', 'YUKLENDI', 'HATA'] } },
    data: { durum: 'SILINECEK', deneme: 0, sonHata: null, sonDenemeAt: null },
  })
}

// ── Senkron turu ─────────────────────────────────────────────────────────────

export interface SenkronOzet {
  noop: boolean
  sebep?: string
  supurme: PasifSupurmeSonucu
  cihaz: number
  defterAcilan: number
  islenen: number
  yuklendi: number
  silindi: number
  hata: number
  kaliciHata: number
  atlananCihaz: string[]
}

let calisiyor = false

type Cihaz = IsapiCihaz & { id: string; kod: string; kapilar: number[] }

async function aktifCihazlar(db: Db): Promise<Cihaz[]> {
  const cs = await db.pdksCihaz.findMany({
    where: { aktif: true, marka: 'HIKVISION' },
    select: { id: true, kod: true, host: true, envOnek: true, kapilar: { where: { aktif: true }, select: { kapiNo: true } } },
  })
  return cs
    .filter((c) => kimlikTanimliMi(c.envOnek))
    .map((c) => ({ id: c.id, kod: c.kod, host: c.host, envOnek: c.envOnek, kapilar: c.kapilar.map((k) => k.kapiNo).sort((a, b) => a - b) }))
}

/** Cihazın kalan işlerini bu tur denememeyi gerektiren hatalar (cihaz erişilemez / kimlik yanlış). */
const cihazDusuk = (e: unknown) =>
  e instanceof IsapiHata && ['ZAMAN_ASIMI', 'BAGLANTI_REDDEDILDI', 'ULASILAMIYOR', 'KIMLIK', 'YAPILANDIRMA'].includes(e.kod)

export async function senkronCalistir(db: Db, { limit = TUR_LIMIT }: { limit?: number } = {}): Promise<SenkronOzet> {
  if (calisiyor) {
    return { noop: true, sebep: 'başka bir senkron turu sürüyor', supurme: { dryRun: true, adet: 0, siciller: [], abortedLimit: false }, cihaz: 0, defterAcilan: 0, islenen: 0, yuklendi: 0, silindi: 0, hata: 0, kaliciHata: 0, atlananCihaz: [] }
  }
  calisiyor = true
  try {
    const supurme = await pasifPersonelKartlariniKapat(db, { dryRun: false })
    const ozet: SenkronOzet = { noop: false, supurme, cihaz: 0, defterAcilan: 0, islenen: 0, yuklendi: 0, silindi: 0, hata: 0, kaliciHata: 0, atlananCihaz: [] }

    const cihazlar = await aktifCihazlar(db)
    ozet.cihaz = cihazlar.length
    if (cihazlar.length === 0) return { ...ozet, noop: true, sebep: 'aktif Hikvision cihaz yok (ya da env kimlik bilgisi tanımlı değil)' }

    // 2. Defter tamamlama
    const aktifKartlar = await db.pdksKart.findMany({ where: { durum: 'AKTIF' }, select: { id: true } })
    if (aktifKartlar.length) {
      const r = await db.pdksKartCihaz.createMany({
        data: cihazlar.flatMap((c) => aktifKartlar.map((k) => ({ kartId: k.id, cihazId: c.id, durum: 'BEKLIYOR' }))),
        skipDuplicates: true,
      })
      ozet.defterAcilan = r.count
    }
    await db.pdksKartCihaz.updateMany({
      where: { durum: { in: ['BEKLIYOR', 'YUKLENDI'] }, kart: { durum: 'PASIF' } },
      data: { durum: 'SILINECEK', deneme: 0 },
    })

    // 3. Kuyruk — SILINECEK önce
    const simdi = Date.now()
    const adaylar = await db.pdksKartCihaz.findMany({
      where: { durum: { in: ['SILINECEK', 'BEKLIYOR'] }, deneme: { lt: MAKS_DENEME }, cihazId: { in: cihazlar.map((c) => c.id) } },
      orderBy: [{ sonDenemeAt: { sort: 'asc', nulls: 'first' } }],
      select: {
        id: true, durum: true, deneme: true, sonDenemeAt: true, cihazId: true,
        kart: {
          select: {
            id: true, kartNo: true, durum: true, personnelId: true, gecerliBaslangic: true, gecerliBitis: true,
            personnel: { select: { sicilNo: true, aktif: true } },
          },
        },
      },
    })
    const kuyruk = adaylar
      .filter((a) => !a.sonDenemeAt || simdi - a.sonDenemeAt.getTime() >= 2 ** a.deneme * 60_000)
      .sort((a, b) => (a.durum === b.durum ? 0 : a.durum === 'SILINECEK' ? -1 : 1))
      .slice(0, limit)

    const dusuk = new Set<string>()
    const cihazById = new Map(cihazlar.map((c) => [c.id, c]))
    const gorulen = new Set<string>()

    for (const is of kuyruk) {
      if (dusuk.has(is.cihazId)) continue
      const c = cihazById.get(is.cihazId)!
      const employeeNo = is.kart.personnel.sicilNo
      ozet.islenen++
      try {
        if (!employeeNo) throw new IsapiHata('YAPILANDIRMA', 'personelin sicil no\'su yok — panelde employeeNo olamaz')
        if (is.durum === 'SILINECEK') {
          const baskaAktif = await db.pdksKart.count({ where: { personnelId: is.kart.personnelId, durum: 'AKTIF', id: { not: is.kart.id } } })
          if (baskaAktif > 0) await kartSil(c, is.kart.kartNo)
          else await kullaniciSil(c, employeeNo) // kullanıcı silinince kartları da gider
          await db.pdksKartCihaz.update({ where: { id: is.id }, data: { durum: 'SILINDI', sonHata: null, sonDenemeAt: new Date() } })
          ozet.silindi++
        } else {
          if (is.kart.durum !== 'AKTIF' || !is.kart.personnel.aktif) {
            // Arada pasifleşti — yükleme yerine silme kuyruğuna.
            await db.pdksKartCihaz.update({ where: { id: is.id }, data: { durum: 'SILINECEK', deneme: 0 } })
            continue
          }
          await kullaniciYaz(c, {
            employeeNo,
            gecerliBaslangic: is.kart.gecerliBaslangic,
            gecerliBitis: is.kart.gecerliBitis,
            kapilar: c.kapilar,
          })
          await kartYaz(c, employeeNo, is.kart.kartNo)
          await db.pdksKartCihaz.update({
            where: { id: is.id },
            data: { durum: 'YUKLENDI', yuklendiAt: new Date(), sonHata: null, sonDenemeAt: new Date(), deneme: 0 },
          })
          ozet.yuklendi++
        }
        gorulen.add(c.id)
      } catch (e) {
        const deneme = is.deneme + 1
        const kalici = deneme >= MAKS_DENEME
        const mesaj = (e instanceof IsapiHata ? `${e.kod}: ${e.message}` : `BILINMEYEN: ${(e as Error)?.message ?? String(e)}`).slice(0, 300)
        await db.pdksKartCihaz.update({
          where: { id: is.id },
          data: { deneme, sonHata: mesaj, sonDenemeAt: new Date(), ...(kalici ? { durum: 'HATA' } : {}) },
        })
        ozet.hata++
        if (kalici) ozet.kaliciHata++
        if (!(e instanceof IsapiHata)) console.error('[pdks-senkron]', c.kod, e)
        if (cihazDusuk(e)) {
          dusuk.add(c.id)
          ozet.atlananCihaz.push(c.kod)
        }
      }
    }
    if (gorulen.size) await db.pdksCihaz.updateMany({ where: { id: { in: [...gorulen] } }, data: { sonGorulmeAt: new Date() } })
    return ozet
  } finally {
    calisiyor = false
  }
}

// ── Mutabakat (gece) ─────────────────────────────────────────────────────────

export interface MutabakatCihaz {
  kod: string
  panelde: number
  /** Panelde olup Hub'da AKTİF kart olarak tanımlı olmayan cardNo'lar — OTOMATİK SİLİNMEZ. */
  hubdaTanimsiz: { cardNo: string; employeeNo: string }[]
  /** Hub'da YUKLENDI görünen ama panelde bulunmayan kartlar. */
  paneldeEksik: { kartId: string; kart: string; sicil: string | null }[]
  hata?: string
}

export interface MutabakatSonucu {
  zaman: string
  cihazlar: MutabakatCihaz[]
}

/** Paneldeki kart listesini Hub ile karşılaştırır; sonucu SystemSetting'e yazar (ekran okur). */
export async function mutabakatCalistir(db: Db): Promise<MutabakatSonucu> {
  const cihazlar = await aktifCihazlar(db)
  const aktif = await db.pdksKart.findMany({
    where: { durum: 'AKTIF' },
    select: { id: true, kartNo: true, kartNoHam: true, personnel: { select: { sicilNo: true } }, cihazDurumlari: { select: { cihazId: true, durum: true } } },
  })
  const hubKartNo = new Set(aktif.map((k) => k.kartNo))
  const sonuc: MutabakatSonucu = { zaman: new Date().toISOString(), cihazlar: [] }
  for (const c of cihazlar) {
    try {
      const panel = await paneldekiKartlar(c)
      const panelKartNo = new Set(panel.map((p) => p.cardNo))
      sonuc.cihazlar.push({
        kod: c.kod,
        panelde: panel.length,
        hubdaTanimsiz: panel.filter((p) => !hubKartNo.has(p.cardNo)),
        paneldeEksik: aktif
          .filter((k) => k.cihazDurumlari.some((d) => d.cihazId === c.id && d.durum === 'YUKLENDI') && !panelKartNo.has(k.kartNo))
          .map((k) => ({ kartId: k.id, kart: kartNoGoster(k.kartNoHam), sicil: k.personnel.sicilNo })),
      })
    } catch (e) {
      sonuc.cihazlar.push({ kod: c.kod, panelde: 0, hubdaTanimsiz: [], paneldeEksik: [], hata: e instanceof IsapiHata ? `${e.kod}: ${e.message}` : 'beklenmeyen hata' })
    }
  }
  await db.systemSetting.upsert({
    where: { key: MUTABAKAT_ANAHTARI },
    create: { key: MUTABAKAT_ANAHTARI, value: JSON.stringify(sonuc), category: 'pdks' },
    update: { value: JSON.stringify(sonuc) },
  })
  return sonuc
}

export async function sonMutabakatOku(db: Db): Promise<MutabakatSonucu | null> {
  const a = await db.systemSetting.findUnique({ where: { key: MUTABAKAT_ANAHTARI }, select: { value: true } })
  if (!a) return null
  try {
    return JSON.parse(a.value) as MutabakatSonucu
  } catch {
    return null
  }
}
