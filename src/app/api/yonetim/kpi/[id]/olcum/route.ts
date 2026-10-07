import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireKpiYaz } from '@/lib/yonetim/kpi-yetki'

export const dynamic = 'force-dynamic'

// POST: aylık hedef/gerçekleşen ölçüm upsert'i. Veri değiştirir → kpi.manage ∨ müdür koltuğu
// (KPI'nın departmanı koltuk ağacında; requireKpiYaz 403/404 döner).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await requireKpiYaz(id)
  if (error) return error

  const body = await request.json()

  const year = Number(body.year)
  const month = Number(body.month)
  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Geçerli yıl/ay girin' }, { status: 400 })
  }

  const target = body.target === '' || body.target == null ? null : Number(body.target)
  const actual = body.actual === '' || body.actual == null ? null : Number(body.actual)
  const hedefNA = body.hedefNA === true
  const gerceklesenNA = body.gerceklesenNA === true
  const manuelOran = body.manuelOran === '' || body.manuelOran == null ? null : Number(body.manuelOran)

  // KPI-AYAR: "hedef tutturulamayan KPI'larda aksiyon zorunlu" ayarı açıksa,
  // kırmızı (hedef tutturulamamış) bir ölçüm için en az bir aksiyon şart.
  // N/A işaretli bir ölçümde "tutturulamadı" diye bir durum yok, kontrol atlanır.
  if (target != null && actual != null && !hedefNA && !gerceklesenNA) {
    const ayar = await prisma.systemSetting.findUnique({ where: { key: 'kpi_zorunlu_aksiyon' } })
    if (ayar?.value === 'true') {
      const kpi = await prisma.kPIDefinition.findUnique({ where: { id }, select: { direction: true } })
      const tutuldu = kpi?.direction === 'lower_is_better' ? actual <= target : actual >= target
      if (!tutuldu) {
        const aksiyonSayisi = await prisma.kPIAction.count({ where: { kpiId: id } })
        if (aksiyonSayisi === 0) {
          return NextResponse.json(
            { error: 'Hedef tutturulamadı — kaydetmeden önce en az bir aksiyon eklemelisin.' },
            { status: 400 },
          )
        }
      }
    }
  }

  const olcum = await prisma.kPIMeasurement.upsert({
    where: { kpiId_year_month: { kpiId: id, year, month } },
    update: { target, actual, hedefNA, gerceklesenNA, manuelOran },
    create: { kpiId: id, year, month, target, actual, hedefNA, gerceklesenNA, manuelOran },
  })

  return NextResponse.json({ olcum })
}
