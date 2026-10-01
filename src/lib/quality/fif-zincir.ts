/**
 * FİF (KAL-FR-10) zincir çözücü — bölüm koltuklarından + KSS KOLTUKLARINDAN.
 *
 * NEDEN: 11 adımın aktörleri bugün forma ELLE giriliyor (kullanici-ara). Yanlış
 * kişi seçilirse form yanlış elde bekliyor. Zincir artık omurgadan çözülür:
 *   · sorumlu onaylayan   = SORUMLU bölümün müdürü (yoksa müdür yardımcısı)
 *   · yayınlayan onaylayan = YAYINLAYAN bölümün müdürü (yoksa müdür yardımcısı)
 *   · KSS                  = KSS KOLTUKLARINDA (FIF_KSS_KOLTUK_KODLARI) oturan
 *                            AKTİF kullanıcıların HEPSİ — biri onaylasa yeterli
 *
 * FAIL-CLOSED (Melih kararı): çözülemezse form ilerlemez, sebep döner. `fif.manage`
 * KSS yerine GEÇMEZ. Kalite kararı: KSS KOLTUK bazlı — kişi bazlı atama ve
 * `fif.kss` izni KULLANILMAZ; koltuk el değiştirince yetki kendiliğinden geçer.
 *
 * deneme-zincir.ts deseninin FİF karşılığı; kişi adı GÖMÜLMEZ, koltuk/rol
 * değişince zincir kendiliğinden yeni kişiye kurulur.
 */
import type { Prisma, PrismaClient } from '@/generated/prisma'

type Db = PrismaClient | Prisma.TransactionClient

export type ZincirKisi = { userId: string; ad: string; kaynak: 'MUDUR' | 'MUDUR_YARDIMCISI' | 'KSS_KOLTUK' }

/**
 * KSS koltukları — YALNIZ OrgUnit.code (kişi id'si / ad YOK). Kalite kararı:
 *   ORG-TF-P0085 = Sistem Kalite Sorumlusu · ORG-TF-P0079 = Kalite Müdürü
 * (dev DB'de doğrulandı: ikisi de aktif POSITION, adlar tek anlamlı. Prod'da
 * aynı kodlar beklenir — IFS senkronu ORG-TF-* kodlarını korur.)
 */
export const FIF_KSS_KOLTUK_KODLARI = ['ORG-TF-P0085', 'ORG-TF-P0079'] as const

export type FifZincirSonuc =
  | {
      ok: true
      sorumluOnaylayan: ZincirKisi | null
      yayinlayanOnaylayan: ZincirKisi | null
      kssler: ZincirKisi[]
    }
  | { ok: false; sebep: string }

/** Personnel → aktif User (deneme/personelinKullanicisi deseni). */
async function personelUser(
  db: Db,
  personnelId: string | null | undefined,
  kaynak: ZincirKisi['kaynak'],
): Promise<ZincirKisi | null> {
  if (!personnelId) return null
  const u = await db.user.findFirst({
    where: { personnelId, isActive: true },
    select: { id: true, name: true, email: true, personnel: { select: { adSoyad: true } } },
  })
  if (!u) return null
  return { userId: u.id, ad: u.name || u.personnel?.adSoyad || u.email || u.id, kaynak }
}

/**
 * Bölümün onaylayanı: müdür, yoksa müdür yardımcısı. PUT'ta bölüm değişince
 * onaylayan buradan yeniden çözülür (istemciden alınmaz).
 */
export async function bolumOnaylayan(db: Db, bolumId: string | null): Promise<ZincirKisi | null> {
  if (!bolumId) return null
  const dept = await db.departmentDefinition.findUnique({
    where: { id: bolumId },
    select: { mudurId: true, mudurYardimcisiId: true },
  })
  if (!dept) return null
  return (
    (await personelUser(db, dept.mudurId, 'MUDUR')) ??
    (await personelUser(db, dept.mudurYardimcisiId, 'MUDUR_YARDIMCISI'))
  )
}

/** Aktif KSS koltuklarında oturan personel id'leri (personnelId dolu koltuklar). */
async function kssKoltukPersonelIdleri(db: Db): Promise<string[]> {
  const koltuklar = await db.orgEmployee.findMany({
    where: {
      personnelId: { not: null },
      orgUnit: { code: { in: [...FIF_KSS_KOLTUK_KODLARI] }, isActive: true },
    },
    select: { personnelId: true },
  })
  return [...new Set(koltuklar.map((k) => k.personnelId).filter((x): x is string => !!x))]
}

/**
 * KSS koltuklarındaki TÜM aktif kullanıcılar — KSS bildirimleri hepsine gider,
 * KSS adımını herhangi biri yapar. Koltuk → OrgEmployee (personnelId dolu) → aktif User.
 */
export async function kssKoltukKullanicilari(db: Db): Promise<ZincirKisi[]> {
  const personelIdleri = await kssKoltukPersonelIdleri(db)
  if (personelIdleri.length === 0) return []
  const users = await db.user.findMany({
    where: { personnelId: { in: personelIdleri }, isActive: true },
    orderBy: { id: 'asc' },
    select: { id: true, name: true, email: true, personnel: { select: { adSoyad: true } } },
  })
  return users.map((u) => ({ userId: u.id, ad: u.name || u.personnel?.adSoyad || u.email || u.id, kaynak: 'KSS_KOLTUK' as const }))
}

/** Kullanıcı (aktif) bir KSS koltuğunda mı oturuyor? — KSS yetki kapısı (fif-access.isFifKss). */
export async function kullaniciKssKoltugundaMi(db: Db, userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false
  const u = await db.user.findFirst({ where: { id: userId, isActive: true }, select: { personnelId: true } })
  if (!u?.personnelId) return false
  const koltuk = await db.orgEmployee.findFirst({
    where: { personnelId: u.personnelId, orgUnit: { code: { in: [...FIF_KSS_KOLTUK_KODLARI] }, isActive: true } },
    select: { id: true },
  })
  return !!koltuk
}

/**
 * FİF'i AÇAN kişinin kendi bölümünün müdürü (yoksa müdür yardımcısı) —
 * "Onaya Gönder" bilgi bildirimi için. Personnel.departmentId → bolumOnaylayan.
 * Açan kişi müdürün kendisiyse ya da bölüm/koltuk çözülemezse null.
 */
export async function acaninBolumMuduru(db: Db, acanUserId: string | null): Promise<ZincirKisi | null> {
  if (!acanUserId) return null
  const u = await db.user.findUnique({
    where: { id: acanUserId },
    select: { personnel: { select: { departmentId: true } } },
  })
  const mudur = await bolumOnaylayan(db, u?.personnel?.departmentId ?? null)
  if (!mudur || mudur.userId === acanUserId) return null
  return mudur
}

/**
 * Zinciri çöz. Form onaya gönderilirken çağrılır; sonuç FİF'e snapshot'lanır
 * (koltuk sonradan değişse de akış ortada kalmaz — deneme modülündeki desen).
 */
export async function fifZinciriCoz(
  db: Db,
  girdi: { sorumluBolumId: string | null; yayinlayanBolumId: string | null },
): Promise<FifZincirSonuc> {
  const kssler = await kssKoltukKullanicilari(db)
  if (kssler.length === 0) {
    return {
      ok: false,
      sebep:
        'Kalite Sistem Sorumlusu (KSS) koltukları boş — Sistem Kalite Sorumlusu / Kalite Müdürü koltuğunda aktif kullanıcı yok. Form ilerletilemez, İnsan Varlıkları/BT ile iletişime geçin.',
    }
  }

  const sorumluOnaylayan = await bolumOnaylayan(db, girdi.sorumluBolumId)
  if (girdi.sorumluBolumId && !sorumluOnaylayan) {
    return { ok: false, sebep: 'Sorumlu bölümün müdürü/müdür yardımcısı çözülemedi (koltuk boş ya da kullanıcı hesabı yok).' }
  }

  const yayinlayanOnaylayan = await bolumOnaylayan(db, girdi.yayinlayanBolumId)
  if (girdi.yayinlayanBolumId && !yayinlayanOnaylayan) {
    return { ok: false, sebep: 'Yayınlayan bölümün müdürü/müdür yardımcısı çözülemedi (koltuk boş ya da kullanıcı hesabı yok).' }
  }

  return { ok: true, sorumluOnaylayan, yayinlayanOnaylayan, kssler }
}
