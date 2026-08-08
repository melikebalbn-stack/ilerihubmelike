import { redirect } from 'next/navigation'
import { CalendarRange } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { YILLIK_TAKVIM_VIEW_PERMISSIONS } from '@/lib/yillik-calisma-takvimi/access'
import { YillikTakvimClient } from './_components/YillikTakvimClient'

export const dynamic = 'force-dynamic'

export default async function YillikCalismaTakvimiPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')

  if (!(await hasPermission([...YILLIK_TAKVIM_VIEW_PERMISSIONS]))) {
    return <YetkisizErisim permission="yilliktakvim.view" />
  }

  return (
    <div className="space-y-6 px-6 py-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1B4F72]">
          <CalendarRange className="h-6 w-6" aria-hidden="true" />
          Yıllık Çalışma Takvimi
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Yıllık planları, sorumluları ve son tarihleri görüntüleyin
        </p>
      </div>
      <YillikTakvimClient />
    </div>
  )
}
