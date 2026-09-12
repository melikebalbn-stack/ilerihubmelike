import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { panoData } from '@/lib/ipro/izleme-service'
import { iproHata } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/ipro/izleme[?oee=1] → pano verisinin TAMAMI tek istekte (tezgah kartları +
// gün özeti + IFS kuyruk sağlığı). oee=1 → her tezgaha canlı OEE bileşenleri eklenir.
// İstemci 10 sn'de bir poller. SALT OKUMA.
export async function GET(req: Request) {
  const { error } = await requirePermission(['ipro.view', 'ipro.admin'])
  if (error) return error
  const oee = new URL(req.url).searchParams.get('oee') === '1'
  try {
    return NextResponse.json({ ok: true, ...(await panoData({ oee })) })
  } catch (e) {
    return iproHata(e, 'Pano verisi alınamadı')
  }
}
