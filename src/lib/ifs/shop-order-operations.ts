import 'server-only'
import { getIfsConfig } from './config'
import { getIfsAccessToken } from './token'
import type { IfsShopOrderOperation, IfsOperationStatus } from './types'

/**
 * ShopOrderOperationsHandling okuma katmanı (E1). SERVER-ONLY.
 *
 * Kaynak: IFS Cloud standart projeksiyonu `ShopOrderOperationsHandling` →
 * `ShopOrderOperations` entity'si. Bu entity tek sorguda OrderNo + OperationNo +
 * PartNo + PartDescription + WorkCenterNo + miktarlar + RevisedDueDate + durum
 * veriyor (custom ShopFloorService'in veremediği stok adı/teslim tarihi dahil).
 *
 * Auth/token: shop-floor.ts'in kullandığı mevcut yapıyı (config + token helper'ı)
 * REUSE eder — token akışı kopyalanmaz. Tek fark: bu projeksiyon `ShopFloorService`
 * gibi `/int/` değil `/main/` gateway'inde; ifsGetFunction ShopFloorService.svc'e
 * sabit olduğundan burada ana-gateway URL'i türetilip getIfsAccessToken ile GET edilir.
 *
 * SADECE OKUMA (GET). Hiçbir yazma/aksiyon yok.
 */

// OperStatusCode bir OData enum'dur (Edm.String DEĞİL). Filtrede düz string literal
// ('Closed') 400 TYPES_NOT_COMPATIBLE verir; enum tam-nitelikli üye literali gerekir.
const OPER_STATUS_ENUM = 'IfsApp.ShopOrderOperationsHandling.OperStatusCode'

const SELECT_FIELDS = [
  'OrderNo',
  'OperationNo',
  'OperationDescription',
  'PartNo',
  'PartDescription',
  'WorkCenterNo',
  'RevisedQtyDue',
  'QtyComplete',
  'QtyScrapped',
  'RemainingQty',
  'RevisedDueDate',
  'NeedDate',
  'MachRunFactor',
  'LaborRunFactor',
  'RunTimeCode',
  'OperStatusCode',
].join(',')

/** ShopOrderOperations ham kaydı (yalnız $select ile çekilen alanlar). */
interface RawShopOrderOperation {
  OrderNo?: string | null
  OperationNo?: number | null
  OperationDescription?: string | null
  PartNo?: string | null
  PartDescription?: string | null
  WorkCenterNo?: string | null
  RevisedQtyDue?: number | null
  QtyComplete?: number | null
  QtyScrapped?: number | null
  RemainingQty?: number | null
  RevisedDueDate?: string | null
  NeedDate?: string | null
  MachRunFactor?: number | null
  LaborRunFactor?: number | null
  RunTimeCode?: string | null
  OperStatusCode?: string | null
}

/** config.baseUrl (.../int/.../v1/ShopFloorService.svc) → ana gateway kökü (.../main/.../v1/). */
function mainRoot(): string {
  const { baseUrl } = getIfsConfig()
  return baseUrl.replace(/[A-Za-z]+\.svc$/, '').replace('/int/', '/main/')
}

/** OData tek-tırnak string literal escape (içteki ' → ''). */
function esc(value: string): string {
  return value.replace(/'/g, "''")
}

/** ShopOrderOperations entity'sine GET (ana gateway, mevcut token helper'ı ile). */
async function fetchOperations(filter: string, top: number): Promise<RawShopOrderOperation[]> {
  const token = await getIfsAccessToken()
  const url =
    `${mainRoot()}ShopOrderOperationsHandling.svc/ShopOrderOperations` +
    `?$filter=${encodeURIComponent(filter)}&$select=${SELECT_FIELDS}&$top=${top}`

  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  })

  const text = await res.text()
  let body: unknown = text
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    /* JSON değilse ham metin kalır */
  }

  if (!res.ok) {
    const errObj = (body as { error?: { message?: string } })?.error
    const msg =
      errObj?.message ??
      (typeof body === 'string' ? body.slice(0, 300) : `HTTP ${res.status}`)
    throw new Error(`IFS ShopOrderOperations (HTTP ${res.status}): ${msg}`)
  }

  const value = (body as { value?: unknown })?.value
  return Array.isArray(value) ? (value as RawShopOrderOperation[]) : []
}

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Ham kaydı ortak IfsShopOrderOperation sözleşmesine map'ler. */
function toTerminal(r: RawShopOrderOperation): IfsShopOrderOperation {
  const orderNo = r.OrderNo ?? ''
  const operationNo = num(r.OperationNo)
  const kalan = num(r.RemainingQty)
  const durum: IfsOperationStatus =
    r.OperStatusCode === 'Released' && kalan > 0 ? 'ISLENEBILIR' : 'BEKLIYOR'
  return {
    id: `${orderNo}-${operationNo}`,
    isMerkezi: r.WorkCenterNo ?? '',
    isEmriNo: orderNo,
    operasyon: r.OperationDescription ?? '',
    operasyonNo: operationNo,
    stokKodu: r.PartNo ?? '',
    stokAdi: r.PartDescription ?? '',
    // RevisedDueDate/NeedDate DateTimeOffset ("2026-07-03T17:00:00Z") → yyyy-MM-dd.
    teslimTarihi: r.RevisedDueDate ? String(r.RevisedDueDate).slice(0, 10) : '',
    ihtiyacTarihi: r.NeedDate ? String(r.NeedDate).slice(0, 10) : '',
    miktar: num(r.RevisedQtyDue),
    kalanMiktar: kalan,
    uretilenMiktar: num(r.QtyComplete),
    hurdaMiktar: num(r.QtyScrapped),
    machRunFactor: num(r.MachRunFactor),
    laborRunFactor: num(r.LaborRunFactor),
    runTimeCode: r.RunTimeCode ?? '',
    durum,
  }
}

/** teslimTarihi artan; boş tarihler sona. */
function byTeslim(a: IfsShopOrderOperation, b: IfsShopOrderOperation): number {
  if (!a.teslimTarihi && !b.teslimTarihi) return 0
  if (!a.teslimTarihi) return 1
  if (!b.teslimTarihi) return -1
  return a.teslimTarihi.localeCompare(b.teslimTarihi)
}

/**
 * Açık (Closed olmayan) iş emri operasyonlarını getirir. workCenter verilirse
 * o iş merkezine filtreler. Sonuç teslimTarihi artan sıralı.
 */
export async function getShopOrderOperations(params: {
  workCenter?: string
}): Promise<IfsShopOrderOperation[]> {
  const { contract } = getIfsConfig()
  const conds = [`Contract eq '${esc(contract)}'`]
  if (params.workCenter) conds.push(`WorkCenterNo eq '${esc(params.workCenter)}'`)
  conds.push(`OperStatusCode ne ${OPER_STATUS_ENUM}'Closed'`)

  const rows = await fetchOperations(conds.join(' and '), 200)
  return rows.map(toTerminal).sort(byTeslim)
}

/** Tek operasyonu OrderNo + OperationNo ile getirir; yoksa null. */
export async function getShopOrderOperation(
  orderNo: string,
  operationNo: number,
): Promise<IfsShopOrderOperation | null> {
  const { contract } = getIfsConfig()
  const filter =
    `Contract eq '${esc(contract)}' and OrderNo eq '${esc(orderNo)}' ` +
    `and OperationNo eq ${operationNo}`

  const rows = await fetchOperations(filter, 1)
  return rows.length ? toTerminal(rows[0]) : null
}
