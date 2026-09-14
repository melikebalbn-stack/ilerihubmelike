/**
 * FİF (Faaliyet İstek Formu, KAL-FR-10) yetki + kapsam — TEK KAYNAK.
 *
 * Oluşturma: oturumu olan HERKES yeni FİF (TASLAK) açabilir.
 * Görme/düzenleme kapsamı:
 *   - canManageFif (Kalite ekibi/admin VEYA fif.manage) → TÜMÜ.
 *   - diğerleri → kendi açtığı (createdById) / hazırlayan olduğu (hazirlayanUserId)
 *     / sorumlu-yayınlayan bölümü kendi bölümü olan (Personnel.departmentId + omurgada
 *     sorumlu/müdür olduğu bölümler) kayıtlar.
 *
 * `.manage` izni ikincil; asıl yönetim kapısı canAccessKalite substring'i (RMA/
 * uygunsuzluk deseni, dokunulmadı).
 */
import type { Session } from 'next-auth'
import { canAccessKalite } from '@/lib/auth/kalite-access'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma'

export function canManageFif(session: Session | null | undefined): boolean {
  const u = session?.user
  if (!u) return false
  const perms = u.permissions ?? []
  return perms.includes('fif.manage') || canAccessKalite(u.role, u.department, u.ou)
}

/** Kapsam kararı için gereken minimum kayıt alanları. */
export type FifScopeRecord = {
  createdById: string | null
  hazirlayanUserId: string | null
  sorumluBolumId: string | null
  yayinlayanBolumId: string | null
}

/** Kullanıcının FİF bağlamı — bir kez hesaplanır, hem where hem tekil kontrolde kullanılır. */
export type FifUserContext = {
  userId: string | null
  isManage: boolean
  deptIds: string[]
}

/**
 * SAF kapsam kontrolü (DB'siz — birim test edilebilir). Bir kaydın verilen
 * bağlamda görünür/düzenlenebilir olup olmadığını döner.
 */
export function fifRecordInScope(ctx: FifUserContext, r: FifScopeRecord): boolean {
  if (ctx.isManage) return true
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
  if (!userId || isManage) return { userId, isManage, deptIds: [] }
  const deptIds = await kullaniciBolumIdleri(userId)
  return { userId, isManage, deptIds }
}

/**
 * Liste sorgusu için Prisma where — kapsamı TEK YERDE uygular.
 * manage → {} (tümü) · oturumsuz → eşleşmeyen · diğer → OR(kendi/hazırlayan/bölüm).
 */
export async function fifWhereForUser(session: Session | null | undefined): Promise<Prisma.FifWhereInput> {
  const ctx = await getFifUserContext(session)
  if (ctx.isManage) return {}
  if (!ctx.userId) return { id: '__no_access__' } // hiçbir kayda eşleşmez
  const or: Prisma.FifWhereInput[] = [
    { createdById: ctx.userId },
    { hazirlayanUserId: ctx.userId },
  ]
  if (ctx.deptIds.length) {
    or.push({ sorumluBolumId: { in: ctx.deptIds } })
    or.push({ yayinlayanBolumId: { in: ctx.deptIds } })
  }
  return { OR: or }
}

/** Tekil kayıt görünür/düzenlenebilir mi (detay/PUT/DELETE için). */
export async function fifKapsamindaMi(
  session: Session | null | undefined,
  r: FifScopeRecord,
): Promise<boolean> {
  const ctx = await getFifUserContext(session)
  return fifRecordInScope(ctx, r)
}
