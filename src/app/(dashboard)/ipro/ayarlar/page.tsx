import { redirect } from 'next/navigation'
import { Settings } from 'lucide-react'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { AyarlarClient } from '@/components/ipro/ayarlar/AyarlarClient'

export const dynamic = 'force-dynamic'

export default async function IproAyarlarPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')

  const canView = await hasPermission('ipro.view')
  const canAdmin = await hasPermission('ipro.admin')
  if (!canView && !canAdmin) return <YetkisizErisim permission="ipro.view" />

  return (
    <div className="container mx-auto max-w-[1400px] space-y-4 px-6 py-8">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs text-slate-500">IPRO Üretim Takip / Ayarlar</div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1B4F72]">
            <Settings className="h-6 w-6" />
            IPRO Ayarları
          </h1>
        </div>
        <div className="text-sm text-slate-500">Değişiklikler kaydedildiği anda geçerli olur · deploy gerekmez</div>
      </div>
      <AyarlarClient />
    </div>
  )
}
