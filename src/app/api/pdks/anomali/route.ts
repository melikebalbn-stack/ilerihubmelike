import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { pdksHata } from '@/lib/pdks/cihaz-yonetim'
import { anomaliTara } from '@/lib/pdks/anomali-servis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GUN = /^\d{4}-\d{2}-\d{2}$/

// GET /api/pdks/anomali?bas=YYYY-MM-DD&bit=YYYY-MM-DD — kart paylaşımı/ardışık yön anomalileri. pdks.manage.
export async function GET(req: NextRequest) {
  const { error, user } = await requireUser()
  if (error || !user) return NextResponse.json({ ok: false, error: 'Oturum yok' }, { status: 401 })
  if (!(await hasPermission('pdks.manage'))) return NextResponse.json({ ok: false, error: 'Yetki yok' }, { status: 403 })
  try {
    const bugun = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10)
    const yediOnce = new Date(Date.now() + 3 * 3600_000 - 6 * 86400_000).toISOString().slice(0, 10)
    const bas = GUN.test(req.nextUrl.searchParams.get('bas') ?? '') ? req.nextUrl.searchParams.get('bas')! : yediOnce
    const bit = GUN.test(req.nextUrl.searchParams.get('bit') ?? '') ? req.nextUrl.searchParams.get('bit')! : bugun
    return NextResponse.json({ ok: true, ...(await anomaliTara(bas, bit)) })
  } catch (e) {
    return pdksHata(e, 'Anomaliler alınamadı')
  }
}
