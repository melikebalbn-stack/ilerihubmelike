import 'server-only'
import { getIfsConfig } from './config'
import { getIfsAccessToken } from './token'

/**
 * IFS personel katmanları (ILERIHub → IFS senkronu). SERVER-ONLY.
 *
 * ÜÇ KATMAN (sırası zorunlu — her biri bir öncekine bağlı):
 *   1. CompanyPerson        (EmployeesHandling)          — şirket çalışanı / istihdam
 *   2. ShopFloorEmployee    (ShopFloorEmployeesHandling) — atölye çalışanı
 *   3. ShopFloorEmployeeSite(ShopFloorEmployeesHandling) — site bağı + labor class
 * Katman 3 dolmadan IFS üretim bildirimi INVALIDEMP verir.
 *
 * Bu projeksiyonlar /main gateway'inde (ShopFloorService /int'te) — mainRoot() türetir.
 * Kanıt: ILR-00207 bu akışla kuruldu, ardından ReportQuantityComplete kabul edildi.
 */

/** Kanıtlanmış sabitler — Personnel'de karşılığı yok, IG002 referans kaydından. */
export const IFS_EMPLOYMENT_TYPE = 'DAIMI' // IFS'te tek geçerli seçenek
export const IFS_ACIK_UCLU_TARIH = '2099-12-31' // açık uçlu istihdam sentinel'i
export const IFS_DEGREE_OF_OCCUPATION = 1 // tam zamanlı
export const IFS_ENTITLED_TO_OVERTIME = true // operatörler mesai yapar

/** config.baseUrl (.../int/.../ShopFloorService.svc) → ana gateway kökü (.../main/.../). */
function mainRoot(): string {
  const { baseUrl } = getIfsConfig()
  return baseUrl.replace(/[A-Za-z]+\.svc$/, '').replace('/int/', '/main/')
}

function esc(v: string): string {
  return v.replace(/'/g, "''")
}

/** IFS hatası — ham ORA detayını taşır (senkron sınıflandırması için). */
export class IfsPersonelError extends Error {
  constructor(
    public readonly status: number,
    public readonly detay: string,
  ) {
    super(detay || `IFS HTTP ${status}`)
    this.name = 'IfsPersonelError'
  }
}

/**
 * Geçerlilik penceresi hatası mı? (org/pozisyon ValidFrom, personelin işe giriş
 * tarihinden sonra başlıyorsa IFS reddeder — toplu düzeltme bekleyen kayıtlar.)
 */
export function pencereHatasiMi(detay: string): boolean {
  return /ORGCODENOTVALID|CompanyPersAssign\.NOTVALID|not valid during entered date interval/i.test(detay)
}

async function istek(yol: string, init: RequestInit): Promise<unknown> {
  const token = await getIfsAccessToken()
  const res = await fetch(`${mainRoot()}${yol}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  })
  const text = await res.text()
  let body: unknown = text
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    /* JSON değilse ham metin */
  }
  if (!res.ok) {
    const e = body as { error?: { message?: string; details?: Array<{ message?: string }> } }
    const detay = e?.error?.details?.[0]?.message ?? e?.error?.message ?? (typeof body === 'string' ? body.slice(0, 300) : '')
    throw new IfsPersonelError(res.status, detay)
  }
  return body
}

async function tekKayit(yol: string): Promise<Record<string, unknown> | null> {
  const body = (await istek(yol, { method: 'GET' })) as { value?: unknown[] }
  const v = Array.isArray(body?.value) ? body.value : []
  return (v[0] as Record<string, unknown>) ?? null
}

// ── Referans listeler (isim eşlemesi için) ───────────────────────────────

export type IfsOrg = { orgCode: string; orgName: string }
export type IfsPozisyon = { posCode: string; positionTitle: string }

export async function listOrganizations(): Promise<IfsOrg[]> {
  const { company } = getIfsConfig()
  const f = encodeURIComponent(`CompanyId eq '${esc(company)}'`)
  const body = (await istek(`EmployeesHandling.svc/OrganizationSet?$filter=${f}&$top=500`, { method: 'GET' })) as {
    value?: Array<{ OrgCode?: string; OrgName?: string }>
  }
  return (body.value ?? []).map((o) => ({ orgCode: String(o.OrgCode ?? ''), orgName: String(o.OrgName ?? '') }))
}

export async function listPositions(): Promise<IfsPozisyon[]> {
  const { company } = getIfsConfig()
  const f = encodeURIComponent(`CompanyId eq '${esc(company)}'`)
  const body = (await istek(`EmployeesHandling.svc/CompanyPositions?$filter=${f}&$top=500`, { method: 'GET' })) as {
    value?: Array<{ PosCode?: string; PositionTitle?: string }>
  }
  return (body.value ?? []).map((p) => ({ posCode: String(p.PosCode ?? ''), positionTitle: String(p.PositionTitle ?? '') }))
}

export type IfsSite = { employeeId: string; objstate: string }

export async function listShopFloorEmployeeSites(): Promise<IfsSite[]> {
  const { company, contract } = getIfsConfig()
  const f = encodeURIComponent(`Company eq '${esc(company)}' and Contract eq '${esc(contract)}'`)
  const body = (await istek(`ShopFloorEmployeesHandling.svc/ShopFloorEmployeeSites?$filter=${f}&$top=1000`, {
    method: 'GET',
  })) as { value?: Array<{ EmployeeId?: string; Objstate?: string }> }
  return (body.value ?? []).map((s) => ({ employeeId: String(s.EmployeeId ?? ''), objstate: String(s.Objstate ?? '') }))
}

// ── KATMAN 1: CompanyPerson ──────────────────────────────────────────────

export type CompanyPersonGirdi = {
  empNo: string // = Personnel.sicilNo (birebir)
  fname: string
  lname: string
  displayName: string // = Personnel.adSoyad
  employmentDate: string // yyyy-MM-dd, = Personnel.iseGirisTarihi (GERÇEK tarih)
  orgCode: string // IFS OrgCode (eşlemeden)
  posCode: string // IFS PosCode (eşlemeden)
}

export async function getCompanyPerson(empNo: string) {
  const { company } = getIfsConfig()
  const f = encodeURIComponent(`CompanyId eq '${esc(company)}' and EmpNo eq '${esc(empNo)}'`)
  return tekKayit(`EmployeesHandling.svc/CompanyPersons?$filter=${f}`)
}

export async function createCompanyPerson(g: CompanyPersonGirdi) {
  const { company } = getIfsConfig()
  return istek('EmployeesHandling.svc/CompanyPersons', {
    method: 'POST',
    body: JSON.stringify({
      CompanyId: company,
      EmpNo: g.empNo,
      PersonId: g.empNo, // IG002 deseni: PersonId = EmpNo
      Fname: g.fname,
      Lname: g.lname,
      InternalDisplayName: g.displayName, // zorunlu (NAMENULL)
      ExternalDisplayName: g.displayName,
      EmploymentDate: g.employmentDate,
      EmploymentEndDate: IFS_ACIK_UCLU_TARIH,
      ValidFrom: g.employmentDate,
      ValidTo: IFS_ACIK_UCLU_TARIH, // zorunlu (NULLVALUE ValidTo)
      EmpOrgCode: g.orgCode, // zorunlu (ORGCODENULL)
      EmpPosCode: g.posCode,
      EmploymentType: IFS_EMPLOYMENT_TYPE, // zorunlu (EMPTYPENULL)
      DegreeOfOccupation: IFS_DEGREE_OF_OCCUPATION, // zorunlu
      EntitledToOvertime: IFS_ENTITLED_TO_OVERTIME, // zorunlu (OVERTIME_ENTITLED)
    }),
  })
}

// ── KATMAN 2: ShopFloorEmployee ──────────────────────────────────────────

export async function getShopFloorEmployee(empNo: string) {
  const { company } = getIfsConfig()
  const f = encodeURIComponent(`Company eq '${esc(company)}' and EmployeeId eq '${esc(empNo)}'`)
  return tekKayit(`ShopFloorEmployeesHandling.svc/ShopFloorEmployees?$filter=${f}`)
}

export async function createShopFloorEmployee(empNo: string) {
  const { company } = getIfsConfig()
  return istek('ShopFloorEmployeesHandling.svc/ShopFloorEmployees', {
    method: 'POST',
    body: JSON.stringify({
      Company: company,
      EmployeeId: empNo,
      PersonId: empNo,
      AllowConcurrentOp: 'AskNewActivity',
      AllowEmpTimeManagement: true,
      AttendanceAutoClockIn: 'Warning',
      ResumeOption: 'NoResume',
      WorkbenchUser: true,
    }),
  })
}

// ── KATMAN 3: ShopFloorEmployeeSite ──────────────────────────────────────

export async function getShopFloorEmployeeSite(empNo: string) {
  const { company, contract } = getIfsConfig()
  const f = encodeURIComponent(
    `Company eq '${esc(company)}' and Contract eq '${esc(contract)}' and EmployeeId eq '${esc(empNo)}'`,
  )
  return tekKayit(`ShopFloorEmployeesHandling.svc/ShopFloorEmployeeSites?$filter=${f}`)
}

export async function createShopFloorEmployeeSite(empNo: string, laborClass: string) {
  const { company, contract } = getIfsConfig()
  return istek('ShopFloorEmployeesHandling.svc/ShopFloorEmployeeSites', {
    method: 'POST',
    body: JSON.stringify({
      Company: company,
      Contract: contract,
      EmployeeId: empNo,
      PrimaryContract: true,
      PrimaryLaborClass: laborClass,
      LaborClassResource: true,
      DispListFilterBy: 'PredefinedFilter',
      UseHrSchedule: false,
    }),
  })
}

/**
 * Site'ı pasifleştir. IFS'te "Inactive" durumu YOK — bound action'lar
 * SetActive / SetBlocked / SetHidden. Pasif karşılığı SetBlocked.
 */
export async function blockShopFloorEmployeeSite(empNo: string) {
  const { company, contract } = getIfsConfig()
  const key = `(Company='${esc(company)}',Contract='${esc(contract)}',EmployeeId='${esc(empNo)}')`
  return istek(
    `ShopFloorEmployeesHandling.svc/ShopFloorEmployeeSites${key}` +
      `/IfsApp.ShopFloorEmployeesHandling.ShopFloorEmployeeSite_SetBlocked`,
    { method: 'POST', body: JSON.stringify({}) },
  )
}
