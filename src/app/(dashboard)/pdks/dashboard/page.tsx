import { redirect } from 'next/navigation'
import { LayoutDashboard } from 'lucide-react'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { DashboardClient } from '@/components/pdks/DashboardClient'

export const dynamic = 'force-dynamic'

// PDKS Faz 4 — Yönetim dashboard (bugün + ay + 14 gün trend). pdks.view | pdks.manage.
export default async function PdksDashboardPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')
  if (!(await hasPermission(['pdks.view', 'pdks.manage']))) return <YetkisizErisim permission="pdks.view" />
  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-6 py-8">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1B4F72]"><LayoutDashboard className="h-6 w-6" /> PDKS Panosu</h1>
      <DashboardClient />
    </div>
  )
}
