import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import KpiOzetClient from './_components/kpi-ozet-client'

export const dynamic = 'force-dynamic'

// Yönetim → KPI Özet. Görüntüleme kpi.view VEYA kpi.manage ile açılır.
export default async function YonetimKpiOzetPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')

  const canView = await hasPermission([PERMISSION_KEYS.KPI_VIEW, PERMISSION_KEYS.KPI_MANAGE])
  if (!canView) return <YetkisizErisim permission={PERMISSION_KEYS.KPI_VIEW} />

  return <KpiOzetClient />
}
