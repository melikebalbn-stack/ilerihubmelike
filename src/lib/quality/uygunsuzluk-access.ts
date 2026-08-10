/**
 * Kalite uygunsuzluk (KAL-KYT-15 Bölüm 2) yazma yetkisi.
 *
 * Okuma: oturumu olan herkes (ayrı izin YOK).
 * Yazma: uygunsuzluk.manage izni VEYA kalite ekibi/admin (canAccessKalite — mevcut
 *   helper, substring mantığına dokunulmadı). rma.manage / quality.hatakodu.manage
 *   ile aynı kitle deseni.
 *
 * `uygunsuzluk.manage` izni prod'da MEVCUT (2026-08-10): `perm_uygunsuzluk_manage`,
 *   module `uygunsuzluk`, super-admin + kalite-yoneticisi rollerine bağlı — rma.manage
 *   ile birebir aynı kitle. Yani her iki kol da fiilen çalışıyor.
 *
 * session.user.permissions JWT'de mevcut → senkron kontrol (getServerSession sonrası çağrılır).
 */
import type { Session } from 'next-auth'
import { canAccessKalite } from '@/lib/auth/kalite-access'

export function canManageUygunsuzluk(session: Session | null | undefined): boolean {
  const u = session?.user
  if (!u) return false
  const perms = u.permissions ?? []
  return perms.includes('uygunsuzluk.manage') || canAccessKalite(u.role, u.department, u.ou)
}
