import 'server-only'
import { sytePool, sql } from './client'
import { getSytelineConfig } from './config'

/**
 * Syteline iş emri (job_mst) + rota operasyonları SALT OKUMA. Parametreli sorgu — string
 * birleştirme YASAK. Malzeme akışının (malzeme.ts) kardeşi; watermark (RecordDate) mantığı aynı.
 */
export interface SytelineIsEmriBaslik {
  job: string
  suffix: number | null
  item: string | null
  qty_released: number | null
  job_date: Date | null
  stat: string | null
  description: string | null
  RecordDate: Date
}

export interface SytelineIsEmriOperasyon {
  oper_num: number | null
  wc: string | null
  RESID: string | null
  pcs_per_mch_hr: number | null
  setup_hrs: number | null
  qty_received: number | null
}

/**
 * Watermark'tan (`>`) sonraki serbest bırakılmış (stat='R') üretim (type='J') iş emri başlıkları.
 * site env'de tanımlıysa site_ref ile süzülür. ORDER BY RecordDate, job → deterministik watermark.
 */
export async function getIsEmrileri(watermark: Date): Promise<SytelineIsEmriBaslik[]> {
  const cfg = getSytelineConfig()
  const pool = await sytePool()
  const rq = pool.request().input('wm', sql.DateTime2, watermark)
  let siteClause = ''
  if (cfg.site) {
    rq.input('site', sql.NVarChar, cfg.site)
    siteClause = ' AND site_ref = @site'
  }
  const query =
    `SELECT job, suffix, item, qty_released, job_date, stat, description, RecordDate ` +
    `FROM job_mst WHERE type = 'J' AND stat = 'R' AND RecordDate > @wm${siteClause} ` +
    `ORDER BY RecordDate, job`
  const res = await rq.query<SytelineIsEmriBaslik>(query)
  return res.recordset
}

/**
 * Belirli job kodlarının GÜNCEL serbest (stat='R') üretim iş emri başlıkları (watermark'sız).
 * Kuyruğu işlerken kayıtları payload'dan değil güncel eşleme ile YENİDEN map etmek için
 * (getMalzemelerByItems kardeşi). Parametreli IN. Boş liste → boş dizi.
 */
export async function getIsEmrileriByJobs(jobs: string[]): Promise<SytelineIsEmriBaslik[]> {
  const temiz = [...new Set(jobs.map((j) => j.trim()).filter(Boolean))]
  if (temiz.length === 0) return []
  const cfg = getSytelineConfig()
  const pool = await sytePool()
  const rq = pool.request()
  const yerTutucular: string[] = []
  temiz.forEach((j, idx) => {
    rq.input(`j${idx}`, sql.NVarChar, j)
    yerTutucular.push(`@j${idx}`)
  })
  let siteClause = ''
  if (cfg.site) {
    rq.input('site', sql.NVarChar, cfg.site)
    siteClause = ' AND site_ref = @site'
  }
  const query =
    `SELECT job, suffix, item, qty_released, job_date, stat, description, RecordDate ` +
    `FROM job_mst WHERE type = 'J' AND stat = 'R' AND job IN (${yerTutucular.join(', ')})${siteClause} ` +
    `ORDER BY job, suffix`
  const res = await rq.query<SytelineIsEmriBaslik>(query)
  return res.recordset
}

/**
 * Bir iş emrinin (job + suffix) rota operasyonları — tezgah (wc), kaynak (RESID), çevrim
 * (pcs_per_mch_hr), setup ve alınan miktar. Parametreli. ORDER BY oper_num.
 */
export async function getIsEmriOperasyonlari(job: string, suffix: number): Promise<SytelineIsEmriOperasyon[]> {
  const pool = await sytePool()
  const rq = pool.request().input('job', sql.NVarChar, job).input('suffix', sql.Int, suffix)
  const query =
    `SELECT r.oper_num, r.wc, m.RESID, s.pcs_per_mch_hr, s.setup_hrs, r.qty_received ` +
    `FROM jobroute_mst r ` +
    `LEFT JOIN jrtresourcegroup_mst g ON g.job = r.job AND g.suffix = r.suffix AND g.oper_num = r.oper_num ` +
    `LEFT JOIN RGRPMBR000_mst m ON m.RGID = g.rgid AND m.SEQNO = 1 ` +
    `LEFT JOIN JRT_SCH_mst s ON s.job = r.job AND s.suffix = r.suffix AND s.oper_num = r.oper_num ` +
    `WHERE r.job = @job AND r.suffix = @suffix ORDER BY r.oper_num`
  const res = await rq.query<SytelineIsEmriOperasyon>(query)
  return res.recordset
}
