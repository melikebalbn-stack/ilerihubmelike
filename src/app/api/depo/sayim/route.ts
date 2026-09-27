import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { raporlar } from '@/lib/ifs/sayim'
import { GUARD, hata } from './_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/depo/sayim → { ok, raporlar } (sayılmamış satırı olan açık sayım raporları). SADECE OKUMA.
export async function GET() {
  const { error } = await requirePermission(GUARD)
  if (error) return error
  try {
    return NextResponse.json({ ok: true, raporlar: await raporlar() })
  } catch (e) {
    return hata(e)
  }
}
