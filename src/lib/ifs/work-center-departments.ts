import 'server-only'
import { getIfsConfig } from './config'
import { getIfsAccessToken } from './token'

/**
 * IFS "Bakım Atölyesi Bölümleri" (WorkCenter departments) okuma katmanı. SERVER-ONLY.
 *
 * Kaynak: WorkCenterHandling.svc → Reference_WorkCenterDepartment (site/contract için
 * DepartmentNo + Description). shop-order-operations.ts ile aynı ana-gateway + token
 * yapısını REUSE eder (kopya yok). SADECE OKUMA (GET).
 */

export interface IfsDepartment {
  /** DepartmentNo — bölüm kodu (WLZ, WKY, …). */
  kod: string
  /** Description — bölüm adı (LAZER KESİM, …). */
  ad: string
}

const SELECT_FIELDS = ['DepartmentNo', 'Description', 'Contract'].join(',')

/** config.baseUrl (.../int/.../v1/ShopFloorService.svc) → ana gateway kökü (.../main/.../v1/). */
function mainRoot(): string {
  const { baseUrl } = getIfsConfig()
  return baseUrl.replace(/[A-Za-z]+\.svc$/, '').replace('/int/', '/main/')
}

/** OData tek-tırnak string literal escape (içteki ' → ''). */
function esc(value: string): string {
  return value.replace(/'/g, "''")
}

interface RawDepartment {
  DepartmentNo?: string | null
  Description?: string | null
  Contract?: string | null
}

/**
 * Site (contract) için tüm bölümleri getirir. Ad'a göre (tr) sıralı.
 * @throws Error — IFS erişim/yetki hatasında.
 */
export async function getWorkCenterDepartments(): Promise<IfsDepartment[]> {
  const { contract } = getIfsConfig()
  const token = await getIfsAccessToken()
  const filter = `Contract eq '${esc(contract)}'`
  const url =
    `${mainRoot()}WorkCenterHandling.svc/Reference_WorkCenterDepartment` +
    `?$filter=${encodeURIComponent(filter)}&$select=${SELECT_FIELDS}&$top=100`

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
    throw new Error(`IFS WorkCenterDepartment (HTTP ${res.status}): ${msg}`)
  }

  const value = (body as { value?: unknown })?.value
  const rows = Array.isArray(value) ? (value as RawDepartment[]) : []
  return rows
    .map((r) => ({ kod: (r.DepartmentNo ?? '').trim(), ad: (r.Description ?? '').trim() }))
    .filter((d) => d.kod)
    .sort((a, b) => a.ad.localeCompare(b.ad, 'tr') || a.kod.localeCompare(b.kod, 'tr'))
}
