/**
 * Org şemasında YUKARI YÜRÜYEN üst yönetim çözücüsü — eskalasyon hedefi.
 *
 * NEDEN ÖZYİNELEMELİ: bölümlerin "bir üst birimi" çoğu zaman üst yönetim DEĞİL.
 * 25.09.2026 ölçümü (30 bölüm): yalnız 10'u doğrudan GMY'ye bağlı; kalanların
 * üstü Üretim Mühendisi, İç Lojistik Sorumlusu, Bakım Mühendisi gibi ARA
 * koltuklar, 2 bölümün (BÜRO MEMURU, DEPO) hiç parent'ı yok. "Bir üst birime
 * eskale et" denirse Talaşlı İmalat'ın eskalasyonu Üretim Mühendisi'nde kalır.
 * Bu yüzden ağaçta GMY/GM koltuğu bulunana kadar yukarı çıkılır.
 *
 * Kişi adı GÖMÜLMEZ: koltuk (OrgUnit.code) üzerinden çözülür, koltuk el
 * değiştirince hedef kendiliğinden yeni kişiye gider.
 */
import type { Prisma, PrismaClient } from '@/generated/prisma'

type Db = PrismaClient | Prisma.TransactionClient

/** Üst yönetim koltuk kodları — deneme-zincir.ts MUAF_POZISYON_KODLARI ile aynı kaynak mantığı. */
export const GMY_KODU = 'ORG-TF-GMY'
export const GM_KODU = 'ORG-TF-GM'

/** Ağaçta yukarı yürürken en fazla bu kadar seviye çıkılır (döngü guard'ı). */
const AZAMI_SEVIYE = 12

export type UstYonetim = {
  orgUnitId: string
  code: string
  name: string
  /** Koltukta oturan kişinin User id'si — koltuk boşsa ya da hesabı yoksa null. */
  userId: string | null
  adSoyad: string | null
}

/** OrgUnit koltuğundaki kişinin aktif User'ı (determinist: en eski koltuk). */
async function koltuktakiUser(db: Db, orgUnitId: string): Promise<{ userId: string | null; adSoyad: string | null }> {
  // OrgEmployee → Personnel ilişkisi select'te yok (şemada formal relation
  // kurulmamış); personnelId ile ayrı sorgu (deneme-zincir gmyPersonelId deseni).
  const koltuk = await db.orgEmployee.findFirst({
    where: { orgUnitId, personnelId: { not: null } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { personnelId: true },
  })
  const pid = koltuk?.personnelId
  if (!pid) return { userId: null, adSoyad: null }
  const [p, u] = await Promise.all([
    db.personnel.findUnique({ where: { id: pid }, select: { adSoyad: true } }),
    db.user.findFirst({ where: { personnelId: pid, isActive: true }, select: { id: true } }),
  ])
  return { userId: u?.id ?? null, adSoyad: p?.adSoyad ?? null }
}

/** Kod ile koltuk (GM/GMY gibi tekil kutular). */
export async function koltukKoduIle(db: Db, code: string): Promise<UstYonetim | null> {
  const ou = await db.orgUnit.findFirst({ where: { code, isActive: true }, orderBy: { id: 'asc' }, select: { id: true, code: true, name: true } })
  if (!ou) return null
  const k = await koltuktakiUser(db, ou.id)
  return { orgUnitId: ou.id, code: ou.code ?? code, name: ou.name, ...k }
}

/**
 * Bölümün org ağacındaki İLK GMY/GM koltuğu (kendisi dahil değil, yukarı doğru).
 * Bulunamazsa (parent zinciri kopuk / bölümün orgUnit bağı yok) null → çağıran
 * fail-open kararını verir (bkz. fif-eskalasyon: GM + super-admin).
 */
export async function ustYonetimKoltugu(db: Db, departmentId: string | null): Promise<UstYonetim | null> {
  if (!departmentId) return null
  const dept = await db.departmentDefinition.findUnique({
    where: { id: departmentId },
    select: { orgUnitId: true },
  })
  let mevcutId = dept?.orgUnitId ?? null
  if (!mevcutId) return null

  for (let i = 0; i < AZAMI_SEVIYE; i++) {
    const ou: { id: string; code: string | null; name: string; parentId: string | null } | null =
      await db.orgUnit.findUnique({
        where: { id: mevcutId },
        select: { id: true, code: true, name: true, parentId: true },
      })
    if (!ou) return null
    // Kendisi GMY/GM ise (ör. GMY'ye bağlı bölümün üstü) o koltuk hedeftir —
    // ama başladığımız bölümün KENDİSİ hedef olamaz, o yüzden parent'tan başlarız.
    if (i > 0 && (ou.code === GMY_KODU || ou.code === GM_KODU)) {
      const k = await koltuktakiUser(db, ou.id)
      return { orgUnitId: ou.id, code: ou.code, name: ou.name, ...k }
    }
    if (!ou.parentId) return null
    mevcutId = ou.parentId
  }
  return null
}
