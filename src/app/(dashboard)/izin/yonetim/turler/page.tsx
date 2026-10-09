import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ListChecks } from 'lucide-react'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { TurlerClient } from '@/components/izin/TurlerClient'

export const dynamic = 'force-dynamic'

// İzin Faz 2 — İzin türleri. Görüntüleme izin.admin / izin.bakiye.admin; şirkete özel tür ekle/düzenle izin.admin.
export default async function IzinTurleriPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')
  if (!(await hasPermission(['izin.admin', 'izin.bakiye.admin']))) return <YetkisizErisim permission="izin.admin" />
  const canManage = await hasPermission('izin.admin')

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs text-muted-foreground">
          İnsan Varlıkları / İzin / <Link href="/izin/yonetim" className="hover:underline">Bakiyeler</Link>
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold">
          <ListChecks className="h-5 w-5" />
          İzin türleri
        </h1>
      </div>
      <TurlerClient canManage={canManage} />
    </div>
  )
}
