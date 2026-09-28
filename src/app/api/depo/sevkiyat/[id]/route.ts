import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { sevkiyatGetir } from '@/lib/ifs/sevkiyat'
import { geriAlinabilirler, okutmalar } from '@/lib/depo/sevkiyat-okutma'
import { GUARD, hata, sevkiyatNo } from '../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/depo/sevkiyat/{id} → { ok, sevkiyat, okutmalar, geriAlinabilir } (IFS satır/rezerv + Hub'daki raporlanmamış
// okutmalar + sevk lokasyonunda toplanmış satırlar ve dönüş hedefleri). SADECE OKUMA.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission(GUARD)
  if (error) return error
  const id = sevkiyatNo((await params).id)
  if (!id) return NextResponse.json({ ok: false, error: 'Geçersiz sevkiyat no' }, { status: 400 })
  try {
    const sevkiyat = await sevkiyatGetir(id)
    if (!sevkiyat) return NextResponse.json({ ok: false, error: `Sevkiyat bulunamadı: ${id}` }, { status: 404 })
    const [bekleyen, geriAlinabilir] = await Promise.all([okutmalar(id), geriAlinabilirler(sevkiyat)])
    return NextResponse.json({ ok: true, sevkiyat, okutmalar: bekleyen, geriAlinabilir })
  } catch (e) {
    return hata(e)
  }
}
