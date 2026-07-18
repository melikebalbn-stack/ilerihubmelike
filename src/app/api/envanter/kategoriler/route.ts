import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'

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
