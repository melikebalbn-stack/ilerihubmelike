import 'server-only'
import { masPool, sql } from './client'

/**
 * MAS MES üretim/duruş SALT OKUMA. Şema 14.09 canlı MAS (SQL Server 2022) üzerinde teyit edildi:
 * ProductionDetail'de OperationId YOK → operasyon WorkOrder.OperationId → Phase.Operation'dan gelir.
 * Bir ProductionMaster birden çok WorkOrder/operasyon satırı döndürebilir (gruplama mapper'da).
 * Parametreli sorgu; string birleştirme yok.
 */
export interface MasUretimSatiri {
  masId: number
  masDetayId: number | null
  startDateTime: Date | null
  endDateTime: Date | null
  tezgahKod: string | null
  createdBy: string | null
  workOrderNo: string | null
  operasyonNo: string | null
  amount: number | null
  reportedAmount: number | null
  cycleTime: number | null
  counterMultiplier: number | null
  counterDivider: number | null
  isFinished: boolean | null
}

export interface MasOperatorSatiri {
  masId: number
  employeeNo: string | null
  ad: string | null
}

export interface MasDurusSatiri {
  id: number
  masId: number | null
  tezgahKod: string | null
  baslangic: Date | null
  sureSn: number | null
  sebepKod: string | null
  sebepAd: string | null
  not: string | null
}

// ProductionMaster + WorkCenter + ProductionDetail + WorkOrder + Operation (teyit edilmiş JOIN).
const URETIM_SELECT =
  `SELECT pm.Id AS masId, pd.Id AS masDetayId, pm.StartDateTime AS startDateTime, pm.EndDateTime AS endDateTime, ` +
  `wc.Code AS tezgahKod, ` +
  `pm.CreatedBy AS createdBy, wo.WorkOrderNo AS workOrderNo, o.Code AS operasyonNo, ` +
  `pd.Amount AS amount, pd.ReportedAmount AS reportedAmount, pd.CycleTime AS cycleTime, ` +
  `pd.CounterMultiplier AS counterMultiplier, pd.CounterDivider AS counterDivider, pd.IsFinished AS isFinished ` +
  `FROM Production.ProductionMaster pm ` +
  `JOIN Organization.WorkCenter wc ON wc.Id = pm.WorkCenterId ` +
  `LEFT JOIN Production.ProductionDetail pd ON pd.ProductionMasterId = pm.Id AND pd.Active = 1 ` +
  `LEFT JOIN Planning.WorkOrder wo ON wo.Id = pd.WorkOrderId ` +
  `LEFT JOIN Phase.Operation o ON o.Id = wo.OperationId`

/** Açık üretimler: EndDateTime IS NULL AND Active=1. Satır = pm × detay (bir pm birden çok WO). */
export async function acikUretimler(): Promise<MasUretimSatiri[]> {
  const pool = await masPool()
  const res = await pool
    .request()
    .query<MasUretimSatiri>(`${URETIM_SELECT} WHERE pm.EndDateTime IS NULL AND pm.Active = 1 ORDER BY pm.Id DESC`)
  return res.recordset
}

/**
 * Kapanan üretimler (EndDateTime dolu). sinceId verilirse pm.Id > sinceId; sinceDate verilirse
 * pm.EndDateTime >= sinceDate. İkisi de yoksa son 500 (güvenlik için TOP). Artan Id.
 */
export async function kapananUretimler(opts: { sinceId?: number; sinceDate?: Date } = {}): Promise<MasUretimSatiri[]> {
  const pool = await masPool()
  const rq = pool.request()
  const conds = ['pm.EndDateTime IS NOT NULL', 'pm.Active = 1']
  if (opts.sinceId != null) {
    rq.input('sinceId', sql.Int, opts.sinceId)
    conds.push('pm.Id > @sinceId')
  }
  if (opts.sinceDate != null) {
    rq.input('sinceDate', sql.DateTime2, opts.sinceDate)
    conds.push('pm.EndDateTime >= @sinceDate')
  }
  const top = opts.sinceId == null && opts.sinceDate == null ? 'TOP 500 ' : ''
  const res = await rq.query<MasUretimSatiri>(
    `${URETIM_SELECT.replace('SELECT ', `SELECT ${top}`)} WHERE ${conds.join(' AND ')} ORDER BY pm.Id ASC`,
  )
  return res.recordset
}

/** Açık üretimlerin operatörleri (ProductionUser.EndDateTime IS NULL) → Auth.User.EmployeeNo. */
export async function acikOperatorler(): Promise<MasOperatorSatiri[]> {
  const pool = await masPool()
  const res = await pool.request().query<MasOperatorSatiri>(
    `SELECT pu.ProductionMasterId AS masId, u.EmployeeNo AS employeeNo, ` +
      `LTRIM(RTRIM(CONCAT(u.FirstName, ' ', u.LastName))) AS ad ` +
      `FROM Production.ProductionUser pu ` +
      `JOIN Auth.[User] u ON u.Id = pu.UserId ` +
      `WHERE pu.EndDateTime IS NULL AND pu.Active = 1 ` +
      `AND pu.ProductionMasterId IN (SELECT Id FROM Production.ProductionMaster WHERE EndDateTime IS NULL AND Active = 1)`,
  )
  return res.recordset
}

/** Açık duruşlar: Production.ProductionDowntime (EndDateTime IS NULL) + Loss.Downtime (kod/ad). */
export async function acikDuruslar(): Promise<MasDurusSatiri[]> {
  const pool = await masPool()
  const res = await pool.request().query<MasDurusSatiri>(
    `SELECT pdt.Id AS id, pdt.ProductionMasterId AS masId, wc.Code AS tezgahKod, ` +
      `pdt.StartDateTime AS baslangic, pdt.Duration AS sureSn, ` +
      `d.Code AS sebepKod, d.Name AS sebepAd, pdt.StartComment AS not ` +
      `FROM Production.ProductionDowntime pdt ` +
      `JOIN Loss.Downtime d ON d.Id = pdt.DowntimeId ` +
      `LEFT JOIN Organization.WorkCenter wc ON wc.Id = pdt.WorkCenterId ` +
      `WHERE pdt.EndDateTime IS NULL AND pdt.Active = 1 ORDER BY pdt.StartDateTime DESC`,
  )
  return res.recordset
}
