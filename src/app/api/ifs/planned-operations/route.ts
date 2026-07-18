import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-permission'
import { getIfsConfig } from '@/lib/ifs/config'
import { getPlannedOperations } from '@/lib/ifs/shop-floor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/ifs/planned-operations?selection=EXECUTABLE|RELEASED&workCenter=&resource=&laborClass=&partNo=
 *
 * IFS ShopFloorService.GetPlannedOperations'ı çağırır → OperationId listesi döner.
 * Terminal "açık işler" listesi için. SADECE OKUMA.
 *
 * Yetki: admin.system.manage (operation-summary ile aynı; bkz. `uretim.bildirim` TODO).
 */
const QuerySchema = z.object({
  selection: z.enum(['EXECUTABLE', 'RELEASED']),
  workCenter: z.string().optional(),
  resource: z.string().optional(),
  laborClass: z.string().optional(),
  partNo: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const { error } = await requirePermission('uretim.bildirim')
  if (error) return error

  const { searchParams } = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    selection: searchParams.get('selection') ?? undefined,
    workCenter: searchParams.get('workCenter') ?? undefined,
    resource: searchParams.get('resource') ?? undefined,
    laborClass: searchParams.get('laborClass') ?? undefined,
    partNo: searchParams.get('partNo') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Geçersiz parametre: ' +
          parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; '),
      },
      { status: 400 },
    )
  }

  try {
    const config = getIfsConfig()
    const operationIds = await getPlannedOperations({
      contract: config.contract,
      selection: parsed.data.selection,
      workCenter: parsed.data.workCenter ?? null,
      resource: parsed.data.resource ?? null,
      laborClass: parsed.data.laborClass ?? null,
      partNo: parsed.data.partNo ?? null,
    })
    return NextResponse.json({ ok: true, operationIds })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
