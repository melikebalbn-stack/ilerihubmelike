import 'server-only'
import { getIfsConfig } from './config'
import { getIfsAccessToken } from './token'
import { IfsHttpError } from './client'
import { getInventoryPart } from './part-sync'

/**
 * IFS iş emri (ShopOrd + ShopOrderOperation) YAZICI + WorkCenter kaynak okuyucu.
 * personel.ts/part-sync.ts deseni: mainRoot() + getIfsAccessToken(). client.ts'e DOKUNULMADI.
 * Hata → IfsHttpError(status, body) — gövde kısaltılmaz. getInventoryPart part-sync'ten paylaşılır.
 *
 * Kanıt: HUBTEST-J1 create'inde geçen zorunlu ShopOrd alan seti (bkz. is-emri-mapper.ts).
 */

function mainRoot(): string {
  const { baseUrl } = getIfsConfig()
  return baseUrl.replace(/[A-Za-z]+\.svc$/, '').replace('/int/', '/main/')
}
const esc = (v: string) => v.replace(/'/g, "''")

async function ifsFetch(path: string, init?: RequestInit): Promise<unknown> {
  const token = await getIfsAccessToken()
  const res = await fetch(`${mainRoot()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  })
  const text = await res.text()
  let body: unknown = text
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    /* JSON değilse ham metin kalsın */
  }
  if (!res.ok) throw new IfsHttpError(res.status, body)
  return body
}

async function odataList(path: string): Promise<Record<string, unknown>[]> {
  const body = (await ifsFetch(path)) as { value?: Record<string, unknown>[] }
  return Array.isArray(body?.value) ? body.value : []
}

/**
 * IFS ResourceId → WorkCenterNo haritası (WorkCenterHandling.svc/Reference_WorkCenterResource).
 * contract ile süzülür. Aynı ResourceId birden fazla WC'ye bağlıysa ilki kalır.
 */
export async function listWorkCenterResources(): Promise<Map<string, string>> {
  const { contract } = getIfsConfig()
  const rows = await odataList(
    `WorkCenterHandling.svc/Reference_WorkCenterResource?$filter=Contract eq '${esc(contract)}'&$select=ResourceId,WorkCenterNo&$top=500`,
  )
  const harita = new Map<string, string>()
  for (const r of rows) {
    const rid = String(r.ResourceId ?? '').trim()
    const wc = String(r.WorkCenterNo ?? '').trim()
    if (rid && wc && !harita.has(rid)) harita.set(rid, wc)
  }
  return harita
}

/** İş emri başlığı IFS'te var mı (Contract + OrderNo). */
export async function getShopOrd(orderNo: string): Promise<Record<string, unknown> | null> {
  const { contract } = getIfsConfig()
  const rows = await odataList(
    `ShopOrderHandling.svc/ShopOrds?$filter=Contract eq '${esc(contract)}' and OrderNo eq '${esc(orderNo)}'&$top=1`,
  )
  return rows[0] ?? null
}

/** İş emrinin IFS'te zaten var olan OperationNo kümesi (retry'da yazılmışları atlamak için). */
export async function listShopOrderOperationNos(orderNo: string): Promise<Set<number>> {
  const { contract } = getIfsConfig()
  const rows = await odataList(
    `ShopOrderHandling.svc/ShopOrderOperationSet?$filter=Contract eq '${esc(contract)}' and OrderNo eq '${esc(orderNo)}'&$select=OperationNo&$top=200`,
  )
  const set = new Set<number>()
  for (const r of rows) {
    const n = Number(r.OperationNo)
    if (Number.isFinite(n)) set.add(n)
  }
  return set
}

export { getInventoryPart }

export async function createShopOrd(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return (await ifsFetch('ShopOrderHandling.svc/ShopOrds', {
    method: 'POST',
    body: JSON.stringify(body),
  })) as Record<string, unknown>
}

export async function createShopOrderOperation(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return (await ifsFetch('ShopOrderHandling.svc/ShopOrderOperationSet', {
    method: 'POST',
    body: JSON.stringify(body),
  })) as Record<string, unknown>
}

export { IfsHttpError }
