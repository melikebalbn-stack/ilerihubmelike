import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import {
  getYonlendirme,
  updateYonlendirme,
  silYonlendirme,
  type BakimYonlendirmeDurumTip,
} from '@/lib/envanter/bakim-yonlendirme'
import { envanterHataMesaji } from '@/lib/envanter/hata'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.view')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  const { id } = await params
  const data = await getYonlendirme(id)

  if (!data) {
    return NextResponse.json({ ok: false, message: 'Kayıt bulunamadı.' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, data })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.admin')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  const { id } = await params

  try {
    const body = await request.json()

    const guncel = await updateYonlendirme(
      id,
      {
        durum: body.durum as BakimYonlendirmeDurumTip | undefined,
        konu: body.konu as string | undefined,
        lokasyon: body.lokasyon as string | null | undefined,
        aciklama: body.aciklama as string | null | undefined,
        yonlendirilenBirim: body.yonlendirilenBirim as string | undefined,
        servisReferansi: body.servisReferansi as string | null | undefined,
        sonucNotu: body.sonucNotu as string | null | undefined,
      },
      { id: session.user.id, ad: session.user.name || session.user.email || 'Bilinmiyor' },
    )

    return NextResponse.json({ ok: true, message: 'Güncellendi.', data: guncel })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: envanterHataMesaji(err, 'Güncellenemedi.'),
      },
      { status: 400 },
    )
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.admin')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  const { id } = await params

  try {
    await silYonlendirme(
      id,
      session.user.id,
      session.user.name || session.user.email || 'Bilinmiyor',
    )
    return NextResponse.json({ ok: true, message: 'Kayıt silindi.' })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: envanterHataMesaji(err, 'Kayıt silinemedi.'),
      },
      { status: 400 },
    )
  }
}
