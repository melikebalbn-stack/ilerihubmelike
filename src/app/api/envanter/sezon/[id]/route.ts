import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { getSezonPlanDetay, updateSezonPlanOverride } from '@/lib/envanter/sezon'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.view')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  const { id } = await params
  const plan = await getSezonPlanDetay(id)

  if (!plan) {
    return NextResponse.json({ ok: false, message: 'Sezon planı bulunamadı.' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, data: plan })
}

function parseNullableNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

export async function PATCH(
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
    const body = await request.json()

    const plan = await updateSezonPlanOverride(id, {
      planlananAlim: parseNullableNumber(body.planlananAlim),
      turnoverOrani: parseNullableNumber(body.turnoverOrani),
      emniyetPayiOrani: parseNullableNumber(body.emniyetPayiOrani),
    })

    return NextResponse.json({ ok: true, message: 'Sezon planı güncellendi.', data: plan })
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : 'Sezon planı güncellenemedi.' },
      { status: 400 },
    )
  }
}
