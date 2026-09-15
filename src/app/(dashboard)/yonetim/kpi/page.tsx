import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import KpiClient from './_components/kpi-client'

export const dynamic = 'force-dynamic'

// Yönetim → KPI paneli. Görüntüleme kpi.view VEYA kpi.manage ile açılır;
// veri değiştiren uçlar ayrıca route içinde kpi.manage ister.
export default async function YonetimKpiPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')

  const canView = await hasPermission([PERMISSION_KEYS.KPI_VIEW, PERMISSION_KEYS.KPI_MANAGE])
  if (!canView) return <YetkisizErisim permission={PERMISSION_KEYS.KPI_VIEW} />

  return <KpiClient />
}
