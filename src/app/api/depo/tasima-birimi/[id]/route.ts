import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { paletGetir } from '@/lib/ifs/tasima-birimi'
import { GUARD, hata, paletNo } from '../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/depo/tasima-birimi/{id} → { ok, palet } (tür, lokasyon, 0 olmayan içerik). SADECE OKUMA.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission(GUARD)
  if (error) return error
  const id = paletNo((await params).id)
  if (!id) return NextResponse.json({ ok: false, error: 'Geçersiz palet no' }, { status: 400 })
  try {
    const palet = await paletGetir(id)
    if (!palet) return NextResponse.json({ ok: false, error: `Palet bulunamadı: ${id}` }, { status: 404 })
    return NextResponse.json({ ok: true, palet })
  } catch (e) {
    return hata(e)
  }
}
