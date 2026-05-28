import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'

export const dynamic = 'force-dynamic'

/**
 * GET /api/quality/symbols
 *
 * Aktif GD&T sembollerini displayOrder'a göre listeler. UI dropdown'larında
 * kullanılır. Herhangi bir oturum açmış kullanıcı çekebilir (read-only).
 */
export async function GET() {
  const { error } = await requireUser()
  if (error) return error

  const symbols = await prisma.qualitySymbol.findMany({
    where: { active: true },
    orderBy: { displayOrder: 'asc' },
    select: {
      id: true,
      key: true,
      nameTr: true,
      nameEn: true,
      svgContent: true,
      displayOrder: true,
    },
  })

  return NextResponse.json({ symbols })
}
