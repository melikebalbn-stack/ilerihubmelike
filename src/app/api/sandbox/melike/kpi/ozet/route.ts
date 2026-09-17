import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const UST_BIRIM_ID = 'cmrzg1kqr00027jpe7y4egyt9'

function tutuldu(direction: string, target: number, actual: number): boolean {
  return direction === 'lower_is_better' ? actual <= target : actual >= target
}

export async function GET() {
  const departmanlar = await prisma.orgUnit.findMany({
    where: { parentId: UST_BIRIM_ID, unitType: 'DEPARTMENT', isActive: true },
    select: { id: true, name: true },
    orderBy: { sortOrder: 'asc' },
  })

  const kpiler = await prisma.kPIDefinition.findMany({
    where: { orgUnitId: { in: departmanlar.map(d => d.id) } },
    include: { measurements: true },
  })

  const ozet = departmanlar.map(dept => {
    const deptKpiler = kpiler.filter(k => k.orgUnitId === dept.id)

    const kpiOranlari = deptKpiler
      .map(k => {
        const gecerliOlcumler = k.measurements.filter(m => m.target != null && m.actual != null)
        if (gecerliOlcumler.length === 0) return null
        const tutulan = gecerliOlcumler.filter(m => tutuldu(k.direction, m.target as number, m.actual as number)).length
        return { id: k.id, name: k.name, oran: Math.round((tutulan / gecerliOlcumler.length) * 100) }
      })
      .filter((x): x is { id: string; name: string; oran: number } => x !== null)

    const genelOran = kpiOranlari.length > 0
      ? Math.round(kpiOranlari.reduce((t, k) => t + k.oran, 0) / kpiOranlari.length)
      : null

    const siraliArtan = [...kpiOranlari].sort((a, b) => a.oran - b.oran)
    const siraliAzalan = [...kpiOranlari].sort((a, b) => b.oran - a.oran)

    return {
      orgUnitId: dept.id,
      name: dept.name,
      kpiSayisi: deptKpiler.length,
      genelOran,
      enBasarili: siraliAzalan.slice(0, 3),
      enBasarisiz: siraliArtan.slice(0, 3),
    }
  })

  return NextResponse.json({ ozet })
}
