import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import {
  createEnvanterUrun,
  listEnvanterUrunler,
} from '@/lib/envanter/service'
import type { EnvanterUrunForm } from '@/types/envanter'

export async function GET() {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.view')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }
  try {
    const data = await listEnvanterUrunler()

    return NextResponse.json({
      ok: true,
      data,
    })
  } catch (error) {
    console.error('Envanter ürün listeleme hatası:', error)

    return NextResponse.json(
      {
        ok: false,
        message: 'Ürün listesi alınırken hata oluştu.',
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.admin')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }
  try {
    const body = (await request.json()) as EnvanterUrunForm

    const data = await createEnvanterUrun(body)

    return NextResponse.json(
      {
        ok: true,
        message: 'Ürün başarıyla oluşturuldu.',
        data,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Envanter ürün oluşturma hatası:', error)

    const message =
      error instanceof Error
        ? error.message
        : 'Ürün oluşturulurken hata oluştu.'

    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 400 },
    )
  }
}
