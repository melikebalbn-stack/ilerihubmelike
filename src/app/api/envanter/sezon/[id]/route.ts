import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { getSezonPlanDetay, updateSezonPlanOverride } from '@/lib/envanter/sezon'
import { logEnvanterIslem } from '@/lib/envanter/service'
import { envanterHataMesaji } from '@/lib/envanter/hata'

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
      { ok: false, message: envanterHataMesaji(err, 'Sezon planı güncellenemedi.') },
      { status: 400 },
    )
  }
}

// Sezon planı silme — kalemleri (envanter_sezon_kalem) cascade ile birlikte silinir.
// Başka hiçbir model plan id'sine referans vermiyor (satın alma talebi ayrı, bağımsız
// bir kayıt olarak oluşturuluyor) — bu yüzden hibrit değil, doğrudan kalıcı silme.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.admin')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  try {
    const { id } = await params
    const plan = await prisma.envanterSezonPlan.findUnique({
      where: { id },
      include: { kalemler: true },
    })
    if (!plan) {
      return NextResponse.json({ ok: false, message: 'Sezon planı bulunamadı.' }, { status: 404 })
    }

    await prisma.envanterSezonPlan.delete({ where: { id } })

    await logEnvanterIslem({
      actorId: session.user.id,
      actorAd: session.user.name || session.user.email || 'Bilinmiyor',
      islemTipi: 'SEZON_PLANI_SIL',
      hedefTip: 'EnvanterSezonPlan',
      hedefId: id,
      detay: {
        ad: plan.ad,
        yil: plan.yil,
        kalemSayisi: plan.kalemler.length,
        aktorAd: session.user.name || session.user.email,
      },
    })

    return NextResponse.json({
      ok: true,
      message: `Sezon planı silindi${plan.kalemler.length > 0 ? ` (${plan.kalemler.length} kalem dahil)` : ''}.`,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: envanterHataMesaji(err, 'Sezon planı silinemedi.') },
      { status: 400 },
    )
  }
}
