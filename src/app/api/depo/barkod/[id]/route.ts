import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { bulBarkodunStoklari, cozBarkodId } from '@/lib/ifs/barkod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/depo/barkod/{id} → barkod_id çöz + stok satırları. Guard: admin.system.manage.
// SADECE OKUMA. Bulunamadı → 404.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePermission(['depo.terminal.use', 'admin.system.manage'])
  if (error) return error

  const { id: ham } = await params
  const id = Number(decodeURIComponent(ham).trim())
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: `Geçersiz barkod: ${ham}` }, { status: 400 })
  }

  try {
    const kimlik = await cozBarkodId(id)
    if (!kimlik) {
      return NextResponse.json({ ok: false, error: `Barkod bulunamadı: ${id}` }, { status: 404 })
    }
    const stoklar = await bulBarkodunStoklari(kimlik)
    return NextResponse.json({ ok: true, kimlik, stoklar })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'IFS verisi alınamadı'
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
