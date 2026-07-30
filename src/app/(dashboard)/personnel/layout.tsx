import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { canAccessPersonnel } from '@/lib/auth/personnel-access'
import { YetkisizErisim } from '@/components/YetkisizErisim'

/**
 * /personnel erişim guard'ı — alt route'ları da kapsar (reports, department-transfers,
 * leavers, [id] vb.). İstenen: İnsan Varlıkları departmanı VEYA admin rolleri.
 * Koşul middleware.ts /personnel dalıyla birebir (rol ∪ İV-dept).
 */
export default async function PersonnelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { session, error } = await requireUser()
  if (error) redirect('/login') // oturumsuz → /login (401 döndürülmez)

  if (!canAccessPersonnel(session.user.role, session.user.department)) {
    return <YetkisizErisim />
  }

  return <>{children}</>
}
