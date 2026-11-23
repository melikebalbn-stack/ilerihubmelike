import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const UST_BIRIM_ID = 'cmrzg1kqr00027jpe7y4egyt9'

interface OlcumBenzeri {
  year: number
  month: number
  target: number | null
  actual: number | null
  hedefNA: boolean
  gerceklesenNA: boolean
  manuelOran: number | null
}

interface KpiBenzeri {
  direction: string
  frequency: string
  oranYonu: string
  oranPayKaynagi: string
  measurements: OlcumBenzeri[]
  ozelAlanlar: { key: string; degerler: { year: number; month: number; value: number | null; naMi: boolean }[] }[]
}

// KPI Özet'teki ozet/route.ts ile AYNI mantık (bkz. oradaki açıklama) — Takip'in kendi "G/H Oran"
// satırı, ama burada yıllık değil ÇEYREKLİK ortalama.
function kpiAylikOran(kpi: KpiBenzeri, year: number, month: number): number | null {
  const m = kpi.measurements.find(x => x.year === year && x.month === month)
  const ozelAlan = kpi.oranPayKaynagi === 'actual' ? null : kpi.ozelAlanlar.find(a => a.key === kpi.oranPayKaynagi)
  const ozelDeger = ozelAlan?.degerler.find(x => x.year === year && x.month === month)
  const gEsdeger = kpi.oranPayKaynagi === 'actual' ? m?.actual ?? null : ozelDeger?.value ?? null
  const gEsdegerNA = kpi.oranPayKaynagi === 'actual' ? m?.gerceklesenNA ?? false : ozelDeger?.naMi ?? false
  const target = m?.target ?? null
  const hedefNA = m?.hedefNA ?? false
  const payda = kpi.oranYonu === 'H_G' ? gEsdeger : target

  if (m?.manuelOran != null) return Math.round(m.manuelOran)
  if (hedefNA || gEsdegerNA) return 0
  if (target == null || gEsdeger == null || payda == null) return null
  if (payda === 0) return 0
  return Math.round((kpi.oranYonu === 'H_G' ? (target as number) / payda : (gEsdeger as number) / payda) * 100)
}

function kpiCeyrekOrani(kpi: KpiBenzeri, year: number, ceyrek: number): number | null {
  const aylar = kpi.frequency === 'quarterly' ? [ceyrek] : [1, 2, 3].map(i => (ceyrek - 1) * 3 + i)
  const degerler: number[] = []
  for (const ay of aylar) {
    const o = kpiAylikOran(kpi, year, ay)
    if (o != null) degerler.push(o)
  }
  return degerler.length > 0 ? degerler.reduce((t, o) => t + o, 0) / degerler.length : null
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
    include: { measurements: true, ozelAlanlar: { include: { degerler: true } } },
  })

  const mevcutYillar = Array.from(new Set(kpiler.flatMap(k => k.measurements.map(m => m.year)))).sort((a, b) => b - a)
  const aktifYil = yilParam ? Number(yilParam) : mevcutYillar[0] ?? null

  const trend = departmanlar.map(dept => {
    const deptKpiler = kpiler.filter(k => k.orgUnitId === dept.id)

    const ceyrekler = [1, 2, 3, 4].map(ceyrek => {
      if (aktifYil == null) return { ceyrek, oran: null }
      const kpiOranlari = deptKpiler
        .map(k => kpiCeyrekOrani(k, aktifYil, ceyrek))
        .filter((o): o is number => o != null)
      const oran = kpiOranlari.length > 0
        ? Math.round(kpiOranlari.reduce((t, o) => t + o, 0) / kpiOranlari.length)
        : null
      return { ceyrek, oran }
    })

    return { orgUnitId: dept.id, name: dept.name, ceyrekler }
  })

  return NextResponse.json({ trend, mevcutYillar, aktifYil })
}
