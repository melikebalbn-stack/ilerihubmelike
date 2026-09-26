import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { talepler } from '@/lib/ifs/transfer-talebi'
import { GUARD, hata } from './_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/depo/transfer-talebi → { ok, talepler } (Approved/Prepared). SADECE OKUMA. Terminal talep açmaz.
export async function GET() {
  const { error } = await requirePermission(GUARD)
  if (error) return error
  try {
    return NextResponse.json({ ok: true, talepler: await talepler() })
  } catch (e) {
    return hata(e)
  }
}
