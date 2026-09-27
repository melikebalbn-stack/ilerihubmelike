import { redirect } from 'next/navigation'
import { ScanLine } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { gecislerimAcikMi } from '@/lib/pdks/gecislerim'
import { GecislerimClient } from '@/components/pdks/GecislerimClient'

export const dynamic = 'force-dynamic'

// PDKS Faz 4 — Geçişlerim: oturum açmış herkes, YALNIZ kendi verisi. pdks_gecislerim_acik=false iken kapalı.
export default async function GecislerimPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')
  const acik = await gecislerimAcikMi()
  return (
    <div className="container mx-auto max-w-md space-y-4 px-4 py-6">
      <h1 className="flex items-center gap-2 text-xl font-bold text-[#1B4F72]"><ScanLine className="h-5 w-5" /> Geçişlerim</h1>
      {acik ? <GecislerimClient /> : <p className="rounded-lg border p-4 text-sm text-slate-600">Geçişlerim ekranı turnike sistemi canlıya geçince açılacak.</p>}
    </div>
  )
}
