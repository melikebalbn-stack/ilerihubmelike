import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { onayAksiyon, type SatinAlmaAksiyonTip } from '@/lib/envanter/satinalma'

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

    const aksiyon = body.aksiyon as SatinAlmaAksiyonTip
    if (!['ONAYLA', 'REDDET', 'REVIZE'].includes(aksiyon)) {
      throw new Error('Geçersiz aksiyon.')
    }

    const talep = await onayAksiyon(
      id,
      aksiyon,
      { id: user.id, ad: kullaniciAdi(user) },
      {
        not: body.not,
        redSebebi: body.redSebebi,
        uygunMiktarlar: body.uygunMiktarlar,
        ilerlet: Boolean(body.ilerlet),
      },
    )

    return NextResponse.json({ ok: true, message: 'İşlem uygulandı.', data: talep })
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : 'İşlem uygulanamadı.' },
      { status: 400 },
    )
  }
}
