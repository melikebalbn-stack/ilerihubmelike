import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { geriAl } from '@/lib/depo/geri-al'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/depo/son-islemler/{id}/geri-al → { ok, mesaj } — kendi işlemini geri al (IFS'e YAZAR: ters işlem).
// Kurallar geri-al.ts'de: yalnız kendi · 12 saat · tek sefer (unique) · güncel stok kontrolü · GERI_AL logu.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, userId, error } = await requirePermission(['depo.terminal.use', 'admin.system.manage'])
  if (error) return error
  const id = decodeURIComponent((await params).id).trim()
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return NextResponse.json({ ok: false, error: 'Geçersiz kayıt' }, { status: 400 })
  try {
    const { mesaj } = await geriAl(id, { id: userId, ad: session.user.name ?? 'Operatör' })
    return NextResponse.json({ ok: true, mesaj })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Geri alınamadı' }, { status: 409 })
  }
}
