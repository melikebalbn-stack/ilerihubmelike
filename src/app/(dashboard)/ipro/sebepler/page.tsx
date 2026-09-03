import { redirect } from 'next/navigation'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { ClipboardList } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { KapakDonus } from '@/components/ipro/KapakDonus'
import { SebeplerClient } from '@/components/ipro/yonetim/SebeplerClient'

export const dynamic = 'force-dynamic'

export default async function IproSebeplerPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')

  const canView = await hasPermission('ipro.view')
  const canEdit = await hasPermission('ipro.admin')
  if (!canView && !canEdit) return <YetkisizErisim permission="ipro.view" />

  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <KapakDonus />
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1B4F72]">
          <ClipboardList className="h-6 w-6" />
          Hurda / Duruş Sebepleri
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Kiosk ekranında operatörün seçtiği sebep listeleri. Bayrak adları MAS kolon başlıklarıdır.
        </p>
      </div>
      <SebeplerClient canEdit={canEdit} />
    </div>
  )
}
