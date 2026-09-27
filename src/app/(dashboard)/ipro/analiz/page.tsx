import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { BarChart3 } from 'lucide-react'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { AnalizClient } from '@/components/ipro/analiz/AnalizClient'

export const dynamic = 'force-dynamic'

export default async function IproAnalizPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')

  const canView = await hasPermission('ipro.view')
  const canAdmin = await hasPermission('ipro.admin')
  if (!canView && !canAdmin) return <YetkisizErisim permission="ipro.view" />

  return (
    <div className="container mx-auto max-w-[1600px] space-y-4 px-6 py-8">
      <div>
        <div className="text-xs text-slate-500">IPRO Üretim Takip / Analiz</div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1B4F72]">
          <BarChart3 className="h-6 w-6" />
          Üretim Analizi
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Dönem OEE (toplamlardan), trend, duruş/hurda Pareto ve tezgah kırılımı. Varsayılan son 30 gün; salt okuma.
        </p>
      </div>
      <Suspense fallback={<div className="text-sm text-slate-400">Yükleniyor…</div>}>
        <AnalizClient />
      </Suspense>
    </div>
  )
}
