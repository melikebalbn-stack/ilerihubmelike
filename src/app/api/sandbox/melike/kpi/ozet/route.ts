import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const UST_BIRIM_ID = 'cmrzg1kqr00027jpe7y4egyt9'

function tutuldu(direction: string, target: number, actual: number): boolean {
  return direction === 'lower_is_better' ? actual <= target : actual >= target
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const istenenYil = searchParams.get('yil') ? Number(searchParams.get('yil')) : null

  const departmanlar = await prisma.orgUnit.findMany({
    where: { parentId: UST_BIRIM_ID, unitType: 'DEPARTMENT', isActive: true },
    select: { id: true, name: true },
    orderBy: { sortOrder: 'asc' },
  })

  const kpiler = await prisma.kPIDefinition.findMany({
    where: { orgUnitId: { in: departmanlar.map(d => d.id) } },
    include: { measurements: true },
  })

  // Genel olarak veri olan tüm yıllar (yıl seçici için) — en yeniden en eskiye.
  const mevcutYillar = Array.from(new Set(kpiler.flatMap(k => k.measurements.map(m => m.year)))).sort((a, b) => b - a)
  // Yıl belirtilmediyse en güncel yıl neyse onu kullan — 2025+2026'yı karışık
  // ortalamak yerine, "genel başarı" hep TEK bir yılı yansıtsın.
  const aktifYil = istenenYil ?? mevcutYillar[0] ?? null

  const ozet = departmanlar.map(dept => {
    const deptKpiler = kpiler.filter(k => k.orgUnitId === dept.id)

    const kpiOranlari = deptKpiler
      .map(k => {
        const gecerliOlcumler = k.measurements.filter(
          m => m.target != null && m.actual != null && (aktifYil == null || m.year === aktifYil),
        )
        if (gecerliOlcumler.length === 0) return null
        const tutulan = gecerliOlcumler.filter(m => tutuldu(k.direction, m.target as number, m.actual as number)).length
        return { id: k.id, name: k.name, oran: Math.round((tutulan / gecerliOlcumler.length) * 100) }
      })
      .filter((x): x is { id: string; name: string; oran: number } => x !== null)

    const genelOran = kpiOranlari.length > 0
      ? Math.round(kpiOranlari.reduce((t, k) => t + k.oran, 0) / kpiOranlari.length)
      : null

    const siraliAzalan = [...kpiOranlari].sort((a, b) => b.oran - a.oran)

    return {
      orgUnitId: dept.id,
      name: dept.name,
      kpiSayisi: deptKpiler.length,
      genelOran,
      // Tüm KPI'lar, en başarılıdan en başarısıza sıralı — arayüz top3'e de,
      // tam listeye de bu diziden bakabilir.
      kpiler: siraliAzalan,
    }
  })

  return NextResponse.json({ ozet, mevcutYillar, aktifYil })
}
