import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { createTalep, listTalepler, type SatinAlmaDurumTip } from '@/lib/envanter/satinalma'

function kullaniciAdi(user: { name: string | null; firstName?: string | null; lastName?: string | null; email: string }) {
  return user.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.view')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  const durum = request.nextUrl.searchParams.get('durum') as SatinAlmaDurumTip | null

  const data = await listTalepler({ durum: durum || undefined })

  return NextResponse.json({ ok: true, data })
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.admin')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }
  const user = session.user

  try {
    const body = await request.json()

    const talep = await createTalep({
      talepEdenId: user.id,
      talepEdenAd: kullaniciAdi(user),
      bolum: body.bolum,
      masrafYeri: body.masrafYeri,
      asansorMekanik: body.asansorMekanik,
      aciklama: body.aciklama,
      kalemler: Array.isArray(body.kalemler)
        ? body.kalemler.map((k: Record<string, unknown>) => ({
            urunId: k.urunId as string | undefined,
            malzemeKodu: k.malzemeKodu as string | undefined,
            malzemeAdi: String(k.malzemeAdi ?? ''),
            talepMiktar: Number(k.talepMiktar),
            aciklama: k.aciklama as string | undefined,
          }))
        : [],
    })

    return NextResponse.json(
      { ok: true, message: 'Talep oluşturuldu.', data: talep },
      { status: 201 },
    )
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: err instanceof Error ? err.message : 'Talep oluşturulamadı.',
      },
      { status: 400 },
    )
  }
}
