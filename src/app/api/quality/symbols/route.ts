import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { requirePermission } from '@/lib/auth/require-permission'
import { SymbolCreateSchema } from '@/lib/quality/quality-validators'
import { Prisma } from '@/generated/prisma'

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

/**
 * POST /api/quality/symbols
 *
 * Yeni özel (custom) sembol oluşturur. Standart (isSystem=true) sembol POST ile
 * oluşturulamaz — yeni kayıt daima isSystem=false.
 *
 * Auth: quality.symbol.manage
 */
export async function POST(request: NextRequest) {
  const { error, userId } = await requirePermission('quality.symbol.manage')
  if (error) return error

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 })
  }

  const parsed = SymbolCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Geçersiz girdi', details: parsed.error.issues },
      { status: 400 },
    )
  }

  try {
    const created = await prisma.qualitySymbol.create({
      data: {
        key: parsed.data.key,
        nameTr: parsed.data.nameTr,
        nameEn: parsed.data.nameEn,
        svgContent: parsed.data.svgContent,
        displayOrder: parsed.data.displayOrder ?? 0,
        isSystem: false,
        active: true,
        createdById: userId,
      },
      select: {
        id: true,
        key: true,
        nameTr: true,
        nameEn: true,
        svgContent: true,
        displayOrder: true,
        active: true,
        isSystem: true,
      },
    })
    return NextResponse.json({ symbol: created }, { status: 201 })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json(
        { error: 'Bu anahtar (key) zaten kullanımda' },
        { status: 409 },
      )
    }
    console.error('[quality/symbols POST] failed:', e)
    return NextResponse.json({ error: 'Sembol oluşturulamadı' }, { status: 500 })
  }
}
