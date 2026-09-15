import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'

export const dynamic = 'force-dynamic'

// POST: aylık hedef/gerçekleşen ölçüm upsert'i. Veri değiştirir → kpi.manage.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission(PERMISSION_KEYS.KPI_MANAGE)
  if (error) return error

  const { id } = await params
  const body = await request.json()

  const year = Number(body.year)
  const month = Number(body.month)
  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Geçerli yıl/ay girin' }, { status: 400 })
  }

  // KPI gerçekten var mı — yoksa yabancı kpiId ile satır oluşturmayı engelle.
  const kpi = await prisma.kPIDefinition.findUnique({ where: { id }, select: { id: true } })
  if (!kpi) return NextResponse.json({ error: 'KPI bulunamadı' }, { status: 404 })

  const target = body.target === '' || body.target == null ? null : Number(body.target)
  const actual = body.actual === '' || body.actual == null ? null : Number(body.actual)

  const olcum = await prisma.kPIMeasurement.upsert({
    where: { kpiId_year_month: { kpiId: id, year, month } },
    update: { target, actual },
    create: { kpiId: id, year, month, target, actual },
  })

  return NextResponse.json({ olcum })
}
