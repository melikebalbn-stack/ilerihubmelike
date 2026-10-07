import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { pdksHata } from '@/lib/pdks/cihaz-yonetim'
import { iceridekiler } from '@/lib/pdks/mevcudiyet'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/pdks/iceride?saat=18 — şu an binada olanlar (son hareketi giriş). pdks.view | pdks.manage.
export async function GET(req: NextRequest) {
  const { error, user } = await requireUser()
  if (error || !user) return NextResponse.json({ ok: false, error: 'Oturum yok' }, { status: 401 })
  if (!(await hasPermission(['pdks.view', 'pdks.manage']))) return NextResponse.json({ ok: false, error: 'Yetki yok' }, { status: 403 })
  try {
    const s = Number(req.nextUrl.searchParams.get('saat'))
    const pencere = Number.isFinite(s) && s >= 1 && s <= 48 ? s : 18
    return NextResponse.json({ ok: true, ...(await iceridekiler(pencere)) })
  } catch (e) {
    return pdksHata(e, 'Mevcudiyet alınamadı')
  }
}
