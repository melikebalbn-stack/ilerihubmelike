import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { pdksHata } from '@/lib/pdks/cihaz-yonetim'
import { pdksDashboard } from '@/lib/pdks/dashboard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/pdks/dashboard — yönetim özeti (bugün canlı + ay + 14 gün trend). pdks.view | pdks.manage.
export async function GET() {
  const { error, user } = await requireUser()
  if (error || !user) return NextResponse.json({ ok: false, error: 'Oturum yok' }, { status: 401 })
  if (!(await hasPermission(['pdks.view', 'pdks.manage']))) return NextResponse.json({ ok: false, error: 'Yetki yok' }, { status: 403 })
  try {
    return NextResponse.json({ ok: true, ...(await pdksDashboard(prisma)) })
  } catch (e) {
    return pdksHata(e, 'Dashboard alınamadı')
  }
}
