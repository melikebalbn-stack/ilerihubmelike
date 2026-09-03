import { redirect } from 'next/navigation'
import { CalendarDays } from 'lucide-react'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { KapakDonus } from '@/components/ipro/KapakDonus'
import { TakvimClient } from '@/components/ipro/yonetim/TakvimClient'

export const dynamic = 'force-dynamic'

export default async function IproTakvimPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')

  const canView = await hasPermission(['ipro.view', 'ipro.admin', 'ipro.takvim.yonet'])
  if (!canView) return <YetkisizErisim permission="ipro.view" />

  const canEditVardiya = await hasPermission('ipro.admin')
  const canEditTakvim = await hasPermission('ipro.takvim.yonet')

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div>
        <KapakDonus />
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1B4F72]">
          <CalendarDays className="h-6 w-6" />
          Vardiya &amp; Çalışma Takvimi
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Vardiya tanımları ve İK çalışma takvimi (resmi tatil, yarım gün, çalışılan cumartesi).
          Pazar otomatik tatildir — takvimde gri gösterilir, kayıt gerektirmez.
        </p>
      </div>
      <TakvimClient canEditVardiya={canEditVardiya} canEditTakvim={canEditTakvim} />
    </div>
  )
}
