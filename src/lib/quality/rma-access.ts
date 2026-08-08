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

export function canManageRma(session: Session | null | undefined): boolean {
  const u = session?.user
  if (!u) return false
  const perms = u.permissions ?? []
  return perms.includes('rma.manage') || canAccessKalite(u.role, u.department, u.ou)
}
