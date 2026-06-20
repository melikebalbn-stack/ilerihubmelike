import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-permission'
import { prisma } from '@/lib/prisma'
import {
  reportQuantityComplete,
  reportQuantityScrap,
} from '@/lib/ifs/shop-floor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/ifs/report-operation
 *
 * Üretim terminali → IFS ShopFloorService'e miktar bildirimi (complete | scrap).
 * Operatör kimliği body'deki sicilNo'dan; OperationId-only (B1 nested wrapper).
 *
 * Yetki: uretim.bildirim. Body Zod ile doğrulanır; Personnel.sicilNo geçersizse
 * IFS'e GİTMEDEN 400. IFS Executed=FALSE → wrapper throw → 502.
 */
const BodySchema = z
  .object({
    operationId: z.coerce.number().int(),
    type: z.enum(['complete', 'scrap']),
    qty: z.number().positive(),
    scrapReason: z.string().min(1).optional(),
    closeOperation: z.boolean().default(false),
    sicilNo: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'scrap' && !data.scrapReason) {
      ctx.addIssue({
        code: 'custom',
        path: ['scrapReason'],
        message: 'scrapReason zorunlu',
      })
    }
  })

export async function POST(request: NextRequest) {
  const { error } = await requirePermission('uretim.bildirim')
  if (error) return error

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Geçersiz JSON gövdesi' },
      { status: 400 },
    )
  }

  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Geçersiz veri: ' +
          parsed.error.issues
            .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
            .join('; '),
      },
      { status: 400 },
    )
  }
  const { operationId, type, qty, scrapReason, closeOperation, sicilNo } =
    parsed.data

  // Personel doğrulama — IFS'e GİTMEDEN. sicilNo @unique.
  const personnel = await prisma.personnel.findUnique({
    where: { sicilNo },
    select: { id: true },
  })
  if (!personnel) {
    return NextResponse.json(
      { ok: false, error: 'Geçersiz sicil' },
      { status: 400 },
    )
  }

  const operation = { OperationId: operationId, ReleaseNo: '*', SequenceNo: '*' }
  const employee = { Company: 'ILERI2', EmployeeId: sicilNo }

  try {
    if (type === 'complete') {
      await reportQuantityComplete({
        operation,
        qtyComplete: qty,
        closeOperation,
        employee,
      })
    } else {
      await reportQuantityScrap({
        operation,
        qtyScrapped: qty,
        scrapReason: scrapReason!,
        closeOperation,
        employee,
      })
    }
    return NextResponse.json({ ok: true, executed: true, operationId, type, qty })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
