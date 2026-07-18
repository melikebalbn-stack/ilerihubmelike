import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { teslimAl, type KalemTeslimGirdi } from '@/lib/envanter/satinalma'

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

    const kalemler: KalemTeslimGirdi[] = Array.isArray(body.kalemler)
      ? body.kalemler.map((k: Record<string, unknown>) => ({
          kalemId: String(k.kalemId ?? ''),
          miktar: Number(k.miktar),
        }))
      : []

    if (kalemler.length === 0) {
      throw new Error('En az bir kalem için teslim miktarı girilmelidir.')
    }

    const talep = await teslimAl(id, kalemler, { id: user.id, ad: kullaniciAdi(user) }, body.not)

    return NextResponse.json({ ok: true, message: 'Teslimat işlendi.', data: talep })
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : 'Teslimat işlenemedi.' },
      { status: 400 },
    )
  }
}
