import { redirect } from 'next/navigation'
import { ScanLine } from 'lucide-react'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { GecislerClient } from '@/components/pdks/GecislerClient'

export const dynamic = 'force-dynamic'

// PDKS Faz 3 — Geçiş Kayıtları (canlı). pdks.view (veya manage). Guard sidebar ile birebir.
export default async function PdksGecislerPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')
  if (!(await hasPermission(['pdks.view', 'pdks.manage']))) return <YetkisizErisim permission="pdks.view" />
  const canManage = await hasPermission('pdks.manage')

  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-6 py-8">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1B4F72]">
        <ScanLine className="h-6 w-6" />
        Geçiş Kayıtları
      </h1>
      <GecislerClient canManage={canManage} />
    </div>
  )
}
