import { redirect } from 'next/navigation'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { ClipboardList } from 'lucide-react'
import { PuantajClient } from '@/components/pdks/PuantajClient'

export const dynamic = 'force-dynamic'

// PDKS Faz 4 — Günlük Puantaj. pdks.view (veya manage); yeniden hesapla / kilit pdks.manage.
export default async function PdksPuantajPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')
  if (!(await hasPermission(['pdks.view', 'pdks.manage']))) return <YetkisizErisim permission="pdks.view" />
  const canManage = await hasPermission('pdks.manage')
  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-6 py-8">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1B4F72]"><ClipboardList className="h-6 w-6" /> Günlük Puantaj</h1>
      <PuantajClient canManage={canManage} />
    </div>
  )
}
