import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import {
  getFifoKirilim,
  getIsEmriBaslik,
  getToplamaListesi,
  normalizeIsEmriNo,
} from '@/lib/ifs/tuketim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/depo/toplama/{orderNo} → iş emri başlığı + toplama listesi + FIFO kırılım.
// Guard: admin.system.manage. SADECE OKUMA.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderNo: string }> },
) {
  const { error } = await requirePermission('admin.system.manage')
  if (error) return error

  const { orderNo: ham } = await params
  const orderNo = normalizeIsEmriNo(decodeURIComponent(ham))

  try {
    const baslik = await getIsEmriBaslik(orderNo)
    if (!baslik) {
      return NextResponse.json(
        { ok: false, error: `İş emri bulunamadı: ${orderNo}` },
        { status: 404 },
      )
    }

    const liste = await getToplamaListesi(baslik.orderNo, baslik.releaseNo, baslik.sequenceNo)

    const satirlar = await Promise.all(
      liste.map(async (s) => {
        const fifo = s.kalan > 0 ? await getFifoKirilim(s.partNo, s.kalan) : []
        return { ...s, fifo, stokYok: s.kalan > 0 && fifo.length === 0 }
      }),
    )

    return NextResponse.json({ ok: true, baslik, satirlar })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'IFS verisi alınamadı'
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
