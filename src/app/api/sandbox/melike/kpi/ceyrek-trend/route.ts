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
}

interface KpiBenzeri {
  direction: string
  frequency: string
  ortalamaKaynagi: string
  measurements: OlcumBenzeri[]
  ozelAlanlar: { key: string; degerler: { year: number; month: number; value: number | null; naMi: boolean }[] }[]
}

// Aylık bir KPI için hangi ay hangi çeyreğe düşer (Ç1=Oca-Mar, Ç2=Nis-Haz, Ç3=Tem-Eyl, Ç4=Eki-Ara).
// Çeyreklik bir KPI'da zaten "month" alanı 1-4 = doğrudan çeyrek numarasıdır.
function ceyrekNo(frequency: string, month: number): number {
  return frequency === 'quarterly' ? month : Math.ceil(month / 3)
}

function kaynakDegeriAl(kpi: KpiBenzeri, kaynak: string, year: number, month: number): number | null {
  if (kaynak === 'actual') {
    const m = kpi.measurements.find(x => x.year === year && x.month === month)
    if (!m || m.gerceklesenNA) return null
    return m.actual
  }
  const alan = kpi.ozelAlanlar.find(a => a.key === kaynak)
  const d = alan?.degerler.find(x => x.year === year && x.month === month)
  if (!d || d.naMi) return null
  return d.value
}

// KPI Özet'teki ozet/route.ts ile AYNI mantık (bkz. oradaki açıklama) — direction'a ve
// ortalamaKaynagi'na göre, ama burada yıllık değil ÇEYREKLİK ortalama.
function kpiCeyrekOrani(kpi: KpiBenzeri, year: number, ceyrek: number): number | null {
  const aylar = kpi.frequency === 'quarterly' ? [ceyrek] : [1, 2, 3].map(i => (ceyrek - 1) * 3 + i)

  const gercekDegerler: number[] = []
  const hedefDegerler: number[] = []
  for (const ay of aylar) {
    const g = kaynakDegeriAl(kpi, kpi.ortalamaKaynagi, year, ay)
    if (g != null) gercekDegerler.push(g)
    const m = kpi.measurements.find(x => x.year === year && x.month === ay)
    if (m && m.target != null && !m.hedefNA) hedefDegerler.push(m.target)
  }
  if (gercekDegerler.length === 0 || hedefDegerler.length === 0) return null

  const gercekOrt = gercekDegerler.reduce((t, o) => t + o, 0) / gercekDegerler.length
  const hedefOrt = hedefDegerler.reduce((t, o) => t + o, 0) / hedefDegerler.length
  const payda = kpi.direction === 'lower_is_better' ? gercekOrt : hedefOrt
  if (payda === 0) return null
  const oran = kpi.direction === 'lower_is_better' ? hedefOrt / gercekOrt : gercekOrt / hedefOrt
  return oran * 100
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
