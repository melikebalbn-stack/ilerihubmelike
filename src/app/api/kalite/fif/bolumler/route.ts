import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'

export const dynamic = 'force-dynamic'

/**
 * GET /api/kalite/fif/bolumler — FİF form dropdown'u için aktif bölüm listesi
 * (DepartmentDefinition {id, name}). Auth: oturum (fif.view = herkes; salt id/ad,
 * hassas veri yok). workstations/department-options'un fif.view kapılı ikizi.
 */
export async function GET() {
  const { error } = await requireSession()
  if (error) return error

  const bolumler = await prisma.departmentDefinition.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ bolumler })
}
