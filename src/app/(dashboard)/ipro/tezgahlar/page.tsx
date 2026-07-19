import { redirect } from 'next/navigation'
import { Factory } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { TezgahlarClient } from '@/components/ipro/yonetim/TezgahlarClient'

export const dynamic = 'force-dynamic'

export default async function IproTezgahlarPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')

  const canView = await hasPermission('ipro.view')
  const canEdit = await hasPermission('ipro.admin')
  if (!canView && !canEdit) redirect('/dashboard')

  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1B4F72]">
          <Factory className="h-6 w-6" />
          Tezgahlar
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          MAS iş merkezleri. Kod ve liste MAS import’undan gelir; buradan ad, IFS eşleşme alanları ve aktiflik yönetilir.
        </p>
      </div>
      <TezgahlarClient canEdit={canEdit} />
    </div>
  )
}
