import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import {
  createEnvanterUrun,
  listEnvanterUrunler,
} from '@/lib/envanter/service'
import type { EnvanterUrunForm } from '@/types/envanter'
import { Prisma } from '@/generated/prisma'
import { envanterHataMesaji } from '@/lib/envanter/hata'

export async function GET(request: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.view')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }
  try {
    // Filtreler SUNUCUDA uygulanir; donen liste = ekranda gosterilecek liste,
    // boylece toplam sayi ile tablo icerigi hep tutarli olur.
    const durum = request.nextUrl.searchParams.get('durum')
    const stokSeviyesi = request.nextUrl.searchParams.get('stokSeviyesi')
    const data = await listEnvanterUrunler({ durum, stokSeviyesi })

    return NextResponse.json({
      ok: true,
      data,
      toplam: data.length,
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

    const data = await createEnvanterUrun(
      body,
      session.user.id,
      session.user.name || session.user.email || 'Bilinmiyor',
    )

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

    if (
      error instanceof Prisma.PrismaClientValidationError ||
      (error as { name?: string })?.name === 'PrismaClientValidationError'
    ) {
      // Ham Prisma metni model/alan yapısını sızdırır — kullanıcıya GİTMEZ,
      // yalnız yukarıdaki console.error ile sunucu loguna yazılır.
      return NextResponse.json(
        { ok: false, message: 'Kaydedilemeyen alan var, sistem yöneticisine bildirin' },
        { status: 500 },
      )
    }

    const message =
      envanterHataMesaji(error, 'Ürün oluşturulurken hata oluştu.')

    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 400 },
    )
  }
}
