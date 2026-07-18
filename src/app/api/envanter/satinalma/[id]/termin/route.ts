import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { terminGir } from '@/lib/envanter/satinalma'

function kullaniciAdi(user: { name: string | null; firstName?: string | null; lastName?: string | null; email: string }) {
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
  const user = session.user

  try {
    const { id } = await params
    const body = await request.json()

    if (!body.tarih) {
      throw new Error('Termin tarihi zorunludur.')
    }

    const tarih = new Date(body.tarih)
    if (Number.isNaN(tarih.getTime())) {
      throw new Error('Termin tarihi geçerli bir tarih olmalıdır.')
    }

    const talep = await terminGir(id, tarih, { id: user.id, ad: kullaniciAdi(user) })

    return NextResponse.json({ ok: true, message: 'Termin tarihi girildi.', data: talep })
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : 'Termin tarihi girilemedi.' },
      { status: 400 },
    )
  }
}
