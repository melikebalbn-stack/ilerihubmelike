import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { requirePermission } from '@/lib/auth/require-permission'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { error: permError } = await requirePermission('zimmet-formu.view')
  if (permError) return permError

  const { user, error } = await requireUser()
  if (error) return error

  const zimmetler = await prisma.zimmetFormu.findMany({
    where: {
      zimmetSahibiId: user.id,
      silindiMi: false,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      tur: true,
      turDiger: true,
      aciklama: true,
      ozellik: true,
      pcAdi: true,
      departman: true,
      seriNumarasi: true,
      verilisTarihi: true,
      durum: true,
      kaynak: true,
      redSebebi: true,
      zimmetSahibiImzaTarihi: true,
      imzaModu: true,
      islakImzaDosyasi: true,
      createdAt: true,
      createdBy: { select: { name: true } },
    },
  })

  return NextResponse.json(zimmetler)
}
