import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()

  const year = Number(body.year)
  if (!year) {
    return NextResponse.json({ error: 'Geçerli bir yıl girin' }, { status: 400 })
  }

  if (body.average === '' || body.average == null) {
    await prisma.kPIYearlyBaseline.deleteMany({ where: { kpiId: id, year } })
    return NextResponse.json({ ok: true })
  }

  const baseline = await prisma.kPIYearlyBaseline.upsert({
    where: { kpiId_year: { kpiId: id, year } },
    update: { average: Number(body.average) },
    create: { kpiId: id, year, average: Number(body.average) },
  })

  return NextResponse.json({ baseline })
}
