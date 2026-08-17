import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { getIslemKaydi } from '@/lib/envanter/sarf-tuketim'

export async function GET(request: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.admin')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }
  const baslangic = request.nextUrl.searchParams.get('baslangic') || undefined
  const bitis = request.nextUrl.searchParams.get('bitis') || undefined
  const islemTipi = request.nextUrl.searchParams.get('islemTipi') || undefined
  const hedefTip = request.nextUrl.searchParams.get('hedefTip') || undefined
  const data = await getIslemKaydi({ baslangic, bitis, islemTipi, hedefTip })
  return NextResponse.json({ ok: true, data })
}
