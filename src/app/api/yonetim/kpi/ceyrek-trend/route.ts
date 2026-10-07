import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireKpiGoruntule } from '@/lib/yonetim/kpi-yetki'

export const dynamic = 'force-dynamic'

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

// Aylık bir KPI için hangi ay hangi çeyreğe düşer (Ç1=Oca-Mar, Ç2=Nis-Haz, Ç3=Tem-Eyl, Ç4=Eki-Ara).
// Çeyreklik bir KPI'da zaten "month" alanı 1-4 = doğrudan çeyrek numarasıdır.
function ceyrekNo(frequency: string, month: number): number {
  return frequency === 'quarterly' ? month : Math.ceil(month / 3)
}

export async function GET(request: Request) {
  const { error } = await requireKpiGoruntule()
  if (error) return error

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
      const kpiOranlari: number[] = []
      for (const k of deptKpiler) {
        const gecerliOlcumler = k.measurements.filter(
          m => m.year === aktifYil && ceyrekNo(k.frequency, m.month) === ceyrek,
        )
        const oranlar = gecerliOlcumler
          .map(m => olcumOranHesapla(k, m))
          .filter((o): o is number => o != null)
        if (oranlar.length === 0) continue
        kpiOranlari.push(oranlar.reduce((t, o) => t + o, 0) / oranlar.length)
      }
      const oran = kpiOranlari.length > 0
        ? Math.round(kpiOranlari.reduce((t, o) => t + o, 0) / kpiOranlari.length)
        : null
      return { ceyrek, oran }
    })

    return { orgUnitId: dept.id, name: dept.name, ceyrekler }
  })

  return NextResponse.json({ trend, mevcutYillar, aktifYil })
}
