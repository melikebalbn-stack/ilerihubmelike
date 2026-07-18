import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { getSezonParametre, updateSezonParametre } from '@/lib/envanter/sezon'

export async function GET() {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.view')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  const data = await getSezonParametre()

  return NextResponse.json({ ok: true, data })
}

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.admin')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }
  const user = session.user

  try {
    const body = await request.json()

    const parametre = await updateSezonParametre({
      turnoverOrani: Number(body.turnoverOrani),
      emniyetPayiOrani: Number(body.emniyetPayiOrani),
      turnoverKaynak: body.turnoverKaynak || 'MANUEL',
      not: body.not || null,
      updatedById: user.id,
    })

    return NextResponse.json({ ok: true, message: 'Parametreler kaydedildi.', data: parametre })
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : 'Parametreler kaydedilemedi.' },
      { status: 400 },
    )
  }
}
