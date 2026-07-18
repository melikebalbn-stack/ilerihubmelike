import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { getIfsConfig } from '@/lib/ifs/config'
import { getOperationSummary } from '@/lib/ifs/shop-floor'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ifs/operation-summary?orderNo=&operationNo=&contract=
 *
 * IFS ShopFloorService.GetOperationSummary'yi çağırır ve operatör ekranının
 * ihtiyaç duyduğu temiz JSON'a maple. SADECE OKUMA (PR-A). Yazma yok.
 *
 * Yetki: admin.system.manage (mevcut IFS yüzeyiyle tutarlı). NOT: operatörler
 * için ayrı bir `uretim.bildirim` izni gerekiyor — ayrı PR (bkz. PR raporu).
 */
export async function GET(request: NextRequest) {
  const { error } = await requirePermission('uretim.bildirim')
  if (error) return error

  const { searchParams } = new URL(request.url)
  const orderNo = searchParams.get('orderNo')
  const operationNoRaw = searchParams.get('operationNo')
  const operationIdRaw = searchParams.get('operationId')
  const contractParam = searchParams.get('contract')

  let operationId: number | undefined
  if (operationIdRaw != null && operationIdRaw !== '') {
    operationId = Number(operationIdRaw)
    if (Number.isNaN(operationId)) {
      return NextResponse.json(
        { ok: false, error: 'operationId sayı olmalı' },
        { status: 400 },
      )
    }
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

  // operationId VEYA orderNo(+operationNo) gerekli — mevcut orderNo yolu korunur.
  if (operationId == null && !orderNo) {
    return NextResponse.json(
      { ok: false, error: 'operationId veya orderNo+operationNo gerekli' },
      { status: 400 },
    )
  }

  try {
    const config = getIfsConfig()
    const contract = contractParam || config.contract
    // operationId verildiyse OperationId ile çöz (OrderNo/OperationNo null);
    // yoksa mevcut orderNo+operationNo yolu aynen kalır.
    const raw = (await getOperationSummary(
      operationId != null
        ? { contract, operationId }
        : { contract, orderNo: orderNo!, operationNo },
    )) as Record<string, unknown>

    const num = (v: unknown): number | null => (v == null || v === '' ? null : Number(v))
    const str = (v: unknown): string | null => (v == null ? null : String(v))

    const summary = {
      // IFS başarı durumunda bile OrderNo/OperationNo/OperationId'yi NULL döndürür →
      // bunları cevaptan DEĞİL, İSTEK parametrelerinden dolduruyoruz.
      orderNo: orderNo ?? null,
      operationNo: operationNo ?? null,
      operationId: operationId ?? null,
      description: str(raw.Description),
      status: str(raw.Status),
      partNo: str(raw.PartNo),
      plannedQty: num(raw.PlannedQty),
      executableQty: num(raw.ExecutableQty),
      remainingQty: num(raw.RemainingQty),
      qtyCompleted: num(raw.QtyCompleted),
      qtyScrapped: num(raw.QtyScrapped),
    }

    // "found" kararı DOLU gelen alanlara bağlanır (OrderNo/OperationId başarıda da
    // null geldiği için onlara BAKILMAZ). Gerçekten boş op'ta bunlar da null → false.
    const found =
      raw.PartNo != null || raw.Status != null || raw.PlannedQty != null

    return NextResponse.json({ ok: true, found, summary })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
