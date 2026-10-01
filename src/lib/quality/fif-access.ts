/**
 * FİF (Faaliyet İstek Formu, KAL-FR-10) yetki + kapsam — TEK KAYNAK.
 *
 * Oluşturma: oturumu olan HERKES yeni FİF (TASLAK) açabilir.
 * Görme/düzenleme kapsamı:
 *   - canManageFif (Kalite ekibi/admin VEYA fif.manage) → TÜMÜ.
 *   - diğerleri → kendi açtığı (createdById) / hazırlayan olduğu (hazirlayanUserId)
 *     / sorumlu-yayınlayan bölümü kendi bölümü olan (Personnel.departmentId + omurgada
 *     sorumlu/müdür olduğu bölümler) kayıtlar
 *     / Paket 3: herhangi bir FAALİYET SATIRININ SORUMLUSU olduğu kayıtlar — YALNIZ
 *     GÖRME. Satır sorumlusu formu düzenleyemez; sadece kendi satırında "Faaliyeti
 *     Kapat" ve "Ek Termin İste" yapar (bu uçlar satır sahipliğini ayrıca arar).
 * Düzenleme (PUT/DELETE/alt kayıtlar): fifDuzenleyebilirMi — satır sorumluluğu SAYILMAZ.
 *
 * `.manage` izni ikincil; asıl yönetim kapısı canAccessKalite substring'i (RMA/
 * uygunsuzluk deseni, dokunulmadı).
 */
import type { Session } from 'next-auth'
import { canAccessKalite } from '@/lib/auth/kalite-access'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma'
import { kullaniciKssKoltugundaMi } from '@/lib/quality/fif-zincir'

/**
 * KSS (Kalite Sistem Sorumlusu) kapısı — FİF'E ÖZEL, `canAccessKalite`'a
 * DOKUNMAZ (o kapı RMA/uygunsuzluk ile paylaşılıyor; daraltmak regresyon riski).
 * Kalite kararı: KSS KOLTUK bazlı — kullanıcı KSS koltuklarından birinde oturuyor
 * mu (fif-zincir.FIF_KSS_KOLTUK_KODLARI)? `fif.kss` izni artık KULLANILMAZ.
 * DB'den okunur (koltuk değişikliği anında geçer; JWT izin önbelleği beklenmez).
 * `fif.manage` (Kalite ekibi) KSS yerine GEÇMEZ.
 */
export async function isFifKss(session: Session | null | undefined): Promise<boolean> {
  return kullaniciKssKoltugundaMi(prisma, session?.user?.id)
}

export function canManageFif(session: Session | null | undefined): boolean {
  const u = session?.user
  if (!u) return false
  const perms = u.permissions ?? []
  return perms.includes('fif.manage') || canAccessKalite(u.role, u.department, u.ou)
}

/** Kapsam kararı için gereken minimum kayıt alanları. */
export type FifScopeRecord = {
  /** Verilirse (tekil kontrol) satır sorumluluğu DB'den bakılır — bkz. fifKapsamindaMi. */
  id?: string
  createdById: string | null
  hazirlayanUserId: string | null
  sorumluBolumId: string | null
  yayinlayanBolumId: string | null
}

/** Kullanıcının FİF bağlamı — bir kez hesaplanır, hem where hem tekil kontrolde kullanılır. */
export type FifUserContext = {
  userId: string | null
  isManage: boolean
  /**
   * KSS koltuğu — KSS TÜM FİF'leri GÖRÜR (adımları her formda gelebilir) ama
   * manage yetkisi ALMAZ: başka rollerin onay adımlarını yapamaz. Görünürlük ile
   * yetki bilinçli olarak ayrıldı.
   */
  isKss: boolean
  deptIds: string[]
}

/**
 * SAF kapsam kontrolü (DB'siz — birim test edilebilir). Bir kaydın verilen
 * bağlamda görünür/düzenlenebilir olup olmadığını döner.
 */
export function fifRecordInScope(ctx: FifUserContext, r: FifScopeRecord): boolean {
  if (ctx.isManage || ctx.isKss) return true
  if (!ctx.userId) return false
  if (r.createdById === ctx.userId) return true
  if (r.hazirlayanUserId === ctx.userId) return true
  if (r.sorumluBolumId && ctx.deptIds.includes(r.sorumluBolumId)) return true
  if (r.yayinlayanBolumId && ctx.deptIds.includes(r.yayinlayanBolumId)) return true
  return false
}

/** Kullanıcının bağlı olduğu/sorumlu olduğu DepartmentDefinition id'leri (omurga). */
async function kullaniciBolumIdleri(userId: string): Promise<string[]> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { personnelId: true, personnel: { select: { departmentId: true } } },
  })
  const ids = new Set<string>()
  if (u?.personnel?.departmentId) ids.add(u.personnel.departmentId)
  const pid = u?.personnelId
  if (pid) {
    const sorumlu = await prisma.departmentDefinition.findMany({
      where: {
        OR: [
          { mudurId: pid }, { mudurYardimcisiId: pid },
          { sorumlu1Id: pid }, { sorumlu2Id: pid }, { sorumlu3Id: pid }, { sorumlu4Id: pid },
        ],
      },
      select: { id: true },
    })
    sorumlu.forEach((d) => ids.add(d.id))
  }
  return [...ids]
}

/** Oturum → FİF bağlamı (userId + manage + bölüm id'leri). */
export async function getFifUserContext(session: Session | null | undefined): Promise<FifUserContext> {
  const userId = session?.user?.id ?? null
  const isManage = canManageFif(session)
  const isKss = await isFifKss(session)
  if (!userId || isManage || isKss) return { userId, isManage, isKss, deptIds: [] }
  const deptIds = await kullaniciBolumIdleri(userId)
  return { userId, isManage, isKss, deptIds }
}

/**
 * Liste sorgusu için Prisma where — kapsamı TEK YERDE uygular.
 * manage → {} (tümü) · oturumsuz → eşleşmeyen · diğer → OR(kendi/hazırlayan/bölüm).
 */
export async function fifWhereForUser(session: Session | null | undefined): Promise<Prisma.FifWhereInput> {
  const ctx = await getFifUserContext(session)
  if (ctx.isManage || ctx.isKss) return {}
  if (!ctx.userId) return { id: '__no_access__' } // hiçbir kayda eşleşmez
  const or: Prisma.FifWhereInput[] = [
    { createdById: ctx.userId },
    { hazirlayanUserId: ctx.userId },
    { faaliyetler: { some: { sorumluUserId: ctx.userId } } },
  ]
  if (ctx.deptIds.length) {
    or.push({ sorumluBolumId: { in: ctx.deptIds } })
    or.push({ yayinlayanBolumId: { in: ctx.deptIds } })
  }
  return { OR: or }
}

/**
 * Tekil kayıt DÜZENLENEBİLİR mi (form PUT/DELETE, faaliyet/Ek-1/Ek-2/etkinlik
 * alt kayıtları). Paket 3b-1 öncesi kural: kendi/hazırlayan/bölüm; manage/KSS tümü.
 */
export async function fifDuzenleyebilirMi(
  session: Session | null | undefined,
  r: FifScopeRecord,
): Promise<boolean> {
  return fifRecordInScope(await getFifUserContext(session), r)
}

/**
 * Tekil kayıt GÖRÜNÜR mü (detay sayfası/GET + satır işlemleri kapısı).
 * Düzenleme kapsamı + satır sorumlusu (liste where'iyle AYNI kural).
 */
export async function fifKapsamindaMi(
  session: Session | null | undefined,
  r: FifScopeRecord,
): Promise<boolean> {
  const ctx = await getFifUserContext(session)
  if (fifRecordInScope(ctx, r)) return true
  // Satır sorumlusu (Paket 3): liste where'iyle AYNI kural, tekil kayıtta DB'den.
  if (!ctx.userId || !r.id) return false
  const satir = await prisma.fifFaaliyet.findFirst({ where: { fifId: r.id, sorumluUserId: ctx.userId }, select: { id: true } })
  return !!satir
}
