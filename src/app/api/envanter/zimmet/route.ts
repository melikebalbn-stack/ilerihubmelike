import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { createZimmet } from '@/lib/envanter/service'

export async function GET(request: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.view')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  const personnelId = request.nextUrl.searchParams.get('personnelId')

  if (!personnelId) {
    return NextResponse.json(
      { ok: false, message: 'personnelId zorunludur.' },
      { status: 400 },
    )
  }

  const zimmetler = await prisma.envanterZimmet.findMany({
    where: { personnelId },
    include: {
      urun: {
        select: {
          kod: true,
          ad: true,
          olcuBirimi: true,
        },
      },
      stok: {
        select: {
          depo: true,
          raf: true,
          varyant: {
            select: {
              varyantAdi: true,
            },
          },
        },
      },
    },
    orderBy: {
      teslimTarihi: 'desc',
    },
  })

  return NextResponse.json({ ok: true, data: zimmetler })
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

    const result = await createZimmet({
      personnelId: body.personnelId,
      stokId: body.stokId,
      miktar: Number(body.miktar),
      aciklama: body.aciklama,
      createdById: user.id,
    })

    return NextResponse.json({
      ok: true,
      message: 'Zimmet başarıyla oluşturuldu.',
      data: result,
    })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message:
          err instanceof Error ? err.message : 'Zimmet oluşturulamadı.',
      },
      { status: 400 },
    )
  }
}
