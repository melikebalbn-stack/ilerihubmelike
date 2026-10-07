import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma'
import { formulGecerliMi, type FormulTanimi } from '../formul-motoru'

// KPI-OZEL-ALAN: gelen {key, label, formul} listesini normalize eder — key boşsa label'dan
// üretilir, çakışma olursa _2, _3... eklenir (bkz. ../route.ts'teki aynı fonksiyon).
function ozelAlanlariNormalize(input: unknown): { key: string; label: string; formul: FormulTanimi | null }[] {
  if (!Array.isArray(input)) return []
  const kullanilanKeyler = new Set<string>()
  const sonuc: { key: string; label: string; formul: FormulTanimi | null }[] = []
  for (const ham of input as { key?: string; label?: string; formul?: unknown }[]) {
    const label = typeof ham?.label === 'string' ? ham.label.trim() : ''
    if (!label) continue
    const temelKey = typeof ham?.key === 'string' && ham.key.trim()
      ? ham.key.trim()
      : label.toLocaleLowerCase('tr').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'alan'
    let key = temelKey
    let i = 2
    while (kullanilanKeyler.has(key)) { key = `${temelKey}_${i}`; i++ }
    kullanilanKeyler.add(key)
    sonuc.push({ key, label, formul: formulGecerliMi(ham?.formul) ? ham.formul : null })
  }
  return sonuc
}

function formulAlaninaGetir(input: unknown): FormulTanimi | null {
  return formulGecerliMi(input) ? input : null
}

// Prisma'nın Json? alanları update'te açıkça Prisma.JsonNull bekliyor (plain null, alanı temizlemez).
function formulJsonDegeri(f: FormulTanimi | null): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return f == null ? Prisma.JsonNull : (f as unknown as Prisma.InputJsonValue)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return NextResponse.json({ error: 'KPI adı zorunludur' }, { status: 400 })
  }

  const oranPayKaynagi = typeof body.oranPayKaynagi === 'string' && body.oranPayKaynagi.trim()
    ? body.oranPayKaynagi.trim()
    : 'actual'
  const ortalamaKaynagi = typeof body.ortalamaKaynagi === 'string' && body.ortalamaKaynagi.trim()
    ? body.ortalamaKaynagi.trim()
    : 'actual'
  const oranBirimi = body.oranBirimi === 'kat' ? 'kat' : 'yuzde'
  const yuzdeOlcek = body.yuzdeOlcek === 'dogrudan' ? 'dogrudan' : 'oran'
  const gerceklesenFormul = formulAlaninaGetir(body.gerceklesenFormul)
  const hedefFormul = formulAlaninaGetir(body.hedefFormul)
  const gelenAlanlar = ozelAlanlariNormalize(body.ozelAlanlar)
  const mevcutAlanlar = await prisma.kPIOzelAlan.findMany({ where: { kpiId: id }, select: { id: true, key: true } })
  const gelenKeyler = new Set(gelenAlanlar.map(a => a.key))
  const silinecekler = mevcutAlanlar.filter(a => !gelenKeyler.has(a.key))
  const mevcutKeyHaritasi = new Map(mevcutAlanlar.map(a => [a.key, a.id]))

  const [kpi] = await prisma.$transaction([
    prisma.kPIDefinition.update({
      where: { id },
      data: {
        name,
        unit: typeof body.unit === 'string' && body.unit.trim() ? body.unit.trim() : null,
        direction: body.direction === 'lower_is_better' ? 'lower_is_better' : 'higher_is_better',
        frequency: body.frequency === 'quarterly' ? 'quarterly' : 'monthly',
        gerceklesenEtiketi: typeof body.gerceklesenEtiketi === 'string' && body.gerceklesenEtiketi.trim() ? body.gerceklesenEtiketi.trim() : 'Gerçekleşen',
        hedefEtiketi: typeof body.hedefEtiketi === 'string' && body.hedefEtiketi.trim() ? body.hedefEtiketi.trim() : 'Hedef',
        oranYonu: body.oranYonu === 'H_G' ? 'H_G' : 'G_H',
        oranBirimi,
        yuzdeOlcek,
        oranPayKaynagi,
        ortalamaKaynagi,
        gerceklesenFormul: formulJsonDegeri(gerceklesenFormul),
        hedefFormul: formulJsonDegeri(hedefFormul),
      },
    }),
    ...(silinecekler.length > 0
      ? [prisma.kPIOzelAlan.deleteMany({ where: { id: { in: silinecekler.map(a => a.id) } } })]
      : []),
    ...gelenAlanlar.map((a, i) => {
      const mevcutId = mevcutKeyHaritasi.get(a.key)
      return mevcutId
        ? prisma.kPIOzelAlan.update({ where: { id: mevcutId }, data: { label: a.label, siraNo: i, formul: formulJsonDegeri(a.formul) } })
        : prisma.kPIOzelAlan.create({ data: { kpiId: id, key: a.key, label: a.label, siraNo: i, formul: a.formul != null ? (a.formul as unknown as Prisma.InputJsonValue) : undefined } })
    }),
  ])

  return NextResponse.json({ kpi })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // KPIMeasurement / KPIYearlyBaseline / KPIAction, KPIDefinition'a onDelete: Cascade ile bağlı —
  // bu satırı silmek hepsini birlikte siler.
  await prisma.kPIDefinition.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
