import { redirect } from 'next/navigation'
import { CalendarRange } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { baglam, talepAcikMi } from '@/lib/izin/talep-ortak'
import { takvimGorurMu } from '@/lib/izin/takvim-servis'
import { EkipTakvimiClient } from '@/components/izin/EkipTakvimiClient'

export const dynamic = 'force-dynamic'

// İzin Faz 5 — Ekip Takvimi. Yönetici (kendi ekibi) + İV (izin.admin, tüm departmanlar). Çalışan göremez.
// izin_talep_acik kapalıyken yalnız İV.
export default async function EkipTakvimiPage() {
  const r = await requireUser()
  if (r.error) redirect('/login')
  const ctx = await baglam(r.user.id)
  const gorur = ctx.ivMi || ((await talepAcikMi()) && (await takvimGorurMu(ctx)))
  if (!gorur) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-lg border bg-white px-6 py-8 text-center text-slate-600">Ekip takvimi yalnız yöneticiler ve İnsan Varlıkları içindir.</div>
      </div>
    )
  }
  return (
    <div className="container mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <p className="font-mono text-xs text-slate-500">İnsan Varlıkları / İzin</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-[#1B4F72]"><CalendarRange className="h-6 w-6" />Ekip Takvimi</h1>
      </div>
      <EkipTakvimiClient />
    </div>
  )
}
