import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { baglam } from '@/lib/izin/talep-ortak'
import { erkenDonusListesi } from '@/lib/izin/erken-donus'
import { izinHata } from '@/lib/izin/yonetim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/izin/erken-donus — erken dönüş kuyruğu (izin.admin). Otomatik iade YOK; karar İV'de.
export async function GET() {
  const { error, userId } = await requirePermission('izin.admin')
  if (error) return error
  try {
    return NextResponse.json({ ok: true, kayitlar: await erkenDonusListesi(await baglam(userId)) })
  } catch (e) {
    return izinHata(e, 'Erken dönüş kuyruğu alınamadı')
  }
}
