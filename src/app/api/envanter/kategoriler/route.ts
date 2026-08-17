import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { logEnvanterIslem } from '@/lib/envanter/service'

export async function GET(request: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.view')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  const durum = request.nextUrl.searchParams.get('durum')

  const kategoriler = await prisma.envanterKategori.findMany({
    where: durum ? { durum: durum as never } : undefined,
    orderBy: { ad: 'asc' },
  })

  return NextResponse.json({ ok: true, data: kategoriler })
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.admin')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  try {
    const body = await request.json()

    const ad = typeof body.ad === 'string' ? body.ad.trim() : ''
    if (!ad) {
      throw new Error('Kategori adı zorunludur.')
    }

    const mevcut = await prisma.envanterKategori.findUnique({ where: { ad } })
    if (mevcut) {
      throw new Error(`"${ad}" adında bir kategori zaten mevcut.`)
    }

    const kategori = await prisma.envanterKategori.create({
      data: {
        ad,
        yenilemePeriyoduAy:
          body.yenilemePeriyoduAy === '' || body.yenilemePeriyoduAy == null
            ? null
            : Number(body.yenilemePeriyoduAy),
        minStokVarsayilan:
          body.minStokVarsayilan === '' || body.minStokVarsayilan == null
            ? null
            : Number(body.minStokVarsayilan),
        not: body.not || null,
      },
    })

    return NextResponse.json(
      { ok: true, message: 'Kategori oluşturuldu.', data: kategori },
      { status: 201 },
    )
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: err instanceof Error ? err.message : 'Kategori oluşturulamadı.',
      },
      { status: 400 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.admin')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  try {
    const body = await request.json()

    if (!body.id) {
      throw new Error('Kategori id zorunludur.')
    }

    const mevcut = await prisma.envanterKategori.findUnique({ where: { id: body.id } })
    if (!mevcut) {
      throw new Error('Kategori kaydı bulunamadı.')
    }

    if (typeof body.ad === 'string' && body.ad.trim() && body.ad.trim() !== mevcut.ad) {
      const cakisan = await prisma.envanterKategori.findUnique({
        where: { ad: body.ad.trim() },
      })
      if (cakisan) {
        throw new Error(`"${body.ad.trim()}" adında bir kategori zaten mevcut.`)
      }
    }

    const kategori = await prisma.envanterKategori.update({
      where: { id: body.id },
      data: {
        ad: typeof body.ad === 'string' && body.ad.trim() ? body.ad.trim() : undefined,
        yenilemePeriyoduAy:
          body.yenilemePeriyoduAy === undefined
            ? undefined
            : body.yenilemePeriyoduAy === '' || body.yenilemePeriyoduAy === null
              ? null
              : Number(body.yenilemePeriyoduAy),
        minStokVarsayilan:
          body.minStokVarsayilan === undefined
            ? undefined
            : body.minStokVarsayilan === '' || body.minStokVarsayilan === null
              ? null
              : Number(body.minStokVarsayilan),
        not: body.not === undefined ? undefined : body.not || null,
        durum: body.durum ? (body.durum as never) : undefined,
      },
    })

    return NextResponse.json({ ok: true, message: 'Kategori güncellendi.', data: kategori })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: err instanceof Error ? err.message : 'Kategori güncellenemedi.',
      },
      { status: 400 },
    )
  }
}

// Sil/Pasifleştir — kategori.ad string olarak urunlerde (kategori alani, FK degil)
// kullanildigi icin, hangi urunlerin bu adi tasidigi kontrol edilir. Kullanan urun
// yoksa kalici silinir; varsa denetim/rapor butunlugu icin pasiflestirilir.
export async function DELETE(request: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.admin')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  const id = request.nextUrl.searchParams.get('id')

  try {
    if (!id) {
      throw new Error('Kategori id zorunludur.')
    }

    const kategori = await prisma.envanterKategori.findUnique({ where: { id } })
    if (!kategori) {
      return NextResponse.json({ ok: false, message: 'Kategori bulunamadı.' }, { status: 404 })
    }

    const kullananUrunSayisi = await prisma.envanterUrun.count({ where: { kategori: kategori.ad } })

    const aktorId = session.user.id
    const aktorAd = session.user.name || session.user.email || 'Bilinmiyor'

    if (kullananUrunSayisi === 0) {
      await prisma.envanterKategori.delete({ where: { id } })
      await logEnvanterIslem({
        actorId: aktorId,
        actorAd: aktorAd,
        islemTipi: 'KATEGORI_SIL',
        hedefTip: 'EnvanterKategori',
        hedefId: id,
        detay: { ad: kategori.ad, aktorAd },
      })
      return NextResponse.json({ ok: true, message: 'Kategori kalıcı olarak silindi.' })
    }

    await prisma.envanterKategori.update({ where: { id }, data: { durum: 'PASIF' } })
    await logEnvanterIslem({
      actorId: aktorId,
      actorAd: aktorAd,
      islemTipi: 'KATEGORI_PASIFLESTIR',
      hedefTip: 'EnvanterKategori',
      hedefId: id,
      detay: { ad: kategori.ad, kullananUrunSayisi, aktorAd },
    })
    return NextResponse.json({
      ok: true,
      message: `Bu kategoriyi kullanan ${kullananUrunSayisi} ürün olduğu için kalıcı silinemedi, pasifleştirildi.`,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : 'Kategori silinemedi.' },
      { status: 400 },
    )
  }
}
