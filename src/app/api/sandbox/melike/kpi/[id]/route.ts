import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // KPIMeasurement / KPIYearlyBaseline / KPIAction, KPIDefinition'a onDelete: Cascade ile bağlı —
  // bu satırı silmek hepsini birlikte siler.
  await prisma.kPIDefinition.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
