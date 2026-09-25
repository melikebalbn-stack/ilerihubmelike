/**
 * FİF (KAL-FR-10) zincir çözücü — bölüm koltuklarından + KSS rolünden.
 *
 * NEDEN: 11 adımın aktörleri bugün forma ELLE giriliyor (kullanici-ara). Yanlış
 * kişi seçilirse form yanlış elde bekliyor. Zincir artık omurgadan çözülür:
 *   · sorumlu onaylayan   = SORUMLU bölümün müdürü (yoksa müdür yardımcısı)
 *   · yayınlayan onaylayan = YAYINLAYAN bölümün müdürü (yoksa müdür yardımcısı)
 *   · KSS                  = `fif.kss` iznine sahip AKTİF kullanıcı
 *
 * FAIL-CLOSED (Melih kararı): çözülemezse form ilerlemez, sebep döner. `fif.manage`
 * KSS yerine GEÇMEZ — aksi hâlde ayrı rol açmanın anlamı kalmazdı.
 *
 * deneme-zincir.ts deseninin FİF karşılığı; kişi adı GÖMÜLMEZ, koltuk/rol
 * değişince zincir kendiliğinden yeni kişiye kurulur.
 */
import type { Prisma, PrismaClient } from '@/generated/prisma'

type Db = PrismaClient | Prisma.TransactionClient

export type ZincirKisi = { userId: string; ad: string; kaynak: 'MUDUR' | 'MUDUR_YARDIMCISI' | 'KSS_ROL' }

export type FifZincirSonuc =
  | {
      ok: true
      sorumluOnaylayan: ZincirKisi | null
      yayinlayanOnaylayan: ZincirKisi | null
      kss: ZincirKisi
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

/** Bölümün onaylayanı: müdür, yoksa müdür yardımcısı. */
async function bolumOnaylayan(db: Db, bolumId: string | null): Promise<ZincirKisi | null> {
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

/**
 * `fif.kss` izinli AKTİF kullanıcı. Birden fazlaysa determinist seçim
 * (id'ye göre ilk) — rol tek kişilik tasarlandı, çoğalırsa da davranış sabit kalır.
 */
export async function kssKullanicisi(db: Db): Promise<ZincirKisi | null> {
  const u = await db.user.findFirst({
    where: {
      isActive: true,
      userRoles: { some: { role: { rolePermissions: { some: { permission: { key: 'fif.kss' } } } } } },
    },
    orderBy: { id: 'asc' },
    select: { id: true, name: true, email: true },
  })
  if (!u) return null
  return { userId: u.id, ad: u.name || u.email || u.id, kaynak: 'KSS_ROL' }
}

/**
 * Zinciri çöz. Form onaya gönderilirken çağrılır; sonuç FİF'e snapshot'lanır
 * (koltuk sonradan değişse de akış ortada kalmaz — deneme modülündeki desen).
 */
export async function fifZinciriCoz(
  db: Db,
  girdi: { sorumluBolumId: string | null; yayinlayanBolumId: string | null },
): Promise<FifZincirSonuc> {
  const kss = await kssKullanicisi(db)
  if (!kss) {
    return {
      ok: false,
      sebep:
        'Kalite Sistem Sorumlusu (KSS) tanımlı değil — "fif.kss" izni olan aktif kullanıcı yok. Form ilerletilemez, İnsan Varlıkları/BT ile iletişime geçin.',
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

  return { ok: true, sorumluOnaylayan, yayinlayanOnaylayan, kss }
}
