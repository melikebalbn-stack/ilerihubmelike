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

export interface IfsWorkCenter {
  /** WorkCenterNo — iş merkezi kodu (301, WPH01, …). */
  workCenterNo: string
  /** Description — iş merkezi adı. */
  description: string
  /** DepartmentNo — bağlı departman; W-prefixli/planlama WC'lerinde BOŞ olabilir. */
  departmentNo: string
}

export interface IfsWorkCenterResource {
  /** ResourceId — kaynak/tezgah kodu (DT03, PE02, …); ipro_tezgah.kod ile eşleşir. */
  resourceId: string
  /** Description — kaynak adı. */
  description: string
  /** WorkCenterNo — bağlı iş merkezi. */
  workCenterNo: string
  /** Objstate — Active / Blocked. */
  objstate: string
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

interface RawWorkCenter {
  WorkCenterNo?: string | null
  Description?: string | null
  DepartmentNo?: string | null
  Objstate?: string | null
}

const WC_SELECT_FIELDS = ['WorkCenterNo', 'Description', 'DepartmentNo', 'Objstate'].join(',')

/**
 * Site (contract) için TÜM iş merkezleri (WC → DepartmentNo canlı eşleme kaynağı).
 * ⚠️ $top=500: varsayılan $top kayıtları KIRPAR (89 kayıt 67 görünmüştü) — sabit tut.
 * DepartmentNo boş WC'ler de döner (W-prefixli/planlama); çağıran filtreler.
 * @throws Error — IFS erişim/yetki hatasında.
 */
export async function getWorkCenters(): Promise<IfsWorkCenter[]> {
  const { contract } = getIfsConfig()
  const token = await getIfsAccessToken()
  const filter = `Contract eq '${esc(contract)}'`
  const url =
    `${mainRoot()}WorkCenterHandling.svc/WorkCenterSet` +
    `?$filter=${encodeURIComponent(filter)}&$select=${WC_SELECT_FIELDS}&$top=500`

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
    throw new Error(`IFS WorkCenterSet (HTTP ${res.status}): ${msg}`)
  }

  const value = (body as { value?: unknown })?.value
  const rows = Array.isArray(value) ? (value as RawWorkCenter[]) : []
  return rows
    .map((r) => ({
      workCenterNo: (r.WorkCenterNo ?? '').trim(),
      description: (r.Description ?? '').trim(),
      departmentNo: (r.DepartmentNo ?? '').trim(),
    }))
    .filter((w) => w.workCenterNo)
}

interface RawWorkCenterResource {
  ResourceId?: string | null
  Description?: string | null
  WorkCenterNo?: string | null
  Objstate?: string | null
}

const RESOURCE_SELECT_FIELDS = ['ResourceId', 'Description', 'WorkCenterNo', 'Objstate'].join(',')

/**
 * İş merkezi KAYNAKLARI = fiziksel tezgahlar. ResourceId ↔ ipro_tezgah.kod ile eşleşir
 * (numerik ifsWorkCenterNo/ifsResourceId DEĞİL — bunlar bayat). Zincir: departman → WC
 * (WorkCenterSet.DepartmentNo) → kaynak (bu liste, WorkCenterNo ile).
 * ⚠️ $top=500: varsayılan $top kırpar (81 kayıt var). $expand=Resources KULLANILMAZ
 * (ODP_NOT_IMPLEMENTED) → Reference_WorkCenterResource doğrudan çekilir.
 * @throws Error — IFS erişim/yetki hatasında.
 */
export async function getWorkCenterResources(): Promise<IfsWorkCenterResource[]> {
  const { contract } = getIfsConfig()
  const token = await getIfsAccessToken()
  const filter = `Contract eq '${esc(contract)}'`
  const url =
    `${mainRoot()}WorkCenterHandling.svc/Reference_WorkCenterResource` +
    `?$filter=${encodeURIComponent(filter)}&$select=${RESOURCE_SELECT_FIELDS}&$top=500`

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
    throw new Error(`IFS WorkCenterResource (HTTP ${res.status}): ${msg}`)
  }

  const value = (body as { value?: unknown })?.value
  const rows = Array.isArray(value) ? (value as RawWorkCenterResource[]) : []
  return rows
    .map((r) => ({
      resourceId: (r.ResourceId ?? '').trim(),
      description: (r.Description ?? '').trim(),
      workCenterNo: (r.WorkCenterNo ?? '').trim(),
      objstate: (r.Objstate ?? '').trim(),
    }))
    .filter((r) => r.resourceId)
}
