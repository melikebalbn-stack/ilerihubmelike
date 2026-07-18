import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { iadeZimmet } from '@/lib/envanter/service'

export async function POST(request: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.admin')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }
  const user = session.user

  try {
    const body = await request.json()

    const result = await iadeZimmet({
      zimmetId: body.zimmetId,
      iadeMiktar: Number(body.iadeMiktar),
      aciklama: body.aciklama,
      createdById: user.id,
    })

    return NextResponse.json({
      ok: true,
      message: 'İade alındı.',
      data: result,
    })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: err instanceof Error ? err.message : 'İade alınamadı.',
      },
      { status: 400 },
    )
  }
}
