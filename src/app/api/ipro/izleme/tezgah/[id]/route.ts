import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { tezgahDetay } from '@/lib/ipro/izleme-service'
import { iproHata } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/ipro/izleme/tezgah/[id] → tek tezgah detayı (kart tıklaması → dialog):
// tezgah bilgisi + aktif iş detayı + bugün kapanan işler. ON-DEMAND — 10 sn poll'a
// GİRMEZ (per-tezgah kapanmış işleri 220 kart için her poll'da çekmek olmaz). SALT OKUMA.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission(['ipro.view', 'ipro.admin'])
  if (error) return error
  try {
    const { id } = await params
    const detay = await tezgahDetay(id)
    if (!detay) return NextResponse.json({ ok: false, error: 'Tezgah bulunamadı' }, { status: 404 })
    return NextResponse.json({ ok: true, ...detay })
  } catch (e) {
    return iproHata(e, 'Tezgah detayı alınamadı')
  }
}
