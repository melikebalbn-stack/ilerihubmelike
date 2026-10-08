import { redirect } from 'next/navigation'
import { Settings } from 'lucide-react'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { AyarlarClient } from '@/components/pdks/AyarlarClient'

export const dynamic = 'force-dynamic'

// PDKS ayarları — pdks_* SystemSetting anahtarlarını ekrandan yönetir. pdks.manage.
export default async function PdksAyarlarPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')
  if (!(await hasPermission('pdks.manage'))) return <YetkisizErisim permission="pdks.manage" />
  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-6 py-8">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1B4F72]">
        <Settings className="h-6 w-6" /> PDKS Ayarları
      </h1>
      <AyarlarClient />
    </div>
  )
}
