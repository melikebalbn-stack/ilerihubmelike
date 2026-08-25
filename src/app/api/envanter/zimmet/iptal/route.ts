import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { iptalZimmet } from '@/lib/envanter/service'
import { envanterHataMesaji } from '@/lib/envanter/hata'

export async function POST(request: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.admin')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }
  const user = session.user

  try {
    const body = await request.json()
    const result = await iptalZimmet(
      body.zimmetId,
      user.id,
      body.sebep,
      user.name || user.email || 'Bilinmiyor',
    )

    return NextResponse.json({
      ok: true,
      message: 'Zimmet kaydı iptal edildi.',
      data: result,
    })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: envanterHataMesaji(err, 'Zimmet iptal edilemedi.'),
      },
      { status: 400 },
    )
  }
}
