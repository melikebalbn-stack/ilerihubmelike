import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { createSezonPlan, listSezonPlan } from '@/lib/envanter/sezon'

export async function GET() {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.view')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  const data = await listSezonPlan()

  return NextResponse.json({ ok: true, data })
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.admin')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  try {
    const body = await request.json()

    const plan = await createSezonPlan({
      ad: body.ad,
      sezonTipi: body.sezonTipi,
      yil: Number(body.yil),
      dagitimTarihi: body.dagitimTarihi ? new Date(body.dagitimTarihi) : undefined,
      siparisKilitTarihi: body.siparisKilitTarihi ? new Date(body.siparisKilitTarihi) : undefined,
      not: body.not,
      planlananAlim:
        body.planlananAlim === '' || body.planlananAlim == null ? null : Number(body.planlananAlim),
      turnoverOrani:
        body.turnoverOrani === '' || body.turnoverOrani == null ? null : Number(body.turnoverOrani),
      emniyetPayiOrani:
        body.emniyetPayiOrani === '' || body.emniyetPayiOrani == null
          ? null
          : Number(body.emniyetPayiOrani),
    })

    return NextResponse.json(
      { ok: true, message: 'Sezon planı oluşturuldu.', data: plan },
      { status: 201 },
    )
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : 'Sezon planı oluşturulamadı.' },
      { status: 400 },
    )
  }
}
