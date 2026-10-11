import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { pdksHata } from '@/lib/pdks/cihaz-yonetim'
import { sonTanimsizKartlar } from '@/lib/pdks/kart-yonetim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/pdks/kartlar/son-tanimsiz?sn=120 — son N saniyede okutulmuş tanımsız kartlar (pdks.manage).
// "Turnikeye okut → yakala" akışı için; ekran bunu kısa aralıkla poll eder.
export async function GET(req: NextRequest) {
  const { error } = await requirePermission('pdks.manage')
  if (error) return error
  try {
    const sn = Number(req.nextUrl.searchParams.get('sn')) || 120
    return NextResponse.json({ ok: true, okutmalar: await sonTanimsizKartlar(sn) })
  } catch (e) {
    return pdksHata(e, 'Tanımsız kartlar alınamadı')
  }
}
