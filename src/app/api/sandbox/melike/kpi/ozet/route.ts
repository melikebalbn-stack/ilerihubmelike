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
  oranBirimi: string
  measurements: OlcumBenzeri[]
  ozelAlanlar: { key: string; degerler: { year: number; month: number; value: number | null; naMi: boolean }[] }[]
}

function donemSayisi(frequency: string): number {
  return frequency === 'quarterly' ? 4 : 12
}

// "Ort." (yıllık ortalama) ile aynı kaynaktan (Gerçekleşen ya da seçili özel alan) bir ay/yıl
// değeri okur — N/A işaretli aylar hiç sayılmaz (hesaba girmez, boş gibi davranılır).
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

function yillikKaynakOrtalamasi(kpi: KpiBenzeri, kaynak: string, year: number): number | null {
  const degerler: number[] = []
  for (let ay = 1; ay <= donemSayisi(kpi.frequency); ay++) {
    const d = kaynakDegeriAl(kpi, kaynak, year, ay)
    if (d != null) degerler.push(d)
  }
  return degerler.length > 0 ? degerler.reduce((t, o) => t + o, 0) / degerler.length : null
}

function yillikHedefOrtalamasi(kpi: KpiBenzeri, year: number): number | null {
  const degerler = kpi.measurements
    .filter(m => m.year === year && m.target != null && !m.hedefNA)
    .map(m => m.target as number)
  return degerler.length > 0 ? degerler.reduce((t, o) => t + o, 0) / degerler.length : null
}

// KPI Özet'teki oran artık KPI Takip'in "G/H Oran" satırındaki oranYonu/oranPayKaynagi'ndan
// BAĞIMSIZ — direction'a (düşük mü yüksek mi iyi) ve yıllık ORTALAMALARA (grafikteki "Ort." ile
// aynı kaynak: ortalamaKaynagi) göre hesaplanıyor. Sebep: oranYonu KPI başına elle ayarlanan,
// kolayca yanlış kalabilen bir alan (ör. "Fazla Mesai" düşük iyi ama oranYonu yanlışlıkla G/H
// kalınca hedefin katbekat üzerine çıkılmış olsa bile "başarılı" görünüyordu). direction ise
// her KPI'da zaten doğru giriliyor — bu yüzden "hedefi tutturamamışsa kötüdür" kuralı burada
// HER ZAMAN geçerli, oranYonu ne olursa olsun. Tek ay değil YILLIK ortalama kullanılıyor ki tek
// bir aşırı ay (veri hatası) tüm yılın görünümünü bozmasın.
function kpiYillikOran(kpi: KpiBenzeri, year: number): number | null {
  const gercekOrt = yillikKaynakOrtalamasi(kpi, kpi.ortalamaKaynagi, year)
  const hedefOrt = yillikHedefOrtalamasi(kpi, year)
  if (gercekOrt == null || hedefOrt == null) return null
  const payda = kpi.direction === 'lower_is_better' ? gercekOrt : hedefOrt
  if (payda === 0) return null
  const oran = kpi.direction === 'lower_is_better' ? hedefOrt / gercekOrt : gercekOrt / hedefOrt
  return oran * 100
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
    include: { measurements: true, ozelAlanlar: { include: { degerler: true } } },
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
        if (aktifYil == null) return null
        const oran = kpiYillikOran(k, aktifYil)
        if (oran == null) return null
        return { id: k.id, name: k.name, oran: Math.round(oran), oranBirimi: k.oranBirimi }
      })
      .filter((x): x is { id: string; name: string; oran: number; oranBirimi: string } => x !== null)

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
