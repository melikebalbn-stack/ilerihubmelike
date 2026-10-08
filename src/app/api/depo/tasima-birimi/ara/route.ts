import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { paletAra } from '@/lib/ifs/tasima-birimi'
import { GUARD, hata } from '../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/depo/tasima-birimi/ara?q= → { ok, sonuclar } palet/kutu arama (no, tür kodu, SSCC, alt etiket, lokasyon). SADECE OKUMA.
export async function GET(request: Request) {
  const { error } = await requirePermission(GUARD)
  if (error) return error
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (!q) return NextResponse.json({ ok: false, error: 'Arama metni gerekli' }, { status: 400 })
  try {
    return NextResponse.json({ ok: true, sonuclar: await paletAra(q) })
  } catch (e) {
    return hata(e)
  }
}
