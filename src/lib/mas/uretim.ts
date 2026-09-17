import 'server-only'
import { masPool, sql } from './client'
import { masTarih } from './tarih'

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
  description: string | null // WorkOrder.Description → ifsPartDescription
  planlananAdet: number | null // WorkOrder.Amount → ifsQtyDue
  deliveryDateTime: Date | null // WorkOrder.DeliveryDateTime → ifsDueDate
  amount: number | null
  reportedAmount: number | null
  cycleTime: number | null // COALESCE(pd.CycleTime, wo.CycleTime) saniye/adet
  counterMultiplier: number | null
  counterDivider: number | null
  isFinished: boolean | null
  active: boolean | null // ProductionMaster.Active — kapanış tespitinde (Active=0 → kapalı sayılır)
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

// MAS datetime'ları yerel(İstanbul)-yanlış-UTC → doğru UTC. TÜM tarih alanları buradan geçer (masTarih).
function uretimTarihNormalize(r: MasUretimSatiri): MasUretimSatiri {
  return {
    ...r,
    startDateTime: masTarih(r.startDateTime),
    endDateTime: masTarih(r.endDateTime),
    deliveryDateTime: masTarih(r.deliveryDateTime),
  }
}

// ProductionMaster + WorkCenter + ProductionDetail + WorkOrder + Operation (teyit edilmiş JOIN).
const URETIM_SELECT =
  `SELECT pm.Id AS masId, pd.Id AS masDetayId, pm.StartDateTime AS startDateTime, pm.EndDateTime AS endDateTime, ` +
  `wc.Code AS tezgahKod, ` +
  `pm.CreatedBy AS createdBy, wo.WorkOrderNo AS workOrderNo, o.Code AS operasyonNo, ` +
  `wo.Description AS description, wo.Amount AS planlananAdet, wo.DeliveryDateTime AS deliveryDateTime, ` +
  `pd.Amount AS amount, pd.ReportedAmount AS reportedAmount, COALESCE(pd.CycleTime, wo.CycleTime) AS cycleTime, ` +
  `pd.CounterMultiplier AS counterMultiplier, pd.CounterDivider AS counterDivider, pd.IsFinished AS isFinished, ` +
  `pm.Active AS active ` +
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
  return res.recordset.map(uretimTarihNormalize)
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
  return res.recordset.map(uretimTarihNormalize)
}

/**
 * Belirli ProductionMaster.Id'lerin GÜNCEL durumu (KAPANIŞ tespiti için — PENCERE YOK).
 * IPRO'da ACIK kalan MAS kayıtlarının hâlâ açık mı yoksa kapanmış/pasif/silinmiş mi olduğunu
 * anlamak için kullanılır. IN listesi 500'lük batch'lenir (parametre limiti). Bir id hiç dönmezse
 * MAS'ta o kayıt yok demektir → çağıran "kapalı" sayar. endDateTime masTarih ile normalize edilir.
 */
export async function uretimlerByMasIds(ids: number[]): Promise<MasUretimSatiri[]> {
  const uniq = [...new Set(ids)].filter((n) => Number.isFinite(n))
  if (uniq.length === 0) return []
  const pool = await masPool()
  const out: MasUretimSatiri[] = []
  for (let i = 0; i < uniq.length; i += 500) {
    const dilim = uniq.slice(i, i + 500)
    const rq = pool.request()
    const params: string[] = []
    dilim.forEach((id, j) => {
      rq.input(`id${j}`, sql.Int, id)
      params.push(`@id${j}`)
    })
    const res = await rq.query<MasUretimSatiri>(`${URETIM_SELECT} WHERE pm.Id IN (${params.join(',')})`)
    out.push(...res.recordset.map(uretimTarihNormalize))
  }
  return out
}

/**
 * MAS'ta ŞU AN açık duruşu olan tezgah kodları (PENCERE YOK — kapanış tespiti için).
 * acikDuruslar() son N saatle sınırlıyken bu, tüm açık duruşların tezgah kümesini verir; IPRO'da
 * açık kalan MAS duruşlarından bu kümede OLMAYANLAR kapatılır (bayat pencere yüzünden açık kalmasın).
 */
export async function acikDurusTezgahKodlari(): Promise<string[]> {
  const pool = await masPool()
  const res = await pool.request().query<{ tezgahKod: string | null }>(
    `SELECT DISTINCT wc.Code AS tezgahKod ` +
      `FROM Production.ProductionDowntime pdt ` +
      `JOIN Organization.WorkCenter wc ON wc.Id = pdt.WorkCenterId ` +
      `WHERE pdt.EndDateTime IS NULL AND pdt.Active = 1`,
  )
  return res.recordset.map((r) => r.tezgahKod).filter((k): k is string => !!k)
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

/** MAS_DURUS_SAAT (varsayılan 24): açık duruşta yalnız son N saati al — 2017 çöp kayıtları eler. */
function durusSaat(): number {
  const n = Number(process.env.MAS_DURUS_SAAT)
  return Number.isFinite(n) && n > 0 ? n : 24
}

/**
 * Açık duruşlar: Production.ProductionDowntime (EndDateTime IS NULL) + Loss.Downtime (kod/ad).
 * İki süzgeç (14.09 ölçümü: 219 açık duruşun 190'ı 2017 tarihli çöp, tezgahsız değil ama bayat):
 *  - WorkCenterId IS NOT NULL → tezgahı çözülemeyen duruş alınmaz (MAS'ta duruş tezgahı WorkCenterId'den
 *    gelir, ProductionMasterId neredeyse hep NULL — o kolon ayraç DEĞİL).
 *  - StartDateTime >= son MAS_DURUS_SAAT saat → eski/çöp kayıtları eler (son 24s'te ~29 gerçek duruş).
 */
export async function acikDuruslar(opts: { saat?: number } = {}): Promise<MasDurusSatiri[]> {
  const pool = await masPool()
  const saat = opts.saat != null && opts.saat > 0 ? opts.saat : durusSaat()
  const res = await pool
    .request()
    .input('saat', sql.Int, saat)
    .query<MasDurusSatiri>(
      `SELECT pdt.Id AS id, pdt.ProductionMasterId AS masId, wc.Code AS tezgahKod, ` +
        `pdt.StartDateTime AS baslangic, pdt.Duration AS sureSn, ` +
        `d.Code AS sebepKod, d.Name AS sebepAd, pdt.StartComment AS [not] ` +
        `FROM Production.ProductionDowntime pdt ` +
        `JOIN Loss.Downtime d ON d.Id = pdt.DowntimeId ` +
        `JOIN Organization.WorkCenter wc ON wc.Id = pdt.WorkCenterId ` +
        `WHERE pdt.EndDateTime IS NULL AND pdt.Active = 1 ` +
        `AND pdt.StartDateTime >= DATEADD(HOUR, -@saat, SYSDATETIME()) ` +
        `ORDER BY pdt.StartDateTime DESC`,
    )
  // Duruş başlangıcı da MAS yerel-yanlış-UTC → doğru UTC. (Bu sorgu yalnız açık duruş → bitiş yok.)
  return res.recordset.map((r) => ({ ...r, baslangic: masTarih(r.baslangic) }))
}
