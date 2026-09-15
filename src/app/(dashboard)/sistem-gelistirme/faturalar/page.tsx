import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { canAccessFaturaTakip } from '@/lib/faturalar-access'
import FaturalarClient from './_components/faturalar-client'

export const dynamic = 'force-dynamic'

// Finans → Fatura Takip. Erişim: ADMIN/SUPER_ADMIN rolü VEYA "Sistem Geliştirme"
// departmanı (canAccessFaturaTakip). Aynı kontrol her API ucunda da tekrar edilir.
export default async function FinansFaturalarPage() {
  const { user, error } = await requireUser()
  if (error) redirect('/login')
  if (!canAccessFaturaTakip(user.role, user.department)) {
    return <YetkisizErisim permission="Fatura Takip (Sistem Geliştirme / admin)" />
  }
  return <FaturalarClient />
}
