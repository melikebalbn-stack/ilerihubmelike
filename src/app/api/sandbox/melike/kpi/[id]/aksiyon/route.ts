import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ORG_UNIT_CODE_TO_PERSONNEL_BOLUM } from '../../personel-map'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const kpi = await prisma.kPIDefinition.findUnique({
    where: { id },
    select: { orgUnit: { select: { code: true } } },
  })
  if (!kpi) return NextResponse.json({ error: 'KPI bulunamadı' }, { status: 404 })

  const bolum = ORG_UNIT_CODE_TO_PERSONNEL_BOLUM[kpi.orgUnit.code]
  const sorumluAdaylari = bolum
    ? await prisma.personnel.findMany({
        where: { bolum, aktif: true },
        select: { id: true, adSoyad: true, gorev: true },
        orderBy: { adSoyad: 'asc' },
      })
    : []

  return NextResponse.json({
    sorumluAdaylari: sorumluAdaylari.map(p => ({ id: p.id, displayName: p.adSoyad, positionTitle: p.gorev })),
  })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()

  const action = typeof body.action === 'string' ? body.action.trim() : ''
  if (!action) {
    return NextResponse.json({ error: 'Aksiyon metni zorunludur' }, { status: 400 })
  }

  const sorumluPersonelId = typeof body.sorumluPersonelId === 'string' && body.sorumluPersonelId ? body.sorumluPersonelId : null
  const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : null
  const startDate = body.startDate ? new Date(body.startDate) : null
  const endDate = body.endDate ? new Date(body.endDate) : null

  const aksiyon = await prisma.kPIAction.create({
    data: {
      kpiId: id,
      reason,
      action,
      sorumluPersonelId,
      startDate,
      endDate,
      completionPercent: body.completionPercent === '' || body.completionPercent == null ? 0 : Number(body.completionPercent),
      status: 'open',
    },
  })

  // KPI Aksiyonu → ILERIHub Planlı Görevler (bkz. five-s/[id]/action-plan/route.ts deseni)
  const kpi = await prisma.kPIDefinition.findUnique({ where: { id }, select: { name: true } })
  const sorumlu = sorumluPersonelId
    ? await prisma.personnel.findUnique({ where: { id: sorumluPersonelId }, select: { adSoyad: true, mailAdresi: true } })
    : null
  await prisma.plannedTask.create({
    data: {
      title: `KPI Aksiyon: ${kpi?.name ?? ''} — ${action}`,
      description: reason ? `**Neden:** ${reason}\n\n**Aksiyon:** ${action}` : action,
      dueDate: endDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      startDate,
      responsiblePerson: sorumlu?.adSoyad ?? null,
      responsiblePersonEmail: sorumlu?.mailAdresi ?? null,
      status: 'PENDING',
      priority: 'NORMAL',
      reminderDays: [7, 3, 1],
      isActive: true,
    },
  })

  return NextResponse.json({ aksiyon })
}
