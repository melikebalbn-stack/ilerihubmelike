import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { panoData } from '@/lib/ipro/izleme-service'
import { iproHata } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/ipro/izleme → pano verisinin TAMAMI tek istekte (tezgah kartları +
// gün özeti + IFS kuyruk sağlığı). İstemci 10 sn'de bir poller. SALT OKUMA.
export async function GET() {
  const { error } = await requirePermission(['ipro.view', 'ipro.admin'])
  if (error) return error
  try {
    return NextResponse.json({ ok: true, ...(await panoData()) })
  } catch (e) {
    return iproHata(e, 'Pano verisi alınamadı')
  }
}
