import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { sevkiyatGetir } from '@/lib/ifs/sevkiyat'
import { okutmalar } from '@/lib/depo/sevkiyat-okutma'
import { GUARD, hata, sevkiyatNo } from '../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/depo/sevkiyat/{id} → { ok, sevkiyat, okutmalar } (IFS satır/rezerv + Hub'daki raporlanmamış okutmalar). SADECE OKUMA.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission(GUARD)
  if (error) return error
  const id = sevkiyatNo((await params).id)
  if (!id) return NextResponse.json({ ok: false, error: 'Geçersiz sevkiyat no' }, { status: 400 })
  try {
    const sevkiyat = await sevkiyatGetir(id)
    if (!sevkiyat) return NextResponse.json({ ok: false, error: `Sevkiyat bulunamadı: ${id}` }, { status: 404 })
    return NextResponse.json({ ok: true, sevkiyat, okutmalar: await okutmalar(id) })
  } catch (e) {
    return hata(e)
  }
}
