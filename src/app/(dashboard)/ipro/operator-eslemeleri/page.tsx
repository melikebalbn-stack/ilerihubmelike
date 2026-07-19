import { redirect } from 'next/navigation'
import { Users } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { OperatorEslemeleriClient } from '@/components/ipro/yonetim/OperatorEslemeleriClient'

export const dynamic = 'force-dynamic'

export default async function IproOperatorEslemeleriPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')

  const canView = await hasPermission('ipro.view')
  const canEdit = await hasPermission('ipro.admin')
  if (!canView && !canEdit) redirect('/dashboard')

  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1B4F72]">
          <Users className="h-6 w-6" />
          Operatör Eşlemeleri
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Hangi personelin hangi tezgahta çalışabileceği. Kiosk operatör listesi ve IFS personel senkronunun aday
          kümesi bu eşlemelerden gelir.
        </p>
      </div>
      <OperatorEslemeleriClient canEdit={canEdit} />
    </div>
  )
}
