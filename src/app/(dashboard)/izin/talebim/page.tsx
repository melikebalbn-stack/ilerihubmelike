import { redirect } from 'next/navigation'
import { CalendarDays } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { prisma } from '@/lib/prisma'
import { getManagedPersonnelIds } from '@/lib/onay/yonetici-cozumu'
import { baglam, talepAcikMi } from '@/lib/izin/talep-ortak'
import { IzinlerimClient } from '@/components/izin/IzinlerimClient'

export const dynamic = 'force-dynamic'

// İzin Faz 3 — İzinlerim (herkes, yalnız kendi; responsive — telefonda tek sütun). "Adına" talep: İV herkes,
// yönetici kendi ekibi. izin_talep_acik kapalıyken yalnız İV (deneme) girer.
export default async function IzinlerimPage() {
  const r = await requireUser()
  if (r.error) redirect('/login')
  const ctx = await baglam(r.user.id)
  const acik = await talepAcikMi()
  if (!acik && !ctx.ivMi) return <Kapali />
  let adinaAcabilir = ctx.ivMi
  if (!adinaAcabilir && ctx.personnelId) {
    const fk = await prisma.personnel.count({ where: { aktif: true, OR: [{ sorumlu1Id: ctx.personnelId }, { sorumlu2Id: ctx.personnelId }, { sorumlu3Id: ctx.personnelId }] } })
    adinaAcabilir = fk > 0 || (await getManagedPersonnelIds(ctx.personnelId)).length > 0
  }
  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <p className="font-mono text-xs text-slate-500">İnsan Varlıkları / İzin</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-[#1B4F72]"><CalendarDays className="h-6 w-6" />İzinlerim</h1>
        {!acik && <p className="mt-1 text-sm text-amber-700">İzin talebi henüz herkese açık değil — İV deneme görünümü.</p>}
      </div>
      <IzinlerimClient adinaAcabilir={adinaAcabilir} />
    </div>
  )
}

function Kapali() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-lg border bg-white px-6 py-8 text-center text-slate-600">İzin talebi henüz açılmadı. Şimdilik İnsan Varlıkları&apos;na başvurun.</div>
    </div>
  )
}
