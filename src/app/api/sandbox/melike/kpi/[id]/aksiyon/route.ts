import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

async function orgUnitAltIdleri(kokId: string): Promise<string[]> {
  const sonuc: string[] = [kokId]
  let seviye = [kokId]
  while (seviye.length > 0) {
    const cocuklar = await prisma.orgUnit.findMany({ where: { parentId: { in: seviye } }, select: { id: true } })
    if (cocuklar.length === 0) break
    seviye = cocuklar.map(c => c.id)
    sonuc.push(...seviye)
  }
  return sonuc
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const kpi = await prisma.kPIDefinition.findUnique({ where: { id }, select: { orgUnitId: true } })
  if (!kpi) return NextResponse.json({ error: 'KPI bulunamadı' }, { status: 404 })

  const altIdler = await orgUnitAltIdleri(kpi.orgUnitId)
  const sorumluAdaylari = await prisma.orgEmployee.findMany({
    where: { orgUnitId: { in: altIdler }, isActive: true },
    select: { id: true, displayName: true, positionTitle: true },
    orderBy: { displayName: 'asc' },
  })

  return NextResponse.json({ sorumluAdaylari })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()

  const action = typeof body.action === 'string' ? body.action.trim() : ''
  if (!action) {
    return NextResponse.json({ error: 'Aksiyon metni zorunludur' }, { status: 400 })
  }

  const aksiyon = await prisma.kPIAction.create({
    data: {
      kpiId: id,
      reason: typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : null,
      action,
      responsibleId: typeof body.responsibleId === 'string' && body.responsibleId ? body.responsibleId : null,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      completionPercent: body.completionPercent === '' || body.completionPercent == null ? 0 : Number(body.completionPercent),
      status: 'open',
    },
  })

  return NextResponse.json({ aksiyon })
}
