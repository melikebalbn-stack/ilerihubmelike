import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { getDegerListeleri } from '@/lib/ifs/stok-bilgisi'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/depo/stok-bilgisi/listeler → { ok, ambarlar, projeler } (filtre açılır listeleri).
// Guard: depo.terminal.use | admin.system.manage. SADECE OKUMA.
export async function GET() {
  const { error } = await requirePermission(['depo.terminal.use', 'admin.system.manage'])
  if (error) return error
  try {
    return NextResponse.json({ ok: true, ...(await getDegerListeleri()) })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'IFS verisi alınamadı'
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
