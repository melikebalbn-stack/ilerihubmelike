import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { updateVardiya, gecerliSaat, type VardiyaGirdi } from '@/lib/ipro/takvim'
import { iproHata } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('ipro.admin')
  if (error) return error
  const { id } = await params
  try {
    const b = await request.json()
    const data: Partial<VardiyaGirdi> = {}
    if (b?.kod !== undefined) data.kod = String(b.kod).trim()
    if (b?.ad !== undefined) data.ad = String(b.ad).trim()
    for (const alan of ['baslangicSaat', 'bitisSaat'] as const) {
      if (b?.[alan] !== undefined) {
        if (!gecerliSaat(b[alan])) return NextResponse.json({ ok: false, error: 'Saat formatı HH:mm olmalı' }, { status: 400 })
        data[alan] = String(b[alan])
      }
    }
    if (b?.ertesiGuneTasar !== undefined) data.ertesiGuneTasar = Boolean(b.ertesiGuneTasar)
    if (b?.sira !== undefined) data.sira = Number(b.sira) || 0
    if (b?.aktif !== undefined) data.aktif = Boolean(b.aktif)
    return NextResponse.json({ ok: true, vardiya: await updateVardiya(id, data) })
  } catch (e) {
    return iproHata(e, 'Vardiya güncellenemedi')
  }
}
