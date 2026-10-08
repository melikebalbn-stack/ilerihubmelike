import { redirect } from 'next/navigation'
import { ClipboardList } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { FifListTable } from '@/components/quality/fif/FifListTable'
import { YeniFifButton } from '@/components/quality/fif/YeniFifButton'
import { FifKaynakYonet } from '@/components/quality/fif/FifKaynakYonet'
import { fifKaynakYonetebilirMi } from '@/lib/quality/fif-kaynak'

export const dynamic = 'force-dynamic'

/**
 * FİF listesi (KAL-FR-10). Okuma: oturumu olan herkes (fif.view). Oturumsuz → /login.
 * "Yeni FİF" oturumu olan herkese görünür (herkes TASLAK açabilir).
 * "Kaynakları Yönet" yalnız KSS/manage (Paket 3).
 */
export default async function FifListPage() {
  const { session, error } = await requireUser()
  if (error) redirect('/login')

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            FİF — Faaliyet İstek Formu
          </h1>
          <p className="text-sm text-slate-500 mt-1">Düzeltici/önleyici faaliyet istek ve takibi (KAL-FR-10 Rev 3)</p>
        </div>
        <div className="flex items-center gap-2">
          {(await fifKaynakYonetebilirMi(session)) && <FifKaynakYonet />}
          <YeniFifButton />
        </div>
      </div>
      <FifListTable />
    </div>
  )
}
