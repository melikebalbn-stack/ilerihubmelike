import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// KPI-OZEL-ALAN: Gerçekleşen/Hedef dışındaki özel alanların (Gelen/Çözülen/Toplam gibi) aylık
// değerini kaydeder. [id] burada KPIDefinition.id, ama asıl kayıt KPIOzelAlanDegeri'ne gider —
// alanın (KPIOzelAlan) gerçekten bu KPI'ya ait olduğu doğrulanır ki başka bir KPI'nın alanına
// yanlışlıkla yazılmasın.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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
