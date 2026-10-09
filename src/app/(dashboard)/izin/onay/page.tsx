import { redirect } from 'next/navigation'
import { ClipboardCheck } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { baglam, talepAcikMi } from '@/lib/izin/talep-ortak'
import { menuBayragi } from '@/lib/izin/talep-servis'
import { OnayClient } from '@/components/izin/OnayClient'

export const dynamic = 'force-dynamic'

// İzin Faz 3 — Onay Bekleyenler (İzin Onaylarım). Yönetici: kendisine düşen (tür GÖRMEZ); İV: İV kademesi + sahipsiz.
export default async function IzinOnayPage({ searchParams }: { searchParams: Promise<{ sekme?: string }> }) {
  const r = await requireUser()
  if (r.error) redirect('/login')
  const ctx = await baglam(r.user.id)
  const acik = await talepAcikMi()
  const gorur = ctx.ivMi || (acik && (await menuBayragi(r.user.id)).onay)
  if (!gorur) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-lg border bg-white px-6 py-8 text-center text-slate-600">{acik ? 'Onayınıza düşen izin talebi yok.' : 'İzin talebi henüz açılmadı.'}</div>
      </div>
    )
  }
  const { sekme } = await searchParams
  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs text-muted-foreground">İnsan Varlıkları / İzin</p>
        <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold"><ClipboardCheck className="h-5 w-5" />Onay Bekleyenler</h1>
        <p className="mt-1 text-sm text-muted-foreground">Onayına düşen izin taleplerini incele ve karara bağla.{!acik && ' · İzin talebi henüz herkese açık değil — İV deneme görünümü.'}</p>
      </div>
      <OnayClient ivMi={ctx.ivMi} ilkSekme={sekme === 'karar' ? 'karar' : sekme === 'erken' ? 'erken' : 'bekleyen'} />
    </div>
  )
}
