import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import {
  OffboardingApproveSchema,
  canComplete,
} from '@/lib/offboarding/offboarding-validators'
import { Prisma, OffboardingStatus } from '@/generated/prisma'

export const dynamic = 'force-dynamic'

interface Ctx {
  params: Promise<{ id: string }>
}

/**
 * POST /api/offboarding/[id]/approve
 *
 * Elektronik onay: seçilen onay alanına (hazirlayanId/onaylayan1Id/onaylayan2Id)
 * acting kullanıcının DB User.id'si yazılır. Form IN_PROGRESS ve tamamlanma
 * koşulları (beyan onayı + hazırlayan + 1. onaylayan) sağlanıyorsa status
 * otomatik COMPLETED'a geçer (KALITE-2 finalize mantığına analog).
 *
 * Tamamlanmış (COMPLETED) form yeniden onaylanamaz → 400.
 * Auth: offboarding.approve (OR semantiği destekli).
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { session, error } = await requirePermission(['offboarding.approve'])
  if (error) return error

  const { id } = await params
  const existing = await prisma.offboardingForm.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      beyanOnay: true,
      hazirlayanId: true,
      onaylayan1Id: true,
    },
  })
  if (!existing) return NextResponse.json({ error: 'Form bulunamadı' }, { status: 404 })
  if (existing.status === OffboardingStatus.COMPLETED) {
    return NextResponse.json({ error: 'Form tamamlanmış, yeniden onaylanamaz' }, { status: 400 })
  }

  let parsed
  try {
    const json = await request.json()
    parsed = OffboardingApproveSchema.safeParse(json)
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 })
  }
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation hatası', detail: parsed.error.format() },
      { status: 400 },
    )
  }
  const { field } = parsed.data
  const actingUserId = session.user.id

  // Seçilen onay alanına acting user'ı yaz (type-safe atama)
  const data: Prisma.OffboardingFormUpdateInput = {}
  if (field === 'hazirlayanId') data.hazirlayanId = actingUserId
  else if (field === 'onaylayan1Id') data.onaylayan1Id = actingUserId
  else data.onaylayan2Id = actingUserId

  // Bu onaydan sonraki etkin değerlerle tamamlanma kontrolü
  const after = {
    beyanOnay: existing.beyanOnay,
    hazirlayanId: field === 'hazirlayanId' ? actingUserId : existing.hazirlayanId,
    onaylayan1Id: field === 'onaylayan1Id' ? actingUserId : existing.onaylayan1Id,
  }
  if (existing.status === OffboardingStatus.IN_PROGRESS && canComplete(after)) {
    data.status = OffboardingStatus.COMPLETED
  }

  const updated = await prisma.offboardingForm.update({
    where: { id },
    data,
    include: {
      assetItems: { orderBy: { sira: 'asc' } },
      accessItems: { orderBy: { sira: 'asc' } },
    },
  })

  return NextResponse.json(updated)
}
