import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'

export async function GET() {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.view')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  const profiller = await prisma.envanterPersonelBedenProfili.findMany({
    include: {
      personnel: { select: { sicilNo: true, adSoyad: true, bolum: true } },
    },
    orderBy: { personnel: { adSoyad: 'asc' } },
  })

  return NextResponse.json({ ok: true, data: profiller })
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

    if (!body.personnelId) {
      throw new Error('Personel seçilmelidir.')
    }

    const veri = {
      ustBeden: body.ustBeden || null,
      altBeden: body.altBeden || null,
      ayakkabiNo: body.ayakkabiNo || null,
      eldivenNo: body.eldivenNo || null,
      not: body.not || null,
      updatedById: user.id,
    }

    const profil = await prisma.envanterPersonelBedenProfili.upsert({
      where: { personnelId: body.personnelId },
      create: { personnelId: body.personnelId, ...veri },
      update: veri,
      include: {
        personnel: { select: { sicilNo: true, adSoyad: true, bolum: true } },
      },
    })

    return NextResponse.json({ ok: true, message: 'Beden profili kaydedildi.', data: profil })
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : 'Beden profili kaydedilemedi.' },
      { status: 400 },
    )
  }
}
