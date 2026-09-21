import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return NextResponse.json({ error: 'KPI adı zorunludur' }, { status: 400 })
  }

  const kpi = await prisma.kPIDefinition.update({
    where: { id },
    data: {
      name,
      unit: typeof body.unit === 'string' && body.unit.trim() ? body.unit.trim() : null,
      direction: body.direction === 'lower_is_better' ? 'lower_is_better' : 'higher_is_better',
      frequency: body.frequency === 'quarterly' ? 'quarterly' : 'monthly',
      gerceklesenEtiketi: typeof body.gerceklesenEtiketi === 'string' && body.gerceklesenEtiketi.trim() ? body.gerceklesenEtiketi.trim() : 'Gerçekleşen',
      hedefEtiketi: typeof body.hedefEtiketi === 'string' && body.hedefEtiketi.trim() ? body.hedefEtiketi.trim() : 'Hedef',
      oranYonu: body.oranYonu === 'H_G' ? 'H_G' : 'G_H',
    },
  })

  return NextResponse.json({ kpi })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // KPIMeasurement / KPIYearlyBaseline / KPIAction, KPIDefinition'a onDelete: Cascade ile bağlı —
  // bu satırı silmek hepsini birlikte siler.
  await prisma.kPIDefinition.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
