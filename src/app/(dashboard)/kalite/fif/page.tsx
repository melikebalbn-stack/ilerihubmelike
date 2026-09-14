import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, ClipboardList } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { Button } from '@/components/ui/button'
import { FifListTable } from '@/components/quality/fif/FifListTable'

export const dynamic = 'force-dynamic'

/**
 * FİF listesi (KAL-FR-10). Okuma: oturumu olan herkes (fif.view). Oturumsuz → /login.
 * "Yeni FİF" oturumu olan herkese görünür (herkes TASLAK açabilir).
 */
export default async function FifListPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[#1B4F72] flex items-center gap-2">
            <ClipboardList className="h-6 w-6" />
            FİF — Faaliyet İstek Formu
          </h1>
          <p className="text-sm text-slate-500 mt-1">Düzeltici/önleyici faaliyet istek ve takibi (KAL-FR-10 Rev 3)</p>
        </div>
        <Button asChild className="bg-[#1B4F72] hover:bg-[#1B4F72]/90 shrink-0">
          <Link href="/kalite/fif/yeni" className="inline-flex items-center gap-1 whitespace-nowrap shrink-0">
            <Plus className="h-4 w-4 shrink-0" />
            Yeni FİF
          </Link>
        </Button>
      </div>
      <FifListTable />
    </div>
  )
}
