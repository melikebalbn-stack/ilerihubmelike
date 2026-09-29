import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { rafOnerisi } from '@/lib/ifs/depo-stok'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/depo/raf-oneri?partNo=X[&kaynak=LOK] → { ok, oneri: RafOnerisi | null } — Stok Taşıma hedef raf önerisi
// (son giriş lokasyonu, kaynak hariç → IFS varsayılan lokasyonu). SADECE OKUMA. Hata → 502; istemci öneriyi gizler.
export async function GET(request: Request) {
  const { error } = await requirePermission(['depo.terminal.use', 'admin.system.manage'])
  if (error) return error
  const sp = new URL(request.url).searchParams
  const partNo = sp.get('partNo')?.trim()
  if (!partNo) return NextResponse.json({ ok: false, error: 'partNo gerekli' }, { status: 400 })
  try {
    return NextResponse.json({ ok: true, oneri: await rafOnerisi(partNo, sp.get('kaynak')?.trim() || undefined) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Öneri alınamadı' }, { status: 502 })
  }
}
