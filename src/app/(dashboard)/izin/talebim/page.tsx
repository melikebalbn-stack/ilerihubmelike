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
export default async function IzinlerimPage({ searchParams }: { searchParams: Promise<{ baslangic?: string }> }) {
  const r = await requireUser()
  if (r.error) redirect('/login')
  const ctx = await baglam(r.user.id)
  const acik = await talepAcikMi()
  if (!acik && !ctx.ivMi) return <Kapali />
  // Geçişlerim › "İzin talebi aç ↗" → ?baslangic=YYYY-MM-DD: form tarihi ön doldurulur
  const { baslangic } = await searchParams
  const ilkBaslangic = baslangic && /^\d{4}-\d{2}-\d{2}$/.test(baslangic) ? baslangic : undefined
  let adinaAcabilir = ctx.ivMi
  if (!adinaAcabilir && ctx.personnelId) {
    const fk = await prisma.personnel.count({ where: { aktif: true, OR: [{ sorumlu1Id: ctx.personnelId }, { sorumlu2Id: ctx.personnelId }, { sorumlu3Id: ctx.personnelId }] } })
    adinaAcabilir = fk > 0 || (await getManagedPersonnelIds(ctx.personnelId)).length > 0
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold"><CalendarDays className="h-5 w-5" />İzinlerim</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            İzin talebi oluştur ve taleplerini takip et.{!acik && ' · İzin talebi henüz herkese açık değil — İV deneme görünümü.'}
          </p>
        </div>
      </div>
      <IzinlerimClient adinaAcabilir={adinaAcabilir} ilkBaslangic={ilkBaslangic} />
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
