import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { isKaliteRol } from '@/lib/auth/kalite-access'
import { YetkisizErisim } from '@/components/YetkisizErisim'

/**
 * /fire-safety erişim guard'ı.
 * Koşul middleware.ts /fire-safety dalıyla birebir: rol ∈ {ADMIN, SUPER_ADMIN, QUALITY_MANAGER}.
 * ⚠ Departman istisnası YOK (middleware'de de yok) — saf rol kontrolü.
 */
export default async function FireSafetyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { session, error } = await requireUser()
  if (error) redirect('/login') // oturumsuz → /login (401 döndürülmez)

  if (!isKaliteRol(session.user.role)) {
    return <YetkisizErisim />
  }

  return <>{children}</>
}
