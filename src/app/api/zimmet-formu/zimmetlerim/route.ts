import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { user, error } = await requireUser()
  if (error) return error

  const zimmetler = await prisma.zimmetFormu.findMany({
    where: { zimmetSahibiId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      tur: true,
      turDiger: true,
      aciklama: true,
      seriNumarasi: true,
      verilisTarihi: true,
      durum: true,
      zimmetSahibiImzaTarihi: true,
      imzaModu: true,
      islakImzaDosyasi: true,
      createdAt: true,
      createdBy: { select: { name: true } },
    },
  })

  return NextResponse.json(zimmetler)
}
