import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { kpiYetkisiCoz } from '@/lib/yonetim/kpi-yetki'

export const dynamic = 'force-dynamic'

// GET /api/yonetim/kpi/yetki — Sidebar menü bayrağı + KPI istemcisinin düzenleme
// kontrolleri için SUNUCUDA çözülen yetki özeti (kadro-talep/menu-bayrak deseni).
// Oturum yoksa 401 → Sidebar bayrağı false kalır. Görüntüleme yetkisi olmayan
// kullanıcıya da 200 + goruntule:false döner (menü kalemi gizli).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Yetkisiz: oturum bulunamadı' }, { status: 401 })
  return NextResponse.json(await kpiYetkisiCoz(session.user.id))
}
