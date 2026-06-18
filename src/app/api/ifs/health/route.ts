import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { getIfsConfig } from '@/lib/ifs/config'
import { getOperationSummary } from '@/lib/ifs/shop-floor'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ifs/health?orderNo=...&operationNo=...
 *
 * IFS Cloud bağlantı doğrulaması (sadece test): token alır + GetOperationSummary
 * çağırır. UI yok. Yetki: admin.system.manage.
 */
export async function GET(request: NextRequest) {
  const { error } = await requirePermission(PERMISSION_KEYS.ADMIN_SYSTEM_MANAGE)
  if (error) return error

  const { searchParams } = new URL(request.url)
  const orderNo = searchParams.get('orderNo')
  const operationNoRaw = searchParams.get('operationNo')

  if (!orderNo) {
    return NextResponse.json(
      { ok: false, error: 'orderNo query parametresi zorunlu' },
      { status: 400 },
    )
  }

  let operationNo: number | undefined
  if (operationNoRaw != null && operationNoRaw !== '') {
    operationNo = Number(operationNoRaw)
    if (Number.isNaN(operationNo)) {
      return NextResponse.json(
        { ok: false, error: 'operationNo sayı olmalı' },
        { status: 400 },
      )
    }
  }

  try {
    const config = getIfsConfig()
    const summary = await getOperationSummary({
      contract: config.contract,
      orderNo,
      operationNo,
    })
    return NextResponse.json({ ok: true, summary })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
