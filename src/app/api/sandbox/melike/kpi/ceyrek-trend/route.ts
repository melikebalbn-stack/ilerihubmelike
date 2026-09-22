import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const UST_BIRIM_ID = 'cmrzg1kqr00027jpe7y4egyt9'

function tutuldu(direction: string, target: number, actual: number): boolean {
  return direction === 'lower_is_better' ? actual <= target : actual >= target
}

// Aylık bir KPI için hangi ay hangi çeyreğe düşer (Ç1=Oca-Mar, Ç2=Nis-Haz, Ç3=Tem-Eyl, Ç4=Eki-Ara).
// Çeyreklik bir KPI'da zaten "month" alanı 1-4 = doğrudan çeyrek numarasıdır.
function ceyrekNo(frequency: string, month: number): number {
  return frequency === 'quarterly' ? month : Math.ceil(month / 3)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const yilParam = searchParams.get('yil')

  const departmanlar = await prisma.orgUnit.findMany({
    where: { parentId: UST_BIRIM_ID, unitType: 'DEPARTMENT', isActive: true },
    select: { id: true, name: true },
    orderBy: { sortOrder: 'asc' },
  })

  const kpiler = await prisma.kPIDefinition.findMany({
    where: { orgUnitId: { in: departmanlar.map(d => d.id) } },
    include: { measurements: true },
  })

  const mevcutYillar = Array.from(new Set(kpiler.flatMap(k => k.measurements.map(m => m.year)))).sort((a, b) => b - a)
  const aktifYil = yilParam ? Number(yilParam) : mevcutYillar[0] ?? null

  const trend = departmanlar.map(dept => {
    const deptKpiler = kpiler.filter(k => k.orgUnitId === dept.id)

    const ceyrekler = [1, 2, 3, 4].map(ceyrek => {
      const kpiOranlari: number[] = []
      for (const k of deptKpiler) {
        const gecerliOlcumler = k.measurements.filter(
          m => m.target != null && m.actual != null && m.year === aktifYil && ceyrekNo(k.frequency, m.month) === ceyrek,
        )
        if (gecerliOlcumler.length === 0) continue
        const tutulan = gecerliOlcumler.filter(m => tutuldu(k.direction, m.target as number, m.actual as number)).length
        kpiOranlari.push(Math.round((tutulan / gecerliOlcumler.length) * 100))
      }
      const oran = kpiOranlari.length > 0
        ? Math.round(kpiOranlari.reduce((t, o) => t + o, 0) / kpiOranlari.length)
        : null
      return { ceyrek, oran }
    })

    return { orgUnitId: dept.id, name: dept.name, ceyrekler }
  })

  // Şirket geneli çeyreklik gidişat — tüm departmanların tüm KPI'ları çeyrek bazında havuzlanır.
  const genelCeyrekler = [1, 2, 3, 4].map(ceyrek => {
    const kpiOranlari: number[] = []
    for (const k of kpiler) {
      const gecerliOlcumler = k.measurements.filter(
        m => m.target != null && m.actual != null && m.year === aktifYil && ceyrekNo(k.frequency, m.month) === ceyrek,
      )
      if (gecerliOlcumler.length === 0) continue
      const tutulan = gecerliOlcumler.filter(m => tutuldu(k.direction, m.target as number, m.actual as number)).length
      kpiOranlari.push(Math.round((tutulan / gecerliOlcumler.length) * 100))
    }
    const oran = kpiOranlari.length > 0
      ? Math.round(kpiOranlari.reduce((t, o) => t + o, 0) / kpiOranlari.length)
      : null
    return { ceyrek, oran }
  })

  return NextResponse.json({ trend, genel: { name: 'Şirket Geneli', ceyrekler: genelCeyrekler }, mevcutYillar, aktifYil })
}
