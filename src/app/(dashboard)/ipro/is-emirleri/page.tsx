import { redirect } from 'next/navigation'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { ClipboardList } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { KapakDonus } from '@/components/ipro/KapakDonus'
import { IsEmirleriClient } from './_client'

export const dynamic = 'force-dynamic'

export default async function IproIsEmirleriPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')

  const canView = await hasPermission('ipro.view')
  const canAdmin = await hasPermission('ipro.admin')
  if (!canView && !canAdmin) return <YetkisizErisim permission="ipro.view" />

  // "Syteline'dan aktar" butonu: ipro.admin VEYA entegrasyon.syteline.
  const aktarYetkisi = canAdmin || (await hasPermission('entegrasyon.syteline'))

  return (
    <div className="container mx-auto max-w-[1600px] space-y-4 px-6 py-8">
      <div>
        <KapakDonus />
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1B4F72]">
          <ClipboardList className="h-6 w-6" />
          İş Emirleri
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Açık iş emirleri IFS&apos;ten canlı; iş geçmişi ILERIHub kayıtlarından. Salt okuma.
        </p>
      </div>
      <IsEmirleriClient aktarYetkisi={aktarYetkisi} />
    </div>
  )
}
