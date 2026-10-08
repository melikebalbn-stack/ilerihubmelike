import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { pdksHata } from '@/lib/pdks/cihaz-yonetim'
import { PDKS_AYARLAR, pdksAyarlariOku, pdksAyarlariYaz } from '@/lib/pdks/ayarlar'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/pdks/ayarlar — tanımlar + mevcut değerler. pdks.manage.
export async function GET() {
  const { error, user } = await requireUser()
  if (error || !user) return NextResponse.json({ ok: false, error: 'Oturum yok' }, { status: 401 })
  if (!(await hasPermission('pdks.manage'))) return NextResponse.json({ ok: false, error: 'Yetki yok' }, { status: 403 })
  try {
    return NextResponse.json({ ok: true, tanimlar: PDKS_AYARLAR, degerler: await pdksAyarlariOku() })
  } catch (e) {
    return pdksHata(e, 'Ayarlar okunamadı')
  }
}

// POST /api/pdks/ayarlar { degerler: {key: value} } — pdks.manage.
export async function POST(req: NextRequest) {
  const { error, user } = await requireUser()
  if (error || !user) return NextResponse.json({ ok: false, error: 'Oturum yok' }, { status: 401 })
  if (!(await hasPermission('pdks.manage'))) return NextResponse.json({ ok: false, error: 'Yetki yok' }, { status: 403 })
  try {
    const body = (await req.json().catch(() => ({}))) as { degerler?: Record<string, string> }
    if (!body.degerler || typeof body.degerler !== 'object') {
      return NextResponse.json({ ok: false, error: 'degerler zorunlu' }, { status: 400 })
    }
    const sonuc = await pdksAyarlariYaz(body.degerler)
    return NextResponse.json({ ok: true, ...sonuc, degerler: await pdksAyarlariOku() })
  } catch (e) {
    return pdksHata(e, 'Ayarlar kaydedilemedi')
  }
}
