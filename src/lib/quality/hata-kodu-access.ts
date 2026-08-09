/**
 * Kalite hata kodu (KAL-KYT-15 Bölüm 1) yazma yetkisi.
 *
 * Okuma: oturumu olan herkes (ayrı izin YOK — hata kodu her modülden seçilir).
 * Yazma: quality.hatakodu.manage izni VEYA kalite ekibi/admin (canAccessKalite).
 *   rma-access.ts ile birebir aynı desen; kitle de aynı (super-admin, kalite-yoneticisi).
 *
 * session.user.permissions JWT'de mevcut → senkron kontrol (requireSession sonrası çağrılır).
 */
import type { Session } from 'next-auth'
import { canAccessKalite } from '@/lib/auth/kalite-access'

export function canManageHataKodu(session: Session | null | undefined): boolean {
  const u = session?.user
  if (!u) return false
  const perms = u.permissions ?? []
  return perms.includes('quality.hatakodu.manage') || canAccessKalite(u.role, u.department, u.ou)
}
