import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { getEnvanterUrunDetail } from '@/lib/envanter/service'

const GECERLI_BEDEN_TIPLERI = ['YOK', 'UST', 'ALT', 'AYAKKABI', 'ELDIVEN']

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.view')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }
  try {
    const { id } = await params
    const urun = await getEnvanterUrunDetail(id)

    if (!urun) {
      return NextResponse.json(
        { ok: false, message: 'Ürün bulunamadı.' },
        { status: 404 },
      )
    }

    return NextResponse.json({
      ok: true,
      data: urun,
    })
  } catch (error) {
    console.error('Ürün detay API hatası:', error)

    return NextResponse.json(
      { ok: false, message: 'Ürün detayı alınamadı.' },
      { status: 500 },
    )
  }
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

    if (!GECERLI_BEDEN_TIPLERI.includes(body.bedenTipi)) {
      throw new Error(
        `"${body.bedenTipi}" geçerli bir beden tipi değil. Geçerli değerler: ${GECERLI_BEDEN_TIPLERI.join(', ')}`,
      )
    }

    const urun = await prisma.envanterUrun.update({
      where: { id },
      data: { bedenTipi: body.bedenTipi as never },
    })

    return NextResponse.json({ ok: true, message: 'Beden tipi güncellendi.', data: urun })
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : 'Beden tipi güncellenemedi.' },
      { status: 400 },
    )
  }
}
