import 'server-only'
import {
  ifsGetFunction,
  ifsInvokeAction,
  assertExecuted,
  type IfsExecutedResponse,
} from './client'

/**
 * ShopFloorService tipli wrapper'ları. SERVER-ONLY.
 * Verilmeyen opsiyonel alanlar (OperationId, employee, lot/serial vb.) gövdeye
 * KONULMAZ — IFS bu alanları null/eksik vs. farklı yorumlayabilir.
 */

/** Bir operasyona referans: OperationId ya da sipariş koordinatları. */
export interface OperationRef {
  operationId?: number
  orderNo?: string
  releaseNo?: string
  sequenceNo?: string
  operationNo?: number
}

/**
 * IFS ShopFloorService action gövdesi tipleri — alan adları metadata ile BİREBİR
 * (PascalCase, nested). Wrapper'lar bunları OLDUĞU GİBİ forward eder; '*' veya
 * başka default ENJEKTE ETMEZ.
 */
export interface IfsOperationRef {
  OperationId?: number | null
  OrderNo?: string | null
  ReleaseNo?: string | null
  SequenceNo?: string | null
  OperationNo?: number | null
}

export interface IfsTeamEmployee {
  Company: string
  EmployeeId: string
  TeamId?: string | null
}

/** GetOperationSummary cevabı — şema IFS'e bağlı; ham döndürülür. */
export type OperationSummary = Record<string, unknown>

/** OData single-quote string literal (içteki tek tırnak '' ile escape edilir). */
function odataString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

/**
 * GetOperationSummary(...) — operasyon özetini getirir.
 * OperationId verilmemişse `null`; string parametreler tek tırnakta;
 * releaseNo/sequenceNo default '*'.
 */
export async function getOperationSummary(
  ref: OperationRef & { contract: string },
): Promise<OperationSummary> {
  // OData function import'ları parametre adı kümesiyle BİREBİR eşleşir → metadata
  // imzasındaki 6 parametrenin 6'sı da HER ZAMAN gönderilmeli, aksi halde
  // FUNCTION_NOT_FOUND (400). Sıra metadata ile aynı:
  // Contract, OperationId, OrderNo, ReleaseNo, SequenceNo, OperationNo.
  // Verilmeyen Decimal/string'ler için literal (tırnaksız) `null`; Release/Sequence
  // default '*' korunur (daha önce çalışan combo).
  const params: string[] = [
    `Contract=${odataString(ref.contract)}`,
    `OperationId=${ref.operationId != null ? ref.operationId : 'null'}`,
    `OrderNo=${ref.orderNo != null ? odataString(ref.orderNo) : 'null'}`,
    `ReleaseNo=${odataString(ref.releaseNo ?? '*')}`,
    `SequenceNo=${odataString(ref.sequenceNo ?? '*')}`,
    `OperationNo=${ref.operationNo != null ? ref.operationNo : 'null'}`,
  ]

  const funcCall = `GetOperationSummary(${params.join(',')})`
  return ifsGetFunction<OperationSummary>(funcCall)
}

/**
 * ReportQuantityComplete action'ı — operasyonda tamamlanan miktarı raporla.
 * Gövde NESTED (metadata: OperationInformation + TeamEmployeeInformation).
 * TeamEmployee ZORUNLU (yoksa IFS "Executed: FALSE" / NO_SHOP_FLOOR_EMP döner).
 */
export async function reportQuantityComplete(args: {
  operation: IfsOperationRef
  qtyComplete: number
  closeOperation?: boolean
  employee: IfsTeamEmployee
}): Promise<IfsExecutedResponse> {
  const resp = await ifsInvokeAction<IfsExecutedResponse>('ReportQuantityComplete', {
    ReportQuantity: {
      QtyComplete: args.qtyComplete,
      CloseOperation: args.closeOperation ?? false,
      OperationInformation: args.operation,
      TeamEmployeeInformation: args.employee,
    },
  })
  assertExecuted(resp)
  return resp
}

/**
 * ReportQuantityScrap action'ı — operasyonda hurda miktarını raporla.
 * Gövde NESTED; TeamEmployee ZORUNLU.
 */
export async function reportQuantityScrap(args: {
  operation: IfsOperationRef
  qtyScrapped: number
  scrapReason: string
  closeOperation?: boolean
  employee: IfsTeamEmployee
}): Promise<IfsExecutedResponse> {
  const resp = await ifsInvokeAction<IfsExecutedResponse>('ReportQuantityScrap', {
    ReportQuantity: {
      QtyScrapped: args.qtyScrapped,
      ScrapReason: args.scrapReason,
      CloseOperation: args.closeOperation ?? false,
      OperationInformation: args.operation,
      TeamEmployeeInformation: args.employee,
    },
  })
  assertExecuted(resp)
  return resp
}

/**
 * ReceiveOrder action'ı — tamamlanan operasyon miktarını stoğa al.
 * Gövde NESTED (OperationInformation). DİKKAT: TeamEmployeeInformation YOK.
 */
export async function receiveOrder(args: {
  operation: IfsOperationRef
  qtyReceived: number
  lotBatchNo?: string | null
  serialNo?: string | null
  locationNo?: string | null
  handlingUnitId?: number | null
}): Promise<IfsExecutedResponse> {
  const resp = await ifsInvokeAction<IfsExecutedResponse>('ReceiveOrder', {
    ReceiveInformation: {
      QtyReceived: args.qtyReceived,
      LotBatchNo: args.lotBatchNo ?? null,
      SerialNo: args.serialNo ?? null,
      LocationNo: args.locationNo ?? null,
      HandlingUnitId: args.handlingUnitId ?? null,
      OperationInformation: args.operation,
    },
  })
  assertExecuted(resp)
  return resp
}
