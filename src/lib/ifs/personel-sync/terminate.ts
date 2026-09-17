/**
 * İSTİHDAM SONLANDIRMA — TerminateEmploymentHandling.svc (IFS "Terminate Employment" asistanı).
 *
 * Neden asistan: EmpEmployedTimes PATCH ve CompanyPersons PATCH/DELETE bu istemciye 500
 * ODP_ILLEGAL_STATE veriyor (16-17.09). Asistan projeksiyonu yazmaya açık; sıra Aurena'nın
 * ağ kaydından (~/scratch/ilr01140-terminate.har, 17.09) birebir alındı, ILR-01116'da OData'dan
 * doğrulandı (18.09): DateOfLeaving + LeavingCauseId + EmployeeStatus yazıldı.
 *
 * Kurallar (HAR'dan):
 *  - StepId'ler METİN: START / EMPLT / WARNINGS_ERRORS; ActiveSteps ';' ayraçlı adım adları.
 *  - Parent POST: _Default() çıktısındaki TÜM tarih alanları (41) = çıkış tarihi; NotificationDate
 *    = EmploymentEndDate (aksi hâlde "Bildirim tarihi … eski olmamalıdır" uyarısı).
 *  - Decimal alanlar SAYI (istemcimiz IEEE754Compatible başlığı göndermez; Aurena string gönderir).
 *  - LeavingCauseArray'e POST YOK; neden parent'a PATCH'lenir, LeavingInformationUpdate(EMPLT) kopyalar.
 *  - ValidateTerminationProcessStep ErrorCount>0 → HATA (Finish çağrılmaz). WarnCount yalnız log
 *    (PRIMARY/SECONDARY_POSITION_VALID_TO beklenen uyarılar).
 *  - Her hata yolunda CleanupVirtualEntity — sanal satır IFS'te kalmasın.
 */
import { IFS_COMPANY } from './kodlar'
import { IfsSyncHatasi, getEmpEmployedTime, getEmployee, istek } from './ifs-api'

const SVC = 'TerminateEmploymentHandling.svc/'
const ACTIVE_STEPS = 'EmployeeSelection;LeavingInformation;PersonAssignments;Assignments;OtherAssignments;TerminationProcess;ErrorsAndWarnings'
const STATUS_AYRILDI = 'ISTEN AYRILMIS'

export interface SonlandirmaGirdi {
  empNo: string
  /** YYYY-MM-DD — Hub çıkış tarihi. */
  bitis: string
  leavingCauseId: number
  leavingCauseType: string
}
export interface SonlandirmaSonucu {
  status: number
  objkey: string
  uyarilar: string[]
  /** Finish dönüş değeri (süreç sıra no). */
  termProcessId: number | null
}
interface ErrorsWarnings { ErrorCount?: number | string | null; WarnCount?: number | string | null; ErrorsWarningsCount?: number | string | null }
interface UyariSatiri { EmpNo?: string; SqlColumn?: string; EmployeeMessageType?: string; Info?: string }

const q = (s: string) => s.replace(/'/g, "''")
const sayi = (v: unknown) => (v === null || v === undefined || v === '' ? 0 : Number(v))
/** IFS uyarı metinlerinde 0x1F/0x1E ayraçları var — temizle. */
const temizMetin = (s: unknown) => String(s ?? '').replace(/[\x1e\x1f]/g, '').trim()

export async function istihdamSonlandir(g: SonlandirmaGirdi): Promise<SonlandirmaSonucu> {
  const emp = await getEmployee(g.empNo)
  if (!emp) throw new IfsSyncHatasi(404, `çalışan IFS'te yok`, `${SVC}TerminateEmployments`)

  // 1) Varsayılanlar — tarih alanlarının listesi buradan (sabit yazmıyoruz; IFS sürümüyle değişebilir).
  const def = (await istek<Record<string, unknown>>(`${SVC}TerminateEmployments/IfsApp.TerminateEmploymentHandling.TerminateEmploymentVirtual_Default()`)).body
  const tarihAlanlari = Object.entries(def).filter(([k, v]) => !k.startsWith('@') && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)).map(([k]) => k)

  // 2) Sanal parent
  const parentGovde: Record<string, unknown> = {
    EndSubordinateAssignments: false, EndSupervisorAssignments: true, SuboodinatesExist: false, InSalaryPlan: false, ProbationStatusExist: false,
    CompanyId: IFS_COMPANY, EmpGroupType: 'Custom', TerminateProcessTmpSeq: sayi(def.TerminateProcessTmpSeq ?? 12), CountVar: 0,
    DataSubject: 'EMPLOYEE', ConsentAction: 'NEW_PURPOSE', GdprEnabled: 'FALSE', IsLeavingInfoChanged: 'FALSE',
  }
  for (const k of tarihAlanlari) parentGovde[k] = g.bitis
  const parent = await istek<Record<string, unknown>>(`${SVC}TerminateEmployments`, { method: 'POST', body: JSON.stringify(parentGovde) })
  const objkey = String(parent.body.Objkey)
  const pyol = `${SVC}TerminateEmployments(Objkey='${q(objkey)}')`

  const cleanup = async () => { await istek(`${pyol}/IfsApp.TerminateEmploymentHandling.TerminateEmploymentVirtual_CleanupVirtualEntity`, { method: 'POST', body: '{}' }).catch(() => undefined) }
  const patch = async (govde: Record<string, unknown>) => {
    const cur = await istek<Record<string, unknown>>(pyol)
    return istek<Record<string, unknown>>(pyol, { method: 'PATCH', headers: { 'If-Match': cur.etag ?? '*' }, body: JSON.stringify(govde) })
  }

  try {
    // 3) Çalışan seçimi
    await istek(`${SVC}CheckIfValidEmployee`, { method: 'POST', body: JSON.stringify({ CompanyId: IFS_COMPANY, EmpNo: g.empNo }) })
    await istek(`${pyol}/EmployeeArray`, {
      method: 'POST',
      body: JSON.stringify({
        ParentObjkey: objkey, CompanyId: IFS_COMPANY, EmpNo: g.empNo,
        EmploymentStartDate: emp.body.EmploymentDate, EmploymentEndDate: emp.body.EmploymentEndDate, EmployeeStatus: '*',
        OrgCode: emp.body.OrgCode, PosCode: emp.body.PosCode,
      }),
    })
    await istek(`${SVC}CheckEmploymentPeriodExist(ParentObjkey='${q(objkey)}')`)
    await istek(`${SVC}CheckSubordinatesExists`, { method: 'POST', body: JSON.stringify({ ParentObjkey: objkey }) })
    await istek(`${SVC}ValidateEmpSelectionAndClear`, { method: 'POST', body: JSON.stringify({ Objkey: objkey, StepId: 'START' }) })

    // 4) Ayrılma bilgisi — tüm tarih alanları = çıkış, NotificationDate dahil
    const bitisGovde: Record<string, unknown> = { EmploymentEndDate: g.bitis, NotificationDate: g.bitis, UpdateDate: g.bitis, IsLeavingInfoChanged: 'TRUE' }
    for (const k of tarihAlanlari) if (!(k in bitisGovde)) bitisGovde[k] = g.bitis
    await patch(bitisGovde)
    await patch({ EmploymentEndType: 'Terminate' })
    await patch({ LeavingCauseType: g.leavingCauseType, LeavingCauseId: g.leavingCauseId })
    await patch({ EmployeeStatus: STATUS_AYRILDI })
    await istek(`${SVC}LeavingInformationUpdate`, { method: 'POST', body: JSON.stringify({ Objkey: objkey, StepId: 'EMPLT' }) })
    await patch({ IsLeavingInfoChanged: 'FALSE' })

    // 5) Adım doğrulamaları (fonksiyon çağrıları; hata fırlatırsa dururuz)
    await istek(`${SVC}ValidatePersonAssignmentsStep(Objkey='${q(objkey)}',StepId='PERSON_ASSIGNMENT')`)
    await istek(`${SVC}ValidateAssignmentsStep(Objkey='${q(objkey)}',StepId='ASSIGNMENT_SCHED')`)
    await istek(`${SVC}ValidateOtherAssignmentsStep(Objkey='${q(objkey)}',StepId='COMP_COST_EXP')`)

    // 6) Süreç doğrulama — hata varsa DUR
    const v = await istek<ErrorsWarnings>(`${SVC}ValidateTerminationProcessStep`, { method: 'POST', body: JSON.stringify({ Objkey: objkey, ActiveSteps: ACTIVE_STEPS }) })
    const errorCount = sayi(v.body.ErrorCount), warnCount = sayi(v.body.WarnCount)
    await patch({ ErrorCount: errorCount, WarnCount: warnCount, InSalaryPlan: null })
    const ew = await istek<{ value?: UyariSatiri[] }>(`${pyol}/ErrorsAndWarningsArray?$orderby=SeqNo&$select=EmpNo,SqlColumn,EmployeeMessageType,Info`)
    const satirlar = (ew.body.value ?? []).map((s) => `${s.EmployeeMessageType ?? '?'} ${s.SqlColumn ?? ''}: ${temizMetin(s.Info)}`)
    if (errorCount > 0) throw new IfsSyncHatasi(422, `sonlandırma doğrulaması ${errorCount} hata: ${satirlar.join(' | ').slice(0, 400)}`, pyol)
    if (warnCount > 0) console.warn(`[ifs-terminate] ${g.empNo}: ${warnCount} uyarı — ${satirlar.join(' | ')}`)

    // 7) Finish
    const fin = await istek<{ value?: number | string }>(`${SVC}FinishTeminateEmploymentAssistant`, {
      method: 'POST', body: JSON.stringify({ Objkey: objkey, StepId: 'WARNINGS_ERRORS', SkipErrorsWarnings: 0, ActiveSteps: ACTIVE_STEPS }),
    })
    const termProcessId = fin.body?.value === undefined || fin.body?.value === null ? null : Number(fin.body.value)
    if (termProcessId !== null && Number.isFinite(termProcessId)) await patch({ TermProcessId: termProcessId }).catch(() => undefined)
    await cleanup()

    // 8) Round-trip — istihdam dönemi gerçekten kapandı mı
    const donem = await getEmpEmployedTime(g.empNo)
    const uyusmayan: string[] = []
    if (donem?.DateOfLeaving !== g.bitis) uyusmayan.push(`DateOfLeaving ${donem?.DateOfLeaving ?? 'yok'}≠${g.bitis}`)
    if (sayi(donem?.LeavingCauseId) !== g.leavingCauseId) uyusmayan.push(`LeavingCauseId ${donem?.LeavingCauseId ?? 'yok'}≠${g.leavingCauseId}`)
    if (donem?.EmployeeStatus !== STATUS_AYRILDI) uyusmayan.push(`EmployeeStatus ${donem?.EmployeeStatus ?? 'yok'}≠${STATUS_AYRILDI}`)
    if (uyusmayan.length) throw new IfsSyncHatasi(fin.status, `round-trip: Finish ${fin.status} ama ${uyusmayan.join('; ')}`, pyol)
    return { status: fin.status, objkey, uyarilar: satirlar, termProcessId }
  } catch (e) {
    await cleanup()
    throw e
  }
}
