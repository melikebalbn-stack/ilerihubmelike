import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { canAccessKalite } from '@/lib/auth/kalite-access'
import { YetkisizErisim } from '@/components/YetkisizErisim'

/**
 * /qdms (Kalite Yönetim Sistemi) erişim guard'ı — 9 sayfayı (documents, capa, audits,
 * risks, suppliers, training, changes, ncr, complaints) tek noktadan kapatır.
 * Koşul API guard'ı (qdmsAccessResult) ve menü (canSeeQdms) ile birebir:
 * kalite ekibi/admin (canAccessKalite) VEYA qdms.view permission.
 */
export default async function QdmsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { session, error } = await requireUser()
  if (error) redirect('/login') // oturumsuz → /login (401 döndürülmez)

  const izinli =
    canAccessKalite(session.user.role, session.user.department, session.user.ou) ||
    (await hasPermission('qdms.view'))

  if (!izinli) {
    return <YetkisizErisim permission="qdms.view" />
  }

  return <>{children}</>
}
