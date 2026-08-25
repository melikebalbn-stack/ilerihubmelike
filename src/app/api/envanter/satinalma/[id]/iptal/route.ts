import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { iptalEt } from '@/lib/envanter/satinalma'
import { envanterHataMesaji } from '@/lib/envanter/hata'

function kullaniciAdi(user: {
  name: string | null
  firstName?: string | null
  lastName?: string | null
  email: string
}) {
  return user.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
}

export async function POST(
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
    const body = await request.json().catch(() => ({}))

    const talep = await iptalEt(
      id,
      { id: session.user.id, ad: kullaniciAdi(session.user) },
      body.sebep,
    )

    return NextResponse.json({ ok: true, message: 'Talep iptal edildi.', data: talep })
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: envanterHataMesaji(err, 'Talep iptal edilemedi.') },
      { status: 400 },
    )
  }
}
