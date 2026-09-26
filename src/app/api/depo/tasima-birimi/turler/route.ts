import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { paletTurleri } from '@/lib/ifs/tasima-birimi'
import { GUARD, hata } from '../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/depo/tasima-birimi/turler → { ok, turler } (PALLET önce). SADECE OKUMA.
export async function GET() {
  const { error } = await requirePermission(GUARD)
  if (error) return error
  try {
    return NextResponse.json({ ok: true, turler: await paletTurleri() })
  } catch (e) {
    return hata(e)
  }
}
