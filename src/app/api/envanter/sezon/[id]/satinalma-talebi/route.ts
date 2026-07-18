import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { olusturSatinAlmaTalebiFromPlan } from '@/lib/envanter/sezon'

function kullaniciAdi(user: { name: string | null; firstName?: string | null; lastName?: string | null; email: string }) {
  return user.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
}

export async function POST(
  _request: Request,
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

    const talep = await olusturSatinAlmaTalebiFromPlan(id, {
      id: user.id,
      ad: kullaniciAdi(user),
    })

    return NextResponse.json({
      ok: true,
      message: `Satın alma talebi oluşturuldu: ${talep.formNo}`,
      data: talep,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : 'Talep oluşturulamadı.' },
      { status: 400 },
    )
  }
}
