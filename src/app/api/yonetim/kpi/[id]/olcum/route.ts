import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireKpiYaz } from '@/lib/yonetim/kpi-yetki'

export const dynamic = 'force-dynamic'

// POST: aylık hedef/gerçekleşen ölçüm upsert'i. Veri değiştirir → kpi.manage ∨ müdür koltuğu
// (KPI'nın departmanı koltuk ağacında; requireKpiYaz 403/404 döner).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await requireKpiYaz(id)
  if (error) return error

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
