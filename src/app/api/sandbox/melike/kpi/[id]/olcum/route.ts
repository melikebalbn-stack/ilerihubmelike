import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()

  const year = Number(body.year)
  const month = Number(body.month)
  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Geçerli yıl/ay girin' }, { status: 400 })
  }

  const target = body.target === '' || body.target == null ? null : Number(body.target)
  const actual = body.actual === '' || body.actual == null ? null : Number(body.actual)

  const olcum = await prisma.kPIMeasurement.upsert({
    where: { kpiId_year_month: { kpiId: id, year, month } },
    update: { target, actual },
    create: { kpiId: id, year, month, target, actual },
  })

  return NextResponse.json({ olcum })
}
