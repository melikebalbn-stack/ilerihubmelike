import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { canAccessKalite } from '@/lib/auth/kalite-access'
import { YetkisizErisim } from '@/components/YetkisizErisim'

/**
 * /settings erişim guard'ı — root + tüm alt sayfaları kapsar.
 * Koşul middleware.ts /settings dalıyla birebir (rol ∪ Kalite/Laboratuvar dept/ou).
 * ⚠ 6 alt sayfanın kendi SUPER_ADMIN guard'ı KORUNUR — layout üstte geniş, alt sayfa dar:
 *   ADMIN/QUALITY_MANAGER/Kalite-dept root'u görür ama sistem alt sayfalarında yine 403 alır.
 */
export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { session, error } = await requireUser()
  if (error) redirect('/login') // oturumsuz → /login (401 döndürülmez)

  if (!canAccessKalite(session.user.role, session.user.department, session.user.ou)) {
    return <YetkisizErisim />
  }

  return <>{children}</>
}
