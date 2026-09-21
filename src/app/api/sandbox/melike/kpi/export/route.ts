import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { kpiExcelOlustur } from '../excel-sablon'

const ORG_UNIT_ID_IK = 'cmrzg1kr600037jpe4ge6rxe0'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const orgUnitId = searchParams.get('orgUnitId') || ORG_UNIT_ID_IK

  const kpiler = await prisma.kPIDefinition.findMany({
    where: { orgUnitId },
    include: { measurements: true, actions: true },
    orderBy: { name: 'asc' },
  })

  const orgEmployeeIdler = kpiler.flatMap(k => k.actions.map(a => a.responsibleId)).filter((id): id is string => !!id)
  const personelIdler = kpiler.flatMap(k => k.actions.map(a => a.sorumluPersonelId)).filter((id): id is string => !!id)
  const [orgEmployeeler, personeller] = await Promise.all([
    orgEmployeeIdler.length
      ? prisma.orgEmployee.findMany({ where: { id: { in: orgEmployeeIdler } }, select: { id: true, displayName: true } })
      : Promise.resolve([]),
    personelIdler.length
      ? prisma.personnel.findMany({ where: { id: { in: personelIdler } }, select: { id: true, adSoyad: true } })
      : Promise.resolve([]),
  ])
  const orgEmployeeAd = new Map(orgEmployeeler.map(s => [s.id, s.displayName]))
  const personelAd = new Map(personeller.map(p => [p.id, p.adSoyad]))

  const wb = kpiExcelOlustur(
    kpiler.map(k => ({
      ...k,
      actions: k.actions.map(a => ({
        ...a,
        sorumluAdi: a.sorumluPersonelId
          ? personelAd.get(a.sorumluPersonelId) ?? null
          : a.responsibleId
            ? orgEmployeeAd.get(a.responsibleId) ?? null
            : null,
      })),
    })),
  )
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="kpi-disa-aktar.xlsx"',
    },
  })
}
