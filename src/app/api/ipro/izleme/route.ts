import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { panoData } from '@/lib/ipro/izleme-service'
import { iproHata } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/ipro/izleme → pano verisinin TAMAMI tek istekte (tezgah kartları + gün özeti +
// IFS kuyruk sağlığı + tezgah başına canlı OEE bileşenleri). VARSAYILAN oee:true (tek görünüm
// künye + OEE); ?oee=0 ile kapatılabilir. İstemci 10 sn'de bir poller. SALT OKUMA.
export async function GET(req: Request) {
  const { error } = await requirePermission(['ipro.view', 'ipro.admin'])
  if (error) return error
  const oee = new URL(req.url).searchParams.get('oee') !== '0'
  try {
    return NextResponse.json({ ok: true, ...(await panoData({ oee })) })
  } catch (e) {
    return iproHata(e, 'Pano verisi alınamadı')
  }
}
