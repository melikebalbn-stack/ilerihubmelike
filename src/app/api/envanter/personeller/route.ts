import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.view')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }
  try {
    const personeller = await prisma.personnel.findMany({
      where: { aktif: true },
      orderBy: {
        adSoyad: 'asc',
      },
      take: 300,
      select: {
        id: true,
        sicilNo: true,
        adSoyad: true,
        bolum: true,
      },
    })

    return NextResponse.json({
      ok: true,
      data: personeller,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Personel listesi alınamadı.',
      },
      { status: 500 },
    )
  }
}
