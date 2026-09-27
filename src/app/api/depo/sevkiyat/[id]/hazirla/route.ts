import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { logDepoHareket } from '@/lib/depo/hareket-log'
import { hazirla } from '@/lib/ifs/sevkiyat'
import { GUARD, hata, sevkiyatNo } from '../../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/depo/sevkiyat/{id}/hazirla → gerekirse rezerv + toplama listesi. IFS'e YAZAR (yalnız bir şey yapıldıysa log).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, userId, error } = await requirePermission(GUARD)
  if (error) return error
  const id = sevkiyatNo((await params).id)
  if (!id) return NextResponse.json({ ok: false, error: 'Geçersiz sevkiyat no' }, { status: 400 })
  try {
    const sonuc = await hazirla(id)
    if (sonuc.rezervYapildi || sonuc.listeYapildi) {
      await logDepoHareket({
        olay: 'SEVKIYAT_HAZIRLA',
        userId,
        kullaniciAd: session.user.name ?? 'Operatör',
        partNo: '-',
        orderNo: String(id),
        detay: sonuc,
      })
    }
    return NextResponse.json({ ok: true, ...sonuc })
  } catch (e) {
    return hata(e)
  }
}
