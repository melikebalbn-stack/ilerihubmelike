import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { getRafBilgisi } from '@/lib/ifs/depo-stok'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/depo/raf/{kod} → raf bilgisi (kod = LocationNo veya Description). 404 if yok.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kod: string }> },
) {
  const { error } = await requirePermission(['depo.terminal.use', 'admin.system.manage'])
  if (error) return error

  const { kod } = await params
  try {
    const raf = await getRafBilgisi(decodeURIComponent(kod))
    if (!raf) {
      return NextResponse.json({ ok: false, error: 'Raf bulunamadı' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, raf })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'IFS verisi alınamadı'
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
