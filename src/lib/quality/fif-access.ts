/**
 * FİF (Faaliyet İstek Formu, KAL-FR-10) yetkisi.
 *
 * Okuma (fif.view): oturumu olan herkes — kendi açtığı / kendi bölümüne düşen
 *   formları görür. (Liste API'si Faz 1'de tümünü döndürür; kapsam daraltma
 *   Faz 2'de eklenecek — açık nokta.)
 * Yönetim (fif.manage): Kalite ekibi/admin (canAccessKalite) VEYA fif.manage
 *   izni. rma.manage / uygunsuzluk.manage ile aynı kitle deseni: .manage izni
 *   ikincil, asıl kapı canAccessKalite substring'i (dokunulmadı).
 */
import type { Session } from 'next-auth'
import { canAccessKalite } from '@/lib/auth/kalite-access'

export function canManageFif(session: Session | null | undefined): boolean {
  const u = session?.user
  if (!u) return false
  const perms = u.permissions ?? []
  return perms.includes('fif.manage') || canAccessKalite(u.role, u.department, u.ou)
}
