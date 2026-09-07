/**
 * RMA/SMA yazma yetkisi (KAL-KYT-16).
 *
 * Okuma: oturumu olan herkes (ayrı izin YOK).
 * Yazma: rma.manage izni VEYA kalite ekibi/admin (canAccessKalite — mevcut helper,
 *   substring mantığına dokunulmadı). qdms.manage ile aynı kitle deseni.
 *
 * session.user.permissions JWT'de mevcut → senkron kontrol (getServerSession sonrası çağrılır).
 */
import type { Session } from 'next-auth'
import { canAccessKalite } from '@/lib/auth/kalite-access'
import { prisma } from '@/lib/prisma'
import { RmaDurum } from '@/generated/prisma'

export function canManageRma(session: Session | null | undefined): boolean {
  const u = session?.user
  if (!u) return false
  const perms = u.permissions ?? []
  return perms.includes('rma.manage') || canAccessKalite(u.role, u.department, u.ou)
}

/**
 * Kayıt düzenleme kipi.
 *   full    → tüm alanlar (canManageRma)
 *   sorumlu → YALNIZ kokNeden + aksiyon (kayda sorumlu atanmış kişi, kayıt AÇIK)
 *   ro      → salt okunur
 *
 * Öncelik: canManageRma her zaman 'full' — kişi aynı zamanda sorumlu olsa bile
 * daraltılmaz. KAPALI kayıtta sorumlu kolu KAPANIR (karar: revizyon paketi #6).
 */
export type RmaMod = 'full' | 'sorumlu' | 'ro'

export function rmaMod(
  session: Session | null | undefined,
  kayit: { sorumluId: string | null; durum: RmaDurum },
  benimPersonnelId: string | null,
): RmaMod {
  if (canManageRma(session)) return 'full'
  // Oturumsuz çağrı asla yazma kipi almaz (çağıranlar requireSession/requireUser
  // sonrası çağırıyor; bu yalnız savunma katmanı).
  if (!session?.user) return 'ro'
  if (
    kayit.durum === RmaDurum.ACIK &&
    kayit.sorumluId !== null &&
    benimPersonnelId !== null &&
    kayit.sorumluId === benimPersonnelId
  ) {
    return 'sorumlu'
  }
  return 'ro'
}

/**
 * Oturum sahibinin Personnel id'si (User.personnelId) — bağlı değilse null.
 * Session'da personnelId YOK, bu yüzden DB'den okunur (emsal: is-analizi/ia-yetki.ts).
 */
export async function benimPersonnelId(userId: string): Promise<string | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { personnelId: true },
  })
  return u?.personnelId ?? null
}
