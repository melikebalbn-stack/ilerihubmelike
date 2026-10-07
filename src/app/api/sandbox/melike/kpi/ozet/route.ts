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
  oranYonu: string
  oranPayKaynagi: string
  ozelAlanlar: { key: string; degerler: { year: number; month: number; value: number | null; naMi: boolean }[] }[]
}

// Oran, KPI Takip sayfasındaki "G/H Oran"/"H/G Oran" satırıyla AYNI mantık — hangi tarafın G/H'nin
// "G"si (payı) olacağını (Gerçekleşen mi yoksa özel bir alan mı) ve yönünü (G/H ya da H/G) KULLANICI
// kendi belirler (oranPayKaynagi, oranYonu) — direction'a göre otomatik bir kural UYGULANMAZ, çünkü
// bu alanları KPI bazında elle düzenleyebiliyor artık (Yeni/Düzenle KPI dialogları).
// Elle girilmiş oran (manuelOran) varsa her şeyi by-pass eder. N/A (hedefNA ya da payın NA'sı)
// işaretliyse %0 döner. KASITLI OLARAK üst sınır/kırpma YOK — veri kaynağından düzeltilir.
function olcumOranHesapla(kpi: KpiBenzeri, m: OlcumBenzeri): number | null {
  if (m.manuelOran != null) return m.manuelOran

  const pay = kpi.oranPayKaynagi === 'actual'
    ? { value: m.actual, na: m.gerceklesenNA }
    : (() => {
        const alan = kpi.ozelAlanlar.find(a => a.key === kpi.oranPayKaynagi)
        const d = alan?.degerler.find(x => x.year === m.year && x.month === m.month)
        return { value: d?.value ?? null, na: d?.naMi ?? false }
      })()

  if (m.hedefNA || pay.na) return 0
  if (m.target == null || m.target === 0 || pay.value == null) return null

  const payda = kpi.oranYonu === 'H_G' ? pay.value : m.target
  if (payda === 0) return 0
  return (kpi.oranYonu === 'H_G' ? m.target / payda : pay.value / payda) * 100
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
        const yillikOlcumler = k.measurements.filter(m => aktifYil == null || m.year === aktifYil)
        const oranlar = yillikOlcumler
          .map(m => olcumOranHesapla(k, m))
          .filter((o): o is number => o != null)
        if (oranlar.length === 0) return null
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
