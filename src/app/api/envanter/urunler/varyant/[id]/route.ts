import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { updateVaryant, deleteVaryant } from '@/lib/envanter/service'
import { envanterHataMesaji } from '@/lib/envanter/hata'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.admin')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }
  try {
    const { id } = await params
    const body = await request.json()
    const result = await updateVaryant({
      varyantId: id,
      varyantAdi: body.varyantAdi,
      beden: body.beden,
      numara: body.numara,
        renk: body.renk,
        actorId: session.user.id,
        actorAd: session.user.name || session.user.email || 'Bilinmiyor',
      })
    return NextResponse.json({ ok: true, message: 'Varyant güncellendi.', data: result })
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: envanterHataMesaji(err, 'Varyant güncellenemedi.') },
      { status: 400 },
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.admin')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }
  try {
    const { id } = await params
    const result = await deleteVaryant(
      id,
      session.user.id,
      session.user.name || session.user.email || 'Bilinmiyor',
    )
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: envanterHataMesaji(err, 'Varyant silinemedi.') },
      { status: 400 },
    )
  }
}
