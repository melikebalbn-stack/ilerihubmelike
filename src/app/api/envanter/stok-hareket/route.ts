import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { createEnvanterStokHareket } from '@/lib/envanter/service'
import { envanterHataMesaji } from '@/lib/envanter/hata'

export async function POST(request: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.admin')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }
  try {
    const body = await request.json()

    const result = await createEnvanterStokHareket({
      stokId: body.stokId,
      hareketTipi: body.hareketTipi,
      miktar: Number(body.miktar),
      aciklama: body.aciklama,
      bolum: body.bolum,
        alanPersonelId: body.alanPersonelId,
        alanPersonelAd: body.alanPersonelAd,
        actorId: session.user.id,
        actorAd: session.user.name || session.user.email || 'Bilinmiyor',
      })

    return NextResponse.json({
      ok: true,
      message: 'Stok hareketi başarıyla oluşturuldu.',
      data: result,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          envanterHataMesaji(error, 'Stok hareketi oluşturulamadı.'),
      },
      { status: 400 },
    )
  }
}
