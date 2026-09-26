import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { pdksHata } from '@/lib/pdks/cihaz-yonetim'
import { kartListesi, kartTanimla } from '@/lib/pdks/kart-yonetim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET  /api/pdks/kartlar?durum=AKTIF|PASIF|TUMU&q= — liste + özet + son mutabakat (pdks.view)
// POST /api/pdks/kartlar {personnelId, kartNo} — elle kart tanımla (pdks.manage). Panele
//      doğrudan yazılmaz; senkron işçisi yükler.
export async function GET(req: NextRequest) {
  const { error } = await requirePermission(['pdks.view', 'pdks.manage'])
  if (error) return error
  try {
    const d = req.nextUrl.searchParams.get('durum')
    const durum = d === 'PASIF' || d === 'TUMU' ? d : 'AKTIF'
    return NextResponse.json({ ok: true, ...(await kartListesi({ durum, q: req.nextUrl.searchParams.get('q') ?? '' })) })
  } catch (e) {
    return pdksHata(e, 'Kartlar alınamadı')
  }
}

export async function POST(req: NextRequest) {
  const { error, userId } = await requirePermission('pdks.manage')
  if (error) return error
  try {
    const b = await req.json()
    return NextResponse.json({ ok: true, kart: await kartTanimla(b ?? {}, userId) }, { status: 201 })
  } catch (e) {
    return pdksHata(e, 'Kart tanımlanamadı')
  }
}
