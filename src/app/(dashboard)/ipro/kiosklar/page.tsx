import { redirect } from 'next/navigation'
import { MonitorSmartphone } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { KiosklarClient } from '@/components/ipro/yonetim/KiosklarClient'

export const dynamic = 'force-dynamic'

export default async function IproKiosklarPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')

  const canView = await hasPermission('ipro.view')
  const canEdit = await hasPermission('ipro.admin')
  if (!canView && !canEdit) redirect('/dashboard')

  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1B4F72]">
          <MonitorSmartphone className="h-6 w-6" />
          Kiosk Cihazları
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Atölyedeki üretim terminalleri. Her cihazın kendi giriş kimliği ve bağlı tezgah listesi vardır.
        </p>
      </div>
      <KiosklarClient canEdit={canEdit} />
    </div>
  )
}
