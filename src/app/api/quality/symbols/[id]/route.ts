import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { SymbolPatchSchema } from '@/lib/quality/quality-validators'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/quality/symbols/[id]
 *
 * Sembol günceller. System (isSystem=true) sembollerde yalnızca
 * nameTr / nameEn / displayOrder editlenebilir; svgContent/active
 * değişiklik isteği 400 ile reddedilir (key zaten patch payload'da yok).
 *
 * Auth: quality.symbol.manage
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePermission('quality.symbol.manage')
  if (error) return error

  const { id } = await params

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 })
  }

  const parsed = SymbolPatchSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Geçersiz girdi', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const existing = await prisma.qualitySymbol.findUnique({
    where: { id },
    select: { id: true, isSystem: true },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Sembol bulunamadı' }, { status: 404 })
  }

  // System sembol koruması: yalnızca nameTr/nameEn/displayOrder izinli
  if (existing.isSystem) {
    if (
      parsed.data.svgContent !== undefined ||
      parsed.data.active !== undefined
    ) {
      return NextResponse.json(
        {
          error:
            'Standart sembolde yalnızca etiket (nameTr/nameEn) ve sıralama değiştirilebilir',
        },
        { status: 400 },
      )
    }
  }

  const updated = await prisma.qualitySymbol.update({
    where: { id },
    data: parsed.data,
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

  return NextResponse.json({ symbol: updated })
}

/**
 * DELETE /api/quality/symbols/[id]
 *
 * Soft-delete (active=false). System sembol silinemez (403).
 * Hard-delete YOK — mevcut Template/Report karakterleri sembole referans veriyor;
 * silinen sembol relation onDelete: SetNull ile temizlenirdi ama tarihsel
 * tutarlılık için soft-delete tercih edildi.
 *
 * Auth: quality.symbol.manage
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePermission('quality.symbol.manage')
  if (error) return error

  const { id } = await params

  const existing = await prisma.qualitySymbol.findUnique({
    where: { id },
    select: { id: true, isSystem: true, active: true },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Sembol bulunamadı' }, { status: 404 })
  }
  if (existing.isSystem) {
    return NextResponse.json(
      { error: 'Standart sembol silinemez' },
      { status: 403 },
    )
  }
  if (!existing.active) {
    return NextResponse.json({ ok: true, alreadyInactive: true })
  }

  await prisma.qualitySymbol.update({
    where: { id },
    data: { active: false },
  })

  return NextResponse.json({ ok: true })
}
