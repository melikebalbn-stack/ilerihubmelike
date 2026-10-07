import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { formulGecerliMi } from '../../formul-motoru'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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

  // KPI-FORMUL: Gerçekleşen ya da Hedef formülden hesaplanıyorsa elle girilen değer (varsa)
  // yok sayılır — arayüz o alanı zaten salt-okunur gösteriyor (bkz. kpi/page.tsx), bu sadece
  // ikinci bir güvenlik katmanı. Diğer alan (formülsüz olan) normal şekilde kaydedilmeye devam eder.
  const kpiFormulKontrol = await prisma.kPIDefinition.findUnique({
    where: { id }, select: { gerceklesenFormul: true, hedefFormul: true },
  })
  const gerceklesenFormulluMu = !!kpiFormulKontrol && formulGecerliMi(kpiFormulKontrol.gerceklesenFormul)
  const hedefFormulluMu = !!kpiFormulKontrol && formulGecerliMi(kpiFormulKontrol.hedefFormul)

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

  let kaydedilecekTarget = target
  let kaydedilecekActual = actual
  if (gerceklesenFormulluMu || hedefFormulluMu) {
    const oncekiOlcum = await prisma.kPIMeasurement.findUnique({ where: { kpiId_year_month: { kpiId: id, year, month } } })
    if (gerceklesenFormulluMu) kaydedilecekActual = oncekiOlcum?.actual ?? null
    if (hedefFormulluMu) kaydedilecekTarget = oncekiOlcum?.target ?? null
  }

  const olcum = await prisma.kPIMeasurement.upsert({
    where: { kpiId_year_month: { kpiId: id, year, month } },
    update: { target: kaydedilecekTarget, actual: kaydedilecekActual, hedefNA, gerceklesenNA, manuelOran },
    create: { kpiId: id, year, month, target: kaydedilecekTarget, actual: kaydedilecekActual, hedefNA, gerceklesenNA, manuelOran },
  })

  return NextResponse.json({ olcum })
}
