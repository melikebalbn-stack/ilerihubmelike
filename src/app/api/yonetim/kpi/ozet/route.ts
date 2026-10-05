import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireKpiGoruntule } from '@/lib/yonetim/kpi-yetki'

export const dynamic = 'force-dynamic'

const UST_BIRIM_ID = 'cmrzg1kqr00027jpe7y4egyt9'

// Oran, KPI'nın oranYonu (G/H ya da H/G) alanına göre DEĞİL, direction'a (düşük mü yüksek mi
// iyi) göre yönlendirilir — oranYonu çoğu KPI'da hiç elle düzeltilmeden varsayılanda (G_H)
// kalmış, direction ise zaten doğru giriliyor. Böylece yüksek oran HER ZAMAN "iyi" anlamına
// gelir: lower_is_better'da hedef/gerçekleşen, higher_is_better'da gerçekleşen/hedef.
// KASITLI OLARAK üst sınır/kırpma YOK — hedef ya da gerçekleşen sıfıra çok yakın girilen
// ölçümler (ör. %33 yerine 0,33 girilmiş gibi veri atışı sırasında ölçek hatası) olduğu gibi
// aşırı oranlar üretiyor; bu sınırlanırsa hatalı veri gizlenip kaynaktan düzeltilmesi atlanır.
function basariOrani(direction: string, target: number, actual: number): number {
  return (direction === 'lower_is_better' ? target / actual : actual / target) * 100
}

export async function GET(request: Request) {
  const { error } = await requireKpiGoruntule()
  if (error) return error

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
          m => m.target && m.actual != null && (aktifYil == null || m.year === aktifYil),
        )
        if (gecerliOlcumler.length === 0) return null
        const oranlar = gecerliOlcumler.map(m => basariOrani(k.direction, m.target as number, m.actual as number))
        const ort = oranlar.reduce((t, o) => t + o, 0) / oranlar.length
        return { id: k.id, name: k.name, oran: Math.round(ort) }
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

  // Şirket geneli tek rakam — tüm departmanların tüm KPI oranları eşit ağırlıkla havuzlanır
  // (departman ortalamalarının ortalaması değil; büyük/küçük departman ayrımı yapmadan tüm KPI'lar eşit sayılır).
  const tumKpiOranlari = ozet.flatMap(d => d.kpiler.map(k => k.oran))
  const genelToplam = tumKpiOranlari.length > 0
    ? Math.round(tumKpiOranlari.reduce((t, o) => t + o, 0) / tumKpiOranlari.length)
    : null

  return NextResponse.json({ ozet, mevcutYillar, aktifYil, genelToplam })
}
