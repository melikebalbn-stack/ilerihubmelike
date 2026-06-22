import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import {
  OffboardingPatchSchema,
  isValidStatusTransition,
  canComplete,
} from '@/lib/offboarding/offboarding-validators'
import { Prisma } from '@/generated/prisma'

export const dynamic = 'force-dynamic'

interface Ctx {
  params: Promise<{ id: string }>
}

/**
 * GET /api/offboarding/[id]
 *
 * Form + assetItems (sira asc) + accessItems (sira asc). Auth: offboarding.view.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { error } = await requirePermission('offboarding.view')
  if (error) return error

  const { id } = await params
  const form = await prisma.offboardingForm.findUnique({
    where: { id },
    include: {
      assetItems: { orderBy: { sira: 'asc' } },
      accessItems: { orderBy: { sira: 'asc' } },
      personnel: { select: { id: true, adSoyad: true, sicilNo: true } },
      teslimAlan: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  })
  if (!form) return NextResponse.json({ error: 'Form bulunamadı' }, { status: 404 })
  return NextResponse.json(form)
}

/**
 * PATCH /api/offboarding/[id]
 *
 * Kısmi güncelleme: header alanları + status (geçerli ileri geçişler) +
 * item güncellemeleri (assetItems/accessItems — id form'a ait olmalı).
 * Tümü tek $transaction içinde uygulanır. Auth: offboarding.edit.
 */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { error } = await requirePermission('offboarding.edit')
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
      assetItems: { select: { id: true } },
      accessItems: { select: { id: true } },
    },
  })
  if (!existing) return NextResponse.json({ error: 'Form bulunamadı' }, { status: 404 })

  let parsed
  try {
    const json = await request.json()
    parsed = OffboardingPatchSchema.safeParse(json)
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 })
  }
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation hatası', detail: parsed.error.format() },
      { status: 400 },
    )
  }
  const body = parsed.data

  // Status geçişi doğrulama
  if (body.status && body.status !== existing.status) {
    if (!isValidStatusTransition(existing.status, body.status)) {
      return NextResponse.json(
        { error: `Geçersiz durum geçişi: ${existing.status} → ${body.status}` },
        { status: 400 },
      )
    }
    if (body.status === 'COMPLETED') {
      const effective = {
        beyanOnay: body.beyanOnay ?? existing.beyanOnay,
        hazirlayanId: existing.hazirlayanId,
        onaylayan1Id: existing.onaylayan1Id,
      }
      if (!canComplete(effective)) {
        return NextResponse.json(
          { error: 'Tamamlama için beyan onayı, hazırlayan ve 1. onaylayan gerekli' },
          { status: 400 },
        )
      }
    }
  }

  // personnelId verilmişse (null değilse) Personnel doğrula
  if (body.personnelId) {
    const personnel = await prisma.personnel.findUnique({
      where: { id: body.personnelId },
      select: { id: true },
    })
    if (!personnel) {
      return NextResponse.json({ error: 'Personel bulunamadı' }, { status: 400 })
    }
  }

  // teslimAlanId verilmişse (null değilse) User doğrula
  if (body.teslimAlanId) {
    const user = await prisma.user.findUnique({
      where: { id: body.teslimAlanId },
      select: { id: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'Teslim alan kullanıcı bulunamadı' }, { status: 400 })
    }
  }

  // Item ownership doğrulama — verilen her id bu forma ait olmalı
  const assetIds = new Set(existing.assetItems.map((i) => i.id))
  const accessIds = new Set(existing.accessItems.map((i) => i.id))
  if (body.assetItems) {
    const bad = body.assetItems.find((i) => !assetIds.has(i.id))
    if (bad) {
      return NextResponse.json(
        { error: `Varlık kalemi bu forma ait değil: ${bad.id}` },
        { status: 404 },
      )
    }
  }
  if (body.accessItems) {
    const bad = body.accessItems.find((i) => !accessIds.has(i.id))
    if (bad) {
      return NextResponse.json(
        { error: `Yetki kalemi bu forma ait değil: ${bad.id}` },
        { status: 404 },
      )
    }
  }

  // Header update data (undefined = dokunma, null = temizle)
  const data: Prisma.OffboardingFormUpdateInput = {}
  if (body.adSoyad !== undefined) data.adSoyad = body.adSoyad
  if (body.sicilNo !== undefined) data.sicilNo = body.sicilNo
  if (body.departman !== undefined) data.departman = body.departman
  if (body.gorev !== undefined) data.gorev = body.gorev
  if (body.iseGirisTarihi !== undefined)
    data.iseGirisTarihi = body.iseGirisTarihi === null ? null : new Date(body.iseGirisTarihi)
  if (body.ayrilisTarihi !== undefined) data.ayrilisTarihi = new Date(body.ayrilisTarihi)
  if (body.personelTuru !== undefined) data.personelTuru = body.personelTuru
  if (body.ayrilisTuru !== undefined) data.ayrilisTuru = body.ayrilisTuru
  if (body.teslimEdenAd !== undefined) data.teslimEdenAd = body.teslimEdenAd
  if (body.beyanOnay !== undefined) data.beyanOnay = body.beyanOnay
  if (body.notes !== undefined) data.notes = body.notes
  if (body.status !== undefined) data.status = body.status
  if (body.personnelId !== undefined)
    data.personnel = body.personnelId === null
      ? { disconnect: true }
      : { connect: { id: body.personnelId } }
  if (body.teslimAlanId !== undefined)
    data.teslimAlan = body.teslimAlanId === null
      ? { disconnect: true }
      : { connect: { id: body.teslimAlanId } }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.offboardingForm.update({ where: { id }, data })

    for (const it of body.assetItems ?? []) {
      await tx.offboardingAssetItem.update({
        where: { id: it.id },
        data: {
          returned: it.returned,
          notApplicable: it.notApplicable,
          note: it.note,
        },
      })
    }
    for (const it of body.accessItems ?? []) {
      await tx.offboardingAccessItem.update({
        where: { id: it.id },
        data: {
          revoked: it.revoked,
          revokedAt:
            it.revokedAt === undefined
              ? undefined
              : it.revokedAt === null
                ? null
                : new Date(it.revokedAt),
          appliedBy: it.appliedBy,
        },
      })
    }

    return tx.offboardingForm.findUnique({
      where: { id },
      include: {
        assetItems: { orderBy: { sira: 'asc' } },
        accessItems: { orderBy: { sira: 'asc' } },
      },
    })
  })

  return NextResponse.json(updated)
}

/**
 * DELETE /api/offboarding/[id]
 *
 * Child satırları onDelete: Cascade ile düşer. Auth: offboarding.delete.
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { error } = await requirePermission('offboarding.delete')
  if (error) return error

  const { id } = await params
  const existing = await prisma.offboardingForm.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!existing) return NextResponse.json({ error: 'Form bulunamadı' }, { status: 404 })

  await prisma.offboardingForm.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
