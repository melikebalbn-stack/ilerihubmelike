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
      // PENDING migration (prisma/migrations/PENDING_zimmet_silme_alanlari)
      // uygulanana kadar GEÇİCİ olarak devre dışı - DB'de/generated client'ta
      // silindiMi henüz yok. Migration çalışınca geri aç:
      // silindiMi: false,
    },
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
