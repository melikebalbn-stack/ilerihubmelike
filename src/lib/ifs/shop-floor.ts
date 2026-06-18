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

/** Raporlamayı yapan ekip çalışanı. */
export interface TeamEmployee {
  company: string
  employeeId: string
  teamId?: string
}

/** GetOperationSummary cevabı — şema IFS'e bağlı; ham döndürülür. */
export type OperationSummary = Record<string, unknown>

/** OData single-quote string literal (içteki tek tırnak '' ile escape edilir). */
function odataString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

/** OperationRef → action gövdesi için yalnız TANIMLI alanlar. */
function operationFields(op: OperationRef): Record<string, unknown> {
  const f: Record<string, unknown> = {}
  if (op.operationId != null) f.OperationId = op.operationId
  if (op.orderNo != null) f.OrderNo = op.orderNo
  if (op.releaseNo != null) f.ReleaseNo = op.releaseNo
  if (op.sequenceNo != null) f.SequenceNo = op.sequenceNo
  if (op.operationNo != null) f.OperationNo = op.operationNo
  return f
}

/** TeamEmployee → action gövdesi için yalnız TANIMLI alanlar. */
function employeeFields(emp?: TeamEmployee): Record<string, unknown> {
  if (!emp) return {}
  const f: Record<string, unknown> = {
    Company: emp.company,
    EmployeeId: emp.employeeId,
  }
  if (emp.teamId != null) f.TeamId = emp.teamId
  return f
}

/**
 * GetOperationSummary(...) — operasyon özetini getirir.
 * OperationId verilmemişse `null`; string parametreler tek tırnakta;
 * releaseNo/sequenceNo default '*'.
 */
export async function getOperationSummary(
  ref: OperationRef & { contract: string },
): Promise<OperationSummary> {
  const params: string[] = [
    `Contract=${odataString(ref.contract)}`,
    `OperationId=${ref.operationId != null ? ref.operationId : 'null'}`,
  ]
  if (ref.orderNo != null) params.push(`OrderNo=${odataString(ref.orderNo)}`)
  params.push(`ReleaseNo=${odataString(ref.releaseNo ?? '*')}`)
  params.push(`SequenceNo=${odataString(ref.sequenceNo ?? '*')}`)
  if (ref.operationNo != null) params.push(`OperationNo=${ref.operationNo}`)

  const funcCall = `GetOperationSummary(${params.join(',')})`
  return ifsGetFunction<OperationSummary>(funcCall)
}

/**
 * ReceiveOrder action'ı — tamamlanan operasyon miktarını stoğa al.
 */
export async function receiveOrder(input: {
  qtyReceived: number
  locationNo: string
  operation: OperationRef
  lotBatchNo?: string
  serialNo?: string
  handlingUnitId?: number
}): Promise<IfsExecutedResponse> {
  const ReceiveInformation: Record<string, unknown> = {
    ...operationFields(input.operation),
    QtyReceived: input.qtyReceived,
    LocationNo: input.locationNo,
  }
  if (input.lotBatchNo != null) ReceiveInformation.LotBatchNo = input.lotBatchNo
  if (input.serialNo != null) ReceiveInformation.SerialNo = input.serialNo
  if (input.handlingUnitId != null) {
    ReceiveInformation.HandlingUnitId = input.handlingUnitId
  }

  const resp = await ifsInvokeAction<IfsExecutedResponse>('ReceiveOrder', {
    ReceiveInformation,
  })
  assertExecuted(resp)
  return resp
}

/**
 * ReportQuantityComplete action'ı — operasyonda tamamlanan miktarı raporla.
 */
export async function reportQuantityComplete(input: {
  qtyComplete: number
  closeOperation: boolean
  operation: OperationRef
  employee?: TeamEmployee
}): Promise<IfsExecutedResponse> {
  const ReportQuantity: Record<string, unknown> = {
    ...operationFields(input.operation),
    ...employeeFields(input.employee),
    QtyComplete: input.qtyComplete,
    CloseOperation: input.closeOperation,
  }

  const resp = await ifsInvokeAction<IfsExecutedResponse>('ReportQuantityComplete', {
    ReportQuantity,
  })
  assertExecuted(resp)
  return resp
}

/**
 * ReportQuantityScrap action'ı — operasyonda hurda miktarını raporla.
 */
export async function reportQuantityScrap(input: {
  qtyScrapped: number
  scrapReason: string
  closeOperation: boolean
  operation: OperationRef
  employee?: TeamEmployee
}): Promise<IfsExecutedResponse> {
  const ReportQuantity: Record<string, unknown> = {
    ...operationFields(input.operation),
    ...employeeFields(input.employee),
    QtyScrapped: input.qtyScrapped,
    ScrapReason: input.scrapReason,
    CloseOperation: input.closeOperation,
  }

  const resp = await ifsInvokeAction<IfsExecutedResponse>('ReportQuantityScrap', {
    ReportQuantity,
  })
  assertExecuted(resp)
  return resp
}
