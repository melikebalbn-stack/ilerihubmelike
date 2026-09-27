import { redirect } from 'next/navigation'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { Clock } from 'lucide-react'
import { VardiyalarClient } from '@/components/pdks/VardiyalarClient'

export const dynamic = 'force-dynamic'

// PDKS Faz 4 — vardiya + mola tanımları ve personel ataması (pdks.manage).
export default async function PdksVardiyalarPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')
  if (!(await hasPermission('pdks.manage'))) return <YetkisizErisim permission="pdks.manage" />
  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-6 py-8">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1B4F72]"><Clock className="h-6 w-6" /> Vardiyalar</h1>
      <VardiyalarClient />
    </div>
  )
}
