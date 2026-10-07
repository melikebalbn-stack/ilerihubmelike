import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireKpiYaz } from '@/lib/yonetim/kpi-yetki'

export const dynamic = 'force-dynamic'

// KPI-OZEL-ALAN: Gerçekleşen/Hedef dışındaki özel alanların (Gelen/Çözülen/Toplam gibi) aylık
// değerini kaydeder. [id] burada KPIDefinition.id, ama asıl kayıt KPIOzelAlanDegeri'ne gider —
// alanın (KPIOzelAlan) gerçekten bu KPI'ya ait olduğu doğrulanır ki başka bir KPI'nın alanına
// yanlışlıkla yazılmasın.
// Yetki: olcum/route.ts ile aynı — kpi.manage ∨ müdür koltuğu (requireKpiYaz). Aylık ölçümle
// aynı tabloya bakan bir veri girişi, guard'ı da aynı olmak zorunda.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await requireKpiYaz(id)
  if (error) return error

  const body = await request.json()

  const alanId = typeof body.alanId === 'string' ? body.alanId : ''
  const year = Number(body.year)
  const month = Number(body.month)
  if (!alanId || !year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Geçerli alan/yıl/ay girin' }, { status: 400 })
  }

  const alan = await prisma.kPIOzelAlan.findUnique({ where: { id: alanId }, select: { kpiId: true } })
  if (!alan || alan.kpiId !== id) {
    return NextResponse.json({ error: 'Alan bulunamadı' }, { status: 404 })
  }

  const value = body.value === '' || body.value == null ? null : Number(body.value)
  const naMi = body.naMi === true

  const deger = await prisma.kPIOzelAlanDegeri.upsert({
    where: { alanId_year_month: { alanId, year, month } },
    update: { value, naMi },
    create: { alanId, year, month, value, naMi },
  })

  return NextResponse.json({ deger })
}
