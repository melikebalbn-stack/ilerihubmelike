import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { pdksHata } from '@/lib/pdks/cihaz-yonetim'
import { personelAdaylari } from '@/lib/pdks/kart-yonetim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/pdks/kartlar/personel-aday?q= — kart tanımlanabilecek AKTİF personel, kartsızlar üstte (pdks.manage)
export async function GET(req: NextRequest) {
  const { error } = await requirePermission('pdks.manage')
  if (error) return error
  try {
    return NextResponse.json({ ok: true, personeller: await personelAdaylari(req.nextUrl.searchParams.get('q') ?? '') })
  } catch (e) {
    return pdksHata(e, 'Personel listesi alınamadı')
  }
}
