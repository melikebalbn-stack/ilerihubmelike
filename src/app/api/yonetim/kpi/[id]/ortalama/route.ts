import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireKpiYaz } from '@/lib/yonetim/kpi-yetki'

export const dynamic = 'force-dynamic'

// POST: yıllık ortalama (baseline) upsert / boşsa sil. Veri değiştirir → kpi.manage ∨ müdür
// koltuğu (KPI'nın departmanı koltuk ağacında; requireKpiYaz 403/404 döner).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await requireKpiYaz(id)
  if (error) return error

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
