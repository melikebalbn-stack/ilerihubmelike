import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// KPI-YIL-SIL: "Dönem Karşılaştır" ile yanlışlıkla açılan ya da hiç gerek kalmayan bir yılın
// TÜM verisini (aylık ölçümler, özel alan değerleri, elle girilmiş ortalama) geri alınamaz şekilde
// siler — Melike'nin "yeni yıl eklediim silemiyorum silebilmem lazım" isteği.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; year: string }> }) {
  const { id, year: yearParam } = await params
  const year = Number(yearParam)
  if (!year) {
    return NextResponse.json({ error: 'Geçerli bir yıl girin' }, { status: 400 })
  }

  await prisma.$transaction([
    prisma.kPIMeasurement.deleteMany({ where: { kpiId: id, year } }),
    prisma.kPIYearlyBaseline.deleteMany({ where: { kpiId: id, year } }),
    prisma.kPIOzelAlanDegeri.deleteMany({ where: { year, alan: { kpiId: id } } }),
  ])

  return NextResponse.json({ ok: true })
}
