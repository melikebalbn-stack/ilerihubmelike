import { redirect } from 'next/navigation'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { Gauge } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { KapakDonus } from '@/components/ipro/KapakDonus'
import { OeePanoClient } from '@/components/ipro/oee/OeePanoClient'

export const dynamic = 'force-dynamic'

export default async function IproOeePage() {
  const { error } = await requireUser()
  if (error) redirect('/login')

  const canView = await hasPermission('ipro.view')
  const canAdmin = await hasPermission('ipro.admin')
  if (!canView && !canAdmin) return <YetkisizErisim permission="ipro.view" />

  return (
    <div className="container mx-auto max-w-[1600px] space-y-4 px-6 py-8">
      <div>
        <KapakDonus />
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1B4F72]">
          <Gauge className="h-6 w-6" />
          OEE Pano
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Canlı OEE — açık işlerde Kullanılabilirlik + Performans anlık; tam OEE iş kapanınca hesaplanır.
          10 saniyede bir yenilenir; salt okuma.
        </p>
      </div>
      <OeePanoClient />
    </div>
  )
}
