import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import {
  createYonlendirme,
  listYonlendirmeler,
  type BakimYonlendirmeDurumTip,
} from '@/lib/envanter/bakim-yonlendirme'
import { envanterHataMesaji } from '@/lib/envanter/hata'

export async function GET(request: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.view')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  const durum = request.nextUrl.searchParams.get('durum') as BakimYonlendirmeDurumTip | null

  const data = await listYonlendirmeler({ durum: durum || undefined })

  return NextResponse.json({ ok: true, data })
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.admin')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  try {
    const body = await request.json()

    const kayit = await createYonlendirme({
      tespitEdenId: session.user.id,
      tespitEdenAd: session.user.name || session.user.email || 'Bilinmiyor',
      konu: String(body.konu ?? ''),
      lokasyon: body.lokasyon as string | undefined,
      aciklama: body.aciklama as string | undefined,
      yonlendirilenBirim: body.yonlendirilenBirim as string | undefined,
    })

    return NextResponse.json(
      { ok: true, message: 'Kayıt oluşturuldu.', data: kayit },
      { status: 201 },
    )
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: envanterHataMesaji(err, 'Kayıt oluşturulamadı.'),
      },
      { status: 400 },
    )
  }
}
