import { redirect } from 'next/navigation'
import { Wallet } from 'lucide-react'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { BakiyelerClient } from '@/components/izin/BakiyelerClient'

export const dynamic = 'force-dynamic'

// İzin Faz 2 — Bakiyeler (İV). Okuma izin.admin (ya da izin.bakiye.admin); defter düzeltmesi izin.bakiye.admin.
// Guard sidebar ile birebir.
export default async function IzinBakiyelerPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')
  if (!(await hasPermission(['izin.admin', 'izin.bakiye.admin']))) return <YetkisizErisim permission="izin.admin" />
  const canBakiyeAdmin = await hasPermission('izin.bakiye.admin')

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs text-muted-foreground">İnsan Varlıkları / İzin</p>
        <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold">
          <Wallet className="h-5 w-5" />
          Bakiyeler
        </h1>
      </div>
      <BakiyelerClient canBakiyeAdmin={canBakiyeAdmin} canKidem={true} />
    </div>
  )
}
