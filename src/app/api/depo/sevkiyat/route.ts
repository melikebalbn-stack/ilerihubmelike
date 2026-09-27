import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { sevkiyatlar } from '@/lib/ifs/sevkiyat'
import { GUARD, hata } from './_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/depo/sevkiyat → { ok, sevkiyatlar } (Preliminary, müşteri siparişi kaynaklı). SADECE OKUMA.
export async function GET() {
  const { error } = await requirePermission(GUARD)
  if (error) return error
  try {
    return NextResponse.json({ ok: true, sevkiyatlar: await sevkiyatlar() })
  } catch (e) {
    return hata(e)
  }
}
