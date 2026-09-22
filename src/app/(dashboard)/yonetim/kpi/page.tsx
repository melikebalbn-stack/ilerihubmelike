import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { kpiGoruntuleyebilirMi } from '@/lib/yonetim/kpi-yetki'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import KpiClient from './_components/kpi-client'

export const dynamic = 'force-dynamic'

// Yönetim → KPI paneli. Görüntüleme kpi.view ∨ kpi.manage ∨ müdür/müdür-yrd koltuğu
// (kpi-yetki.ts); veri değiştiren uçlar route içinde kpi.manage ∨ koltuk kapsamı ister.
export default async function YonetimKpiPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')

  const canView = await kpiGoruntuleyebilirMi()
  if (!canView) return <YetkisizErisim permission={PERMISSION_KEYS.KPI_VIEW} />

  return <KpiClient />
}
