import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const UST_BIRIM_ID = 'cmrzg1kqr00027jpe7y4egyt9'

// Oran, KPI'nın oranYonu (G/H ya da H/G) alanına göre DEĞİL, direction'a (düşük mü yüksek mi
// iyi) göre yönlendirilir — oranYonu çoğu KPI'da hiç elle düzeltilmeden varsayılanda (G_H)
// kalmış, direction ise zaten doğru giriliyor. Böylece yüksek oran HER ZAMAN "iyi" anlamına
// gelir: lower_is_better'da hedef/gerçekleşen, higher_is_better'da gerçekleşen/hedef.
// KASITLI OLARAK üst sınır/kırpma YOK — hedef ya da gerçekleşen sıfıra çok yakın girilen
// ölçümler (ör. %33 yerine 0,33 girilmiş gibi veri atışı sırasında ölçek hatası) olduğu gibi
// aşırı oranlar üretiyor; bu sınırlanırsa hatalı veri gizlenip kaynaktan düzeltilmesi atlanır.
// Payda (bölen) sıfırsa (lower_is_better'da gerçekleşen) Infinity/NaN çıkıp ortalamayı
// bozardı — bölüm hatasında %0 döndürülür (KPI Takip sayfasındaki G/H Oran satrıyla tutarlı).
function basariOrani(direction: string, target: number, actual: number): number {
  const payda = direction === 'lower_is_better' ? actual : target
  if (payda === 0) return 0
  return (direction === 'lower_is_better' ? target / actual : actual / target) * 100
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
          m => m.target && m.actual != null && m.year === aktifYil && ceyrekNo(k.frequency, m.month) === ceyrek,
        )
        if (gecerliOlcumler.length === 0) continue
        const oranlar = gecerliOlcumler.map(m => basariOrani(k.direction, m.target as number, m.actual as number))
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
