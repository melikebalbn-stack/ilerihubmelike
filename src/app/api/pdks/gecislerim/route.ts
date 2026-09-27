import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { pdksHata } from '@/lib/pdks/cihaz-yonetim'
import { gecislerim, gecislerimAcikMi } from '@/lib/pdks/gecislerim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/pdks/gecislerim — oturum açmış kişinin YALNIZ KENDİ geçiş/puantajı. Başka kişi parametresi YOK.
// pdks_gecislerim_acik != 'true' iken 404 (ekran kapalı).
export async function GET() {
  const { error, user } = await requireUser()
  if (error || !user) return NextResponse.json({ ok: false, error: 'Oturum yok' }, { status: 401 })
  try {
    if (!(await gecislerimAcikMi())) return NextResponse.json({ ok: false, error: 'Geçişlerim henüz açık değil' }, { status: 404 })
    return NextResponse.json({ ok: true, ...(await gecislerim(user.id)) })
  } catch (e) {
    return pdksHata(e, 'Geçişler alınamadı')
  }
}
