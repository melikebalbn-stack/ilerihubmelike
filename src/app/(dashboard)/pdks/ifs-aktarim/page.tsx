import { redirect } from 'next/navigation'
import { ArrowRightLeft } from 'lucide-react'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { IfsAktarimClient } from '@/components/pdks/IfsAktarimClient'

export const dynamic = 'force-dynamic'

// PDKS → IFS puantaj (devam) aktarımı. Yalnız gün/saat; maaş/ücret YOK. pdks.manage.
export default async function PdksIfsAktarimPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')
  if (!(await hasPermission('pdks.manage'))) return <YetkisizErisim permission="pdks.manage" />
  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-6 py-8">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1B4F72]">
        <ArrowRightLeft className="h-6 w-6" /> IFS Puantaj Aktarımı
      </h1>
      <IfsAktarimClient />
    </div>
  )
}
