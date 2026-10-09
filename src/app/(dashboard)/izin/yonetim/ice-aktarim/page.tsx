import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FileSpreadsheet } from 'lucide-react'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { AcilisClient } from '@/components/izin/AcilisClient'

export const dynamic = 'force-dynamic'

// İzin Faz 2 — açılış bakiyesi içe aktarımı. Deneme izin.admin; gerçek aktarım izin.bakiye.admin
// (canlıya geçiş günü — Melih 27.09). CLI eşdeğeri: scripts/izin/acilis-ice-aktar.ts
export default async function IzinAcilisPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')
  if (!(await hasPermission(['izin.admin', 'izin.bakiye.admin']))) return <YetkisizErisim permission="izin.admin" />
  const canApply = await hasPermission('izin.bakiye.admin')

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs text-muted-foreground">
          İnsan Varlıkları / İzin / <Link href="/izin/yonetim" className="hover:underline">Bakiyeler</Link>
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold">
          <FileSpreadsheet className="h-5 w-5" />
          Açılış bakiyesi içe aktarımı
        </h1>
      </div>
      <AcilisClient canApply={canApply} />
    </div>
  )
}
