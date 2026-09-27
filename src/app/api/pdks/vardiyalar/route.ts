import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { pdksHata } from '@/lib/pdks/cihaz-yonetim'
import { vardiyaEkrani, vardiyaKaydet } from '@/lib/pdks/vardiya-yonetim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET  /api/pdks/vardiyalar — vardiya + mola + aktif atamalar + departmanlar (pdks.manage)
// POST /api/pdks/vardiyalar — yeni vardiya
export async function GET() {
  const { error } = await requirePermission('pdks.manage')
  if (error) return error
  try {
    return NextResponse.json({ ok: true, ...(await vardiyaEkrani()) })
  } catch (e) {
    return pdksHata(e, 'Vardiyalar alınamadı')
  }
}
export async function POST(req: NextRequest) {
  const { error, userId } = await requirePermission('pdks.manage')
  if (error) return error
  try {
    return NextResponse.json({ ok: true, vardiya: await vardiyaKaydet(null, (await req.json()) ?? {}, userId) }, { status: 201 })
  } catch (e) {
    return pdksHata(e, 'Vardiya kaydedilemedi')
  }
}
