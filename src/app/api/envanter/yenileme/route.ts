import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { hesaplaYenilemeler, type YenilemeDurum } from '@/lib/envanter/yenileme'

const GECERLI_DURUMLAR: YenilemeDurum[] = ['GECIKMIS', 'YAKLASIYOR', 'GUNCEL', 'PERIYOT_YOK']

export async function GET(request: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.view')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  const bolum = request.nextUrl.searchParams.get('bolum') || undefined
  const durumParam = request.nextUrl.searchParams.get('durum')
  const durum =
    durumParam && GECERLI_DURUMLAR.includes(durumParam as YenilemeDurum)
      ? (durumParam as YenilemeDurum)
      : undefined

  const data = await hesaplaYenilemeler({ bolum, durum })

  const ozet = {
    gecikmis: data.filter((s) => s.durum === 'GECIKMIS').length,
    yaklasiyor: data.filter((s) => s.durum === 'YAKLASIYOR').length,
    guncel: data.filter((s) => s.durum === 'GUNCEL').length,
    periyotYok: data.filter((s) => s.durum === 'PERIYOT_YOK').length,
    toplam: data.length,
  }

  return NextResponse.json({ ok: true, data, ozet })
}
