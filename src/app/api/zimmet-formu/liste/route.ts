import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { requirePermission } from '@/lib/auth/require-permission'
import { ZimmetOnayDurumu } from '@/generated/prisma'

export const dynamic = 'force-dynamic'

const DURUM_VALUES = Object.values(ZimmetOnayDurumu) as string[]

export async function GET(request: NextRequest) {
  const { error } = await requirePermission('zimmet-formu.view')
  if (error) return error

  const { searchParams } = new URL(request.url)
  const durumParam = searchParams.get('durum') ?? ''
  const araParam = searchParams.get('ara')?.trim() ?? ''

  const where: {
    durum?: ZimmetOnayDurumu
    OR?: Array<Record<string, unknown>>
    silindiMi?: boolean
  } = {
    silindiMi: false,
  }

  if (durumParam && DURUM_VALUES.includes(durumParam)) {
    where.durum = durumParam as ZimmetOnayDurumu
  }

  if (araParam) {
    where.OR = [
      { zimmetSahibi: { name: { contains: araParam, mode: 'insensitive' } } },
      { seriNumarasi: { contains: araParam, mode: 'insensitive' } },
    ]
  }

  const zimmetler = await prisma.zimmetFormu.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      zimmetSahibi: { select: { name: true, email: true, employeeId: true } },
      createdBy: { select: { name: true, email: true } },
    },
  })

  return NextResponse.json(zimmetler)
}
