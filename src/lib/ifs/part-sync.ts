import 'server-only'
import { getIfsConfig } from './config'
import { getIfsAccessToken } from './token'
import { IfsHttpError } from './client'

/**
 * IFS malzeme (Part Catalog + Inventory Part) YAZICI + referans okuyucular.
 * personel.ts deseni: mainRoot() + getIfsAccessToken(). client.ts'e DOKUNULMADI
 * (yalnız IfsHttpError import edildi). Hata → IfsHttpError(status, body) — gövde kısaltılmaz.
 *
 * Keşif kanıtı (HUBTEST-0001): önce PartCatalogSet (PartHandling.svc), sonra InventoryPartSet
 * (InventoryPartHandling.svc); katalog yoksa InventoryPart ORA-20111 verir.
 */

/** config.baseUrl (.../int/.../ShopFloorService.svc) → ana gateway projeksiyon kökü (.../main/.../v1/). */
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

// ── Referans listeler (mapper doğrulaması için) ──────────────────────────

/** Geçerli IFS ISO birim kodları (PartHandling.svc/Reference_IsoUnit, key=UnitCode). */
export async function listIsoUnits(): Promise<string[]> {
  const rows = await odataList('PartHandling.svc/Reference_IsoUnit?$select=UnitCode&$top=500')
  return rows.map((r) => String(r.UnitCode)).filter(Boolean)
}

/** Geçerli muhasebe grubu kodları (InventoryPartHandling.svc/Reference_AccountingGroup). */
export async function listAccountingGroups(): Promise<string[]> {
  const rows = await odataList('InventoryPartHandling.svc/Reference_AccountingGroup?$select=AccountingGroup&$top=500')
  return rows.map((r) => String(r.AccountingGroup)).filter(Boolean)
}

let cachedProductCodeSet: string | null = null
/** InventoryPartHandling $metadata'dan PartProductCode LOV set adını bulur (Reference_*ProductCode). */
async function productCodeSetAdi(): Promise<string | null> {
  if (cachedProductCodeSet) return cachedProductCodeSet
  const token = await getIfsAccessToken()
  const res = await fetch(`${mainRoot()}InventoryPartHandling.svc/$metadata`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/xml' },
    cache: 'no-store',
  })
  if (!res.ok) throw new IfsHttpError(res.status, await res.text())
  const xml = await res.text()
  const sets = [...xml.matchAll(/<EntitySet\s+Name="([^"]+)"/g)].map((m) => m[1])
  // PartProductCode LOV'u: Reference_* ve içinde ProductCode geçen (PartProductFamily hariç).
  const aday =
    sets.find((s) => /^Reference_.*ProductCode$/i.test(s)) ??
    sets.find((s) => /^Reference_.*ProductCode/i.test(s) && !/Family/i.test(s)) ??
    sets.find((s) => /ProductCode/i.test(s) && !/Family/i.test(s))
  cachedProductCodeSet = aday ?? null
  return cachedProductCodeSet
}

/** Geçerli ürün kodları (PartProductCode LOV). Set bulunamazsa boş liste (mapper hata verir). */
export async function listProductCodes(): Promise<string[]> {
  const set = await productCodeSetAdi()
  if (!set) return []
  const rows = await odataList(`InventoryPartHandling.svc/${set}?$top=500`)
  // Anahtar alan adı değişebilir: ProductCode | PartProductCode | Code.
  return rows
    .map((r) => String(r.ProductCode ?? r.PartProductCode ?? r.Code ?? ''))
    .filter(Boolean)
}

// ── Var/yok kontrolleri ──────────────────────────────────────────────────

export async function getPartCatalog(partNo: string): Promise<Record<string, unknown> | null> {
  const rows = await odataList(`PartHandling.svc/PartCatalogSet?$filter=PartNo eq '${esc(partNo)}'&$top=1`)
  return rows[0] ?? null
}

export async function getInventoryPart(contract: string, partNo: string): Promise<Record<string, unknown> | null> {
  const rows = await odataList(
    `InventoryPartHandling.svc/InventoryPartSet?$filter=Contract eq '${esc(contract)}' and PartNo eq '${esc(partNo)}'&$top=1`,
  )
  return rows[0] ?? null
}

// ── Oluşturucular ─────────────────────────────────────────────────────────

export async function createPartCatalog(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return (await ifsFetch('PartHandling.svc/PartCatalogSet', {
    method: 'POST',
    body: JSON.stringify(body),
  })) as Record<string, unknown>
}

export async function createInventoryPart(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return (await ifsFetch('InventoryPartHandling.svc/InventoryPartSet', {
    method: 'POST',
    body: JSON.stringify(body),
  })) as Record<string, unknown>
}

export { IfsHttpError }
