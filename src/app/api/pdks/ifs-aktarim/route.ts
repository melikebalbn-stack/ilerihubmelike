import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { pdksHata } from '@/lib/pdks/cihaz-yonetim'
import { aktarimOku, aktarimHesapla, aktarimGonder } from '@/lib/pdks/ifs-puantaj-aktarim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DONEM = /^\d{4}-\d{2}$/
const buAy = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 7)

// GET /api/pdks/ifs-aktarim?donem=YYYY-MM — kaydedilmiş devam özetini okur. pdks.manage.
export async function GET(req: NextRequest) {
  const { error, user } = await requireUser()
  if (error || !user) return NextResponse.json({ ok: false, error: 'Oturum yok' }, { status: 401 })
  if (!(await hasPermission('pdks.manage'))) return NextResponse.json({ ok: false, error: 'Yetki yok' }, { status: 403 })
  try {
    const d = req.nextUrl.searchParams.get('donem')
    const donem = d && DONEM.test(d) ? d : buAy()
    return NextResponse.json({ ok: true, ...(await aktarimOku(donem)) })
  } catch (e) {
    return pdksHata(e, 'Aktarım okunamadı')
  }
}

// POST /api/pdks/ifs-aktarim { aksiyon: 'hesapla' | 'gonder', donem, personnelIds? } — pdks.manage.
export async function POST(req: NextRequest) {
  const { error, user } = await requireUser()
  if (error || !user) return NextResponse.json({ ok: false, error: 'Oturum yok' }, { status: 401 })
  if (!(await hasPermission('pdks.manage'))) return NextResponse.json({ ok: false, error: 'Yetki yok' }, { status: 403 })
  try {
    const body = (await req.json().catch(() => ({}))) as { aksiyon?: string; donem?: string; personnelIds?: string[] }
    const donem = body.donem && DONEM.test(body.donem) ? body.donem : buAy()
    if (body.aksiyon === 'gonder') {
      const ids = Array.isArray(body.personnelIds) && body.personnelIds.length ? body.personnelIds : null
      return NextResponse.json({ ok: true, ...(await aktarimGonder(donem, ids, user.id)) })
    }
    return NextResponse.json({ ok: true, ...(await aktarimHesapla(donem)) })
  } catch (e) {
    return pdksHata(e, 'Aktarım işlenemedi')
  }
}
