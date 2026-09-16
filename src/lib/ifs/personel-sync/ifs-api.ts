/**
 * IFS OData erişimi — personel senkronu (faz 1). Tümü /main gateway'inde.
 *
 * NEDEN kendi token/config'i var: src/lib/ifs/{config,token}.ts `server-only`
 * importlu; pilot ve temizlik betikleri (tsx) onları yükleyemiyor. Aynı env
 * değişkenleri (IFS_*) okunur, aynı client_credentials akışı — bilinçli tekrar,
 * bkz. scripts/ipro/fix-ifs-gecerlilik.ts deseni.
 *
 * Kurallar: DELETE yalnız temizlik betiğinde (bu modülden `sil` dışa açık ama
 * senkron çağırmaz). PATCH daima If-Match: ETag. Yazma başlıkları IFS UI'nin
 * gönderdiğiyle aynı (IEEE754Compatible, x-ifs-accept-warnings).
 */
import { IFS_COMPANY, IFS_CONTRACT, IFS_STRUCTURE, SICIL_ONEKI } from './kodlar'

export interface IfsBaglanti {
  mainRoot: string
  hostTest: boolean
}

let tokenCache: { t: string; exp: number } | null = null

function env(ad: string): string {
  const v = process.env[ad]
  if (!v) throw new Error(`IFS env eksik: ${ad}`)
  return v
}

export function ifsBaglanti(): IfsBaglanti {
  const int = env('IFS_INT_BASE_URL').replace(/\/+$/, '')
  const mainRoot = int.replace(/[A-Za-z]+\.svc$/, '').replace('/int/', '/main/')
  return { mainRoot, hostTest: /ifscloudtest/i.test(mainRoot) }
}

async function token(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.exp) return tokenCache.t
  const b = new URLSearchParams({ grant_type: 'client_credentials', client_id: env('IFS_CLIENT_ID'), client_secret: env('IFS_CLIENT_SECRET') })
  if (process.env.IFS_SCOPE) b.set('scope', process.env.IFS_SCOPE)
  const r = await fetch(env('IFS_TOKEN_URL'), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: b, cache: 'no-store' })
  if (!r.ok) throw new Error(`IFS token alınamadı (HTTP ${r.status})`)
  const j = (await r.json()) as { access_token?: string; expires_in?: number }
  if (!j.access_token) throw new Error('IFS token cevabında access_token yok')
  tokenCache = { t: j.access_token, exp: Date.now() + Math.max(60, (j.expires_in ?? 300) - 30) * 1000 }
  return j.access_token
}

export class IfsSyncHatasi extends Error {
  constructor(public readonly status: number, public readonly detay: string, public readonly yol: string) {
    super(`IFS ${status} ${yol}: ${detay}`)
    this.name = 'IfsSyncHatasi'
  }
  get grantYok(): boolean { return this.status === 403 }
  get bagimlilik(): boolean { return /child|reference|exist|in use|bağ|FK|ORA-02292|REMOVE|NOTREMOVED/i.test(this.detay) }
}

// Pilot 16.09 dersleri: IEEE754Compatible=true ile Decimal alanlar (DegreeOfOccupation,
// StructBuId) string bekleniyor → "Invalid value"; x-ifs-accept-warnings LaborClass'ta
// 400. personel.ts'in kanıtlı sade başlığı kullanılıyor.
const YAZMA_BASLIKLARI = {
  'Content-Type': 'application/json',
  Prefer: 'wait=99999',
}

export interface IfsCevap<T = Record<string, unknown>> { body: T; etag: string | null; status: number }

export async function istek<T = Record<string, unknown>>(yol: string, init: RequestInit = {}): Promise<IfsCevap<T>> {
  const { mainRoot } = ifsBaglanti()
  const res = await fetch(`${mainRoot}${yol}`, {
    ...init,
    headers: { Authorization: `Bearer ${await token()}`, Accept: 'application/json', ...(init.body ? YAZMA_BASLIKLARI : {}), ...(init.headers ?? {}) },
    cache: 'no-store',
  })
  const text = await res.text()
  let body: unknown = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  if (!res.ok) {
    const e = body as { error?: { message?: string; details?: Array<{ message?: string }> } } | string
    const detay = typeof e === 'string' ? e.slice(0, 300) : (e?.error?.details?.[0]?.message ?? e?.error?.message ?? text.slice(0, 300))
    throw new IfsSyncHatasi(res.status, detay, yol)
  }
  const govdeEtag = (body as Record<string, unknown> | null)?.['@odata.etag']
  return { body: body as T, etag: res.headers.get('etag') ?? (typeof govdeEtag === 'string' ? govdeEtag : null), status: res.status }
}

const q = (s: string) => s.replace(/'/g, "''")
const enc = (s: string) => encodeURIComponent(s)

/** Tüm sayfaları toplar (IFS $top üst sınırı var; nextLink takip edilir). */
async function tumu<T>(yol: string): Promise<T[]> {
  const out: T[] = []
  let sonraki: string | null = yol
  while (sonraki) {
    const cevap: IfsCevap<{ value?: T[]; '@odata.nextLink'?: string }> = await istek(sonraki)
    out.push(...(cevap.body.value ?? []))
    const nl: string | undefined = cevap.body['@odata.nextLink']
    sonraki = nl ? nl.replace(ifsBaglanti().mainRoot, '') : null
  }
  return out
}

// ── Org birimi ───────────────────────────────────────────────────────────
export interface IfsOrg { OrgCode: string; OrgName: string; SupOrgCode: string | null; ValidFrom: string; ValidTo: string; OrgType?: string | null; '@odata.etag'?: string }
const ORG_SET = 'OrganizationUnitsHandling.svc/CompanyOrgAlls'
export const orgAnahtari = (orgCode: string) => `${ORG_SET}(CompanyId='${IFS_COMPANY}',StructureId='${IFS_STRUCTURE}',OrgCode='${q(orgCode)}')`
export const listOrgs = () => tumu<IfsOrg>(`${ORG_SET}?$filter=${enc(`CompanyId eq '${IFS_COMPANY}' and StructureId eq '${IFS_STRUCTURE}'`)}&$select=OrgCode,OrgName,SupOrgCode,ValidFrom,ValidTo,OrgType&$top=500`)
export const createOrg = (g: Record<string, unknown>) => istek(ORG_SET, { method: 'POST', body: JSON.stringify({ CompanyId: IFS_COMPANY, StructureId: IFS_STRUCTURE, ...g }) })
export const patchOrg = (orgCode: string, g: Record<string, unknown>, etag: string) => istek(orgAnahtari(orgCode), { method: 'PATCH', body: JSON.stringify(g), headers: { 'If-Match': etag } })

// ── Pozisyon ─────────────────────────────────────────────────────────────
export interface IfsPos { PosCode: string; PositionTitle: string; SupPosCode: string | null; ValidFrom: string; ValidTo: string; StructBuId?: number | null; '@odata.etag'?: string }
const POS_SET = 'PositionsHandling.svc/CompanyPositionStrs'
export const posAnahtari = (posCode: string) => `${POS_SET}(CompanyId='${IFS_COMPANY}',PosCode='${q(posCode)}')`
export const listPositions = () => tumu<IfsPos>(`${POS_SET}?$filter=${enc(`CompanyId eq '${IFS_COMPANY}'`)}&$select=PosCode,PositionTitle,SupPosCode,ValidFrom,ValidTo,StructBuId&$top=500`)
export const createPosition = (g: Record<string, unknown>) => istek(POS_SET, { method: 'POST', body: JSON.stringify({ CompanyId: IFS_COMPANY, ...g }) })
export const patchPosition = (posCode: string, g: Record<string, unknown>, etag: string) => istek(posAnahtari(posCode), { method: 'PATCH', body: JSON.stringify(g), headers: { 'If-Match': etag } })

// ── Labor class ──────────────────────────────────────────────────────────
export interface IfsLaborClass { LaborClassNo: string; LaborClassDescription: string; Objstate?: string; '@odata.etag'?: string }
/** Okuma: ShopFloorEmployeesHandling LOV'u (grant var). Yazma: ManufacturingLaborClassesHandling (grant 16.09'da YOK → 403). */
export const listLaborClasses = () => tumu<IfsLaborClass>(`ShopFloorEmployeesHandling.svc/Reference_LaborClass?$filter=${enc(`Contract eq '${IFS_CONTRACT}'`)}&$select=LaborClassNo,LaborClassDescription,Objstate&$top=200`)
const LC_SET = 'ManufacturingLaborClassesHandling.svc/LaborClassSet'
export const lcAnahtari = (no: string) => `${LC_SET}(LaborClassNo='${q(no)}',Contract='${IFS_CONTRACT}')`
export const createLaborClass = (g: Record<string, unknown>) => istek(LC_SET, { method: 'POST', body: JSON.stringify({ Contract: IFS_CONTRACT, ...g }) })
export const patchLaborClass = (no: string, g: Record<string, unknown>, etag: string) => istek(lcAnahtari(no), { method: 'PATCH', body: JSON.stringify(g), headers: { 'If-Match': etag } })

// ── Çalışan ──────────────────────────────────────────────────────────────
export interface IfsEmployee {
  EmpNo: string; PersonId: string | null; Fname: string | null; Lname: string | null; InternalDisplayName: string | null
  OrgCode: string | null; PosCode: string | null; EmpOrgCode?: string | null; EmpPosCode?: string | null
  EmploymentDate: string | null; EmploymentEndDate: string | null; ValidFrom: string | null; ValidTo: string | null
  Gender: string | null; FreeField1: string | null; FreeField2: string | null; EntitledToOvertime: boolean | null; MasterEmployment: boolean | null
  '@odata.etag'?: string
}
const EMP_SET = 'EmployeesHandling.svc/CompanyPersons'
export const empAnahtari = (empNo: string) => `${EMP_SET}(CompanyId='${IFS_COMPANY}',EmpNo='${q(empNo)}')`
const EMP_SELECT = 'EmpNo,PersonId,Fname,Lname,InternalDisplayName,OrgCode,PosCode,EmpOrgCode,EmpPosCode,EmploymentDate,EmploymentEndDate,ValidFrom,ValidTo,Gender,FreeField1,FreeField2,EntitledToOvertime,MasterEmployment'
/** Yalnız senkron kapsamındaki (ILR-) çalışanlar. */
export const listEmployees = () => tumu<IfsEmployee>(`${EMP_SET}?$filter=${enc(`CompanyId eq '${IFS_COMPANY}' and startswith(EmpNo,'${SICIL_ONEKI}')`)}&$select=${EMP_SELECT}&$top=500`)
export const listAllEmployees = () => tumu<IfsEmployee>(`${EMP_SET}?$filter=${enc(`CompanyId eq '${IFS_COMPANY}'`)}&$select=${EMP_SELECT}&$top=500`)
export const getEmployee = async (empNo: string) => { try { return await istek<IfsEmployee>(`${empAnahtari(empNo)}?$select=${EMP_SELECT}`) } catch (e) { if (e instanceof IfsSyncHatasi && e.status === 404) return null; throw e } }
export const createEmployee = (g: Record<string, unknown>) => istek(EMP_SET, { method: 'POST', body: JSON.stringify({ CompanyId: IFS_COMPANY, ...g }) })
export const patchEmployee = (empNo: string, g: Record<string, unknown>, etag: string) => istek(empAnahtari(empNo), { method: 'PATCH', body: JSON.stringify(g), headers: { 'If-Match': etag } })

// ── Shop-floor ───────────────────────────────────────────────────────────
export interface IfsSfEmployee { EmployeeId: string; PersonId: string | null; '@odata.etag'?: string }
export interface IfsSfSite { EmployeeId: string; Contract: string; PrimaryLaborClass: string | null; Objstate: string; LaborClassResource: boolean | null; PrimaryContract: boolean | null; '@odata.etag'?: string }
const SFE_SET = 'ShopFloorEmployeesHandling.svc/ShopFloorEmployees'
const SFS_SET = 'ShopFloorEmployeesHandling.svc/ShopFloorEmployeeSites'
export const sfeAnahtari = (empNo: string) => `${SFE_SET}(Company='${IFS_COMPANY}',EmployeeId='${q(empNo)}')`
export const sfsAnahtari = (empNo: string) => `${SFS_SET}(Company='${IFS_COMPANY}',EmployeeId='${q(empNo)}',Contract='${IFS_CONTRACT}')`
export const listSfEmployees = () => tumu<IfsSfEmployee>(`${SFE_SET}?$filter=${enc(`Company eq '${IFS_COMPANY}'`)}&$select=EmployeeId,PersonId&$top=500`)
export const listSfSites = () => tumu<IfsSfSite>(`${SFS_SET}?$filter=${enc(`Company eq '${IFS_COMPANY}' and Contract eq '${IFS_CONTRACT}'`)}&$select=EmployeeId,Contract,PrimaryLaborClass,Objstate,LaborClassResource,PrimaryContract&$top=500`)
export const getSfSite = async (empNo: string) => { try { return await istek<IfsSfSite>(sfsAnahtari(empNo)) } catch (e) { if (e instanceof IfsSyncHatasi && e.status === 404) return null; throw e } }
/** IG002 referans deseni (kanıtlı, src/lib/ifs/personel.ts). */
export const createSfEmployee = (empNo: string) => istek(SFE_SET, { method: 'POST', body: JSON.stringify({ Company: IFS_COMPANY, EmployeeId: empNo, PersonId: empNo, WorkbenchUser: true, AllowEmpTimeManagement: true, ResumeOption: 'NoResume', AllowConcurrentOp: 'AskNewActivity', AttendanceAutoClockIn: 'Warning' }) })
export const createSfSite = (empNo: string, laborClass: string) => istek(SFS_SET, { method: 'POST', body: JSON.stringify({ Company: IFS_COMPANY, Contract: IFS_CONTRACT, EmployeeId: empNo, PrimaryLaborClass: laborClass, LaborClassResource: true, PrimaryContract: true }) })
export const patchSfSite = (empNo: string, g: Record<string, unknown>, etag: string) => istek(sfsAnahtari(empNo), { method: 'PATCH', body: JSON.stringify(g), headers: { 'If-Match': etag } })
/** Objstate geçişi — bound action, ETag zorunlu; yarışta IFS 412 döner (çağıran yeniden okur). */
export async function sfSiteDurum(empNo: string, hedef: 'Active' | 'Blocked') {
  const mevcut = await istek<IfsSfSite>(sfsAnahtari(empNo))
  if (mevcut.body.Objstate === hedef) return mevcut
  const etag = mevcut.etag
  if (!etag) throw new IfsSyncHatasi(0, 'ETag yok', sfsAnahtari(empNo))
  return istek(`${sfsAnahtari(empNo)}/IfsApp.ShopFloorEmployeesHandling.ShopFloorEmployeeSite_Set${hedef}`, { method: 'POST', body: '{}', headers: { 'If-Match': etag } })
}

// ── Silme (YALNIZ temizlik betiği) ───────────────────────────────────────
export async function sil(anahtarYolu: string, etag?: string | null): Promise<void> {
  let et = etag ?? null
  if (!et) et = (await istek(anahtarYolu)).etag
  await istek(anahtarYolu, { method: 'DELETE', headers: et ? { 'If-Match': et } : {} })
}
