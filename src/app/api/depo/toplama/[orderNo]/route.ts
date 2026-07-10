import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import {
  getFifoKirilim,
  getIsEmriBaslik,
  getRezervKirilimSatir,
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
        if (s.kalan <= 0) return { ...s, fifo: [], stokYok: false, kaynakTipi: 'FIFO' as const }
        // Planlama rezervi varsa (QtyAssigned>0) GİT rezerv kırılımından; yoksa FIFO.
        if (s.atanan > 0) {
          const rezerv = await getRezervKirilimSatir({
            orderNo: baslik.orderNo,
            releaseNo: baslik.releaseNo,
            sequenceNo: baslik.sequenceNo,
            lineItemNo: s.lineItemNo,
          })
          if (rezerv.length) return { ...s, fifo: rezerv, stokYok: false, kaynakTipi: 'REZERV' as const }
          // Rezerv okunamadıysa FIFO'ya düş.
        }
        const fifo = await getFifoKirilim(s.partNo, s.kalan)
        return { ...s, fifo, stokYok: fifo.length === 0, kaynakTipi: 'FIFO' as const }
      }),
    )

    return NextResponse.json({ ok: true, baslik, satirlar })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'IFS verisi alınamadı'
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
