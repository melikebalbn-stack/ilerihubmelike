import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { kpiGoruntuleyebilirMi } from '@/lib/yonetim/kpi-yetki'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import KpiOzetClient from './_components/kpi-ozet-client'

export const dynamic = 'force-dynamic'

// Yönetim → KPI Özet. Görüntüleme kpi.view ∨ kpi.manage ∨ müdür/müdür-yrd koltuğu (kpi-yetki.ts).
export default async function YonetimKpiOzetPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')

  const canView = await kpiGoruntuleyebilirMi()
  if (!canView) return <YetkisizErisim permission={PERMISSION_KEYS.KPI_VIEW} />

  // Client useSearchParams okuyor (?departman=) — force-dynamic'te prerender yok ama
  // Suspense sınırı Next'in CSR bailout uyarısına karşı ucuz sigorta.
  return (
    <Suspense fallback={null}>
      <KpiOzetClient />
    </Suspense>
  )
}
