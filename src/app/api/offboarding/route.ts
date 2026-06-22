import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { OffboardingCreateSchema } from '@/lib/offboarding/offboarding-validators'
import { generateNextFormNo } from '@/lib/offboarding/offboarding-form-no'
import { DEFAULT_ASSET_ITEMS, DEFAULT_ACCESS_ITEMS } from '@/lib/offboarding/defaults'
import { Prisma, OffboardingStatus } from '@/generated/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/offboarding
 *
 * Filter: status, q (adSoyad/sicilNo/formNo contains, case-insensitive),
 *         page, pageSize.
 * Item'ların tam listesi DÖNMEZ — sadece _count.
 * Auth: offboarding.view.
 */
export async function GET(request: NextRequest) {
  const { error } = await requirePermission('offboarding.view')
  if (error) return error

  const { searchParams } = new URL(request.url)
  const statusParam = searchParams.get('status')?.trim()
  const q = searchParams.get('q')?.trim()
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)))

  const where: Prisma.OffboardingFormWhereInput = {}
  if (
    statusParam === OffboardingStatus.DRAFT ||
    statusParam === OffboardingStatus.IN_PROGRESS ||
    statusParam === OffboardingStatus.COMPLETED
  ) {
    where.status = statusParam
  }
  if (q) {
    where.OR = [
      { adSoyad: { contains: q, mode: 'insensitive' } },
      { sicilNo: { contains: q, mode: 'insensitive' } },
      { formNo: { contains: q, mode: 'insensitive' } },
    ]
  }

  const [data, total] = await Promise.all([
    prisma.offboardingForm.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        formNo: true,
        adSoyad: true,
        sicilNo: true,
        departman: true,
        gorev: true,
        ayrilisTarihi: true,
        personelTuru: true,
        ayrilisTuru: true,
        status: true,
        beyanOnay: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { assetItems: true, accessItems: true } },
      },
    }),
    prisma.offboardingForm.count({ where }),
  ])

  return NextResponse.json({ data, total, page, pageSize })
}

/**
 * POST /api/offboarding
 *
 * Body: OffboardingCreateSchema. Server akışı (tek $transaction):
 *   a. pg_advisory_xact_lock ile atomik formNo üret (ZI-YYYY-NNNNN)
 *   b. OffboardingForm create (status DRAFT, createdById = session DB user)
 *   c. DEFAULT_ASSET_ITEMS + DEFAULT_ACCESS_ITEMS → child satırları createMany
 * Auth: offboarding.create.
 */
export async function POST(request: NextRequest) {
  const { session, error } = await requirePermission('offboarding.create')
  if (error) return error

  let parsed
  try {
    const json = await request.json()
    parsed = OffboardingCreateSchema.safeParse(json)
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

  // personnelId verilmişse Personnel var mı doğrula
  if (body.personnelId) {
    const personnel = await prisma.personnel.findUnique({
      where: { id: body.personnelId },
      select: { id: true },
    })
    if (!personnel) {
      return NextResponse.json({ error: 'Personel bulunamadı' }, { status: 400 })
    }
  }

  const year = new Date().getFullYear()

  try {
    const created = await prisma.$transaction(async (tx) => {
      const formNo = await generateNextFormNo(year, tx)

      const form = await tx.offboardingForm.create({
        data: {
          formNo,
          personnelId: body.personnelId ?? null,
          adSoyad: body.adSoyad,
          sicilNo: body.sicilNo ?? null,
          departman: body.departman ?? null,
          gorev: body.gorev ?? null,
          iseGirisTarihi: body.iseGirisTarihi ? new Date(body.iseGirisTarihi) : null,
          ayrilisTarihi: new Date(body.ayrilisTarihi),
          personelTuru: body.personelTuru,
          ayrilisTuru: body.ayrilisTuru,
          notes: body.notes ?? null,
          status: OffboardingStatus.DRAFT,
          createdById: session.user.id,
        },
      })

      await tx.offboardingAssetItem.createMany({
        data: DEFAULT_ASSET_ITEMS.map((it) => ({
          formId: form.id,
          sira: it.sira,
          label: it.label,
        })),
      })
      await tx.offboardingAccessItem.createMany({
        data: DEFAULT_ACCESS_ITEMS.map((it) => ({
          formId: form.id,
          sira: it.sira,
          label: it.label,
        })),
      })

      return tx.offboardingForm.findUnique({
        where: { id: form.id },
        include: {
          assetItems: { orderBy: { sira: 'asc' } },
          accessItems: { orderBy: { sira: 'asc' } },
        },
      })
    })

    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    // formNo unique çakışması (advisory-lock'a rağmen teorik yarış) → 409
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: 'Form numarası çakışması, tekrar deneyin' }, { status: 409 })
    }
    console.error('[POST /api/offboarding]', err)
    return NextResponse.json({ error: 'Form oluşturulamadı' }, { status: 500 })
  }
}
