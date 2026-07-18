import 'server-only'
import { getIfsConfig } from './config'
import { getIfsAccessToken } from './token'

/**
 * IFS Cloud projection (Premium API) HTTP istemcisi. SERVER-ONLY.
 *
 * - ifsGetFunction:  OData function call (GET).
 * - ifsInvokeAction: bound/unbound action (POST, Prefer: wait).
 * - assertExecuted:  ShopFloorService action'larında HTTP 200 olsa bile
 *   { Executed: "TRUE"|"FALSE", ErrorText } ile başarı kontrolü.
 */

/** non-2xx HTTP cevabı. */
export class IfsHttpError extends Error {
  readonly status: number
  readonly body: unknown
  constructor(status: number, body: unknown) {
    super(`IFS HTTP ${status}`)
    this.name = 'IfsHttpError'
    this.status = status
    this.body = body
  }
}

/** HTTP 200 ama Executed !== TRUE — IFS iş kuralı hatası. */
export class IfsExecutionError extends Error {
  readonly errorText: string | null
  readonly response: unknown
  constructor(errorText: string | null, response?: unknown) {
    super(errorText || 'IFS action başarısız (Executed=FALSE)')
    this.name = 'IfsExecutionError'
    this.errorText = errorText ?? null
    this.response = response
  }
}

/** ShopFloorService action cevap zarfı (Executed/ErrorText). */
export interface IfsExecutedResponse {
  Executed?: string | boolean
  ErrorText?: string | null
  [key: string]: unknown
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * OData function call (GET). funcCall, çağrı string'idir; ör.
 * `GetOperationSummary(Contract='ILER2',OperationId=null,OrderNo='...')`.
 */
export async function ifsGetFunction<T = unknown>(funcCall: string): Promise<T> {
  const cfg = getIfsConfig()
  const token = await getIfsAccessToken()

  const res = await fetch(`${cfg.baseUrl}/${funcCall}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  })

  const body = await parseBody(res)
  if (!res.ok) throw new IfsHttpError(res.status, body)
  return body as T
}

/**
 * Action çağrısı (POST). action, çağrı adı; payload JSON gövde.
 * "Prefer: wait=99999" ile senkron tamamlanma beklenir.
 */
export async function ifsInvokeAction<T = unknown>(
  action: string,
  payload: unknown,
): Promise<T> {
  const cfg = getIfsConfig()
  const token = await getIfsAccessToken()

  const res = await fetch(`${cfg.baseUrl}/${action}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Prefer: 'wait=99999',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })

  const body = await parseBody(res)
  if (!res.ok) throw new IfsHttpError(res.status, body)
  return body as T
}

/**
 * ShopFloorService action başarı kontrolü. HTTP 200 yeterli değildir:
 * Executed !== "TRUE" ise IfsExecutionError(ErrorText) fırlatır.
 */
export function assertExecuted(resp: IfsExecutedResponse): void {
  if (String(resp?.Executed).toUpperCase() !== 'TRUE') {
    throw new IfsExecutionError(resp?.ErrorText ?? null, resp)
  }
}
