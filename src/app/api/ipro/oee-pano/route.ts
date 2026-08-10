import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { oeePanoData } from '@/lib/ipro/oee-pano-service'
import { iproHata } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/ipro/oee-pano → OEE panosunun TAMAMI tek istekte (tezgah kartları + durum +
// açık iş künyesi + CANLI OEE bileşenleri). İstemci 10 sn'de bir poller. SALT OKUMA.
// Canlı OEE: açık iş now()'a kadar (quality açık işte null → tam OEE iş kapanınca motordan).
export async function GET() {
  const { error } = await requirePermission(['ipro.view', 'ipro.admin'])
  if (error) return error
  try {
    return NextResponse.json({ ok: true, ...(await oeePanoData()) })
  } catch (e) {
    return iproHata(e, 'OEE pano verisi alınamadı')
  }
}
