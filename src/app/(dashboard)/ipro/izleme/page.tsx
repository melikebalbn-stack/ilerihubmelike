import { redirect } from 'next/navigation'
import { Activity } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { IzlemeClient } from '@/components/ipro/izleme/IzlemeClient'

export const dynamic = 'force-dynamic'

export default async function IproIzlemePage() {
  const { error } = await requireUser()
  if (error) redirect('/login')

  const canView = await hasPermission('ipro.view')
  const canAdmin = await hasPermission('ipro.admin')
  if (!canView && !canAdmin) redirect('/dashboard')

  return (
    <div className="container mx-auto max-w-[1600px] space-y-4 px-6 py-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1B4F72]">
          <Activity className="h-6 w-6" />
          İzleme Panosu
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Tezgahlarda kim çalışıyor, hangi iş, ne zamandır. 10 saniyede bir yenilenir; salt okuma.
        </p>
      </div>
      <IzlemeClient />
    </div>
  )
}
