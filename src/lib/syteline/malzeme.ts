import 'server-only'
import { sytePool, sql } from './client'
import { getSytelineConfig } from './config'

/**
 * Syteline item_mst (malzeme master) SALT OKUMA. Parametreli sorgu — string birleştirme YASAK.
 * Watermark (RecordDate) sonrası, stat='A' (aktif), opsiyonel site_ref filtresi ile artan sırada.
 */
export interface SytelineMalzemeSatiri {
  site_ref: string | null
  item: string
  description: string | null
  u_m: string | null
  product_code: string | null
  p_m_t_code: string | null
  family_code: string | null
  stat: string | null
  lot_tracked: string | null
  revision: string | null
  drawing_nbr: string | null
  RecordDate: Date
}

/**
 * Watermark'tan (dahil değil, `>`) sonraki aktif malzemeleri getirir. site env'de tanımlıysa
 * site_ref ile de süzülür. limit ile üst sınır (batch'ten büyük çekip client tarafında işleriz).
 */
export async function getMalzemeler(watermark: Date, limit = 500): Promise<SytelineMalzemeSatiri[]> {
  const cfg = getSytelineConfig()
  const pool = await sytePool()
  const rq = pool
    .request()
    .input('wm', sql.DateTime2, watermark)
    .input('lim', sql.Int, limit)
  let siteClause = ''
  if (cfg.site) {
    rq.input('site', sql.NVarChar, cfg.site)
    siteClause = ' AND site_ref = @site'
  }
  // TOP (@lim) — parametreli; ORDER BY RecordDate, item deterministik watermark ilerletme.
  const query =
    `SELECT TOP (@lim) site_ref, item, description, u_m, product_code, p_m_t_code, ` +
    `family_code, stat, lot_tracked, revision, drawing_nbr, RecordDate ` +
    `FROM item_mst WHERE stat = 'A' AND RecordDate > @wm${siteClause} ` +
    `ORDER BY RecordDate, item`
  const res = await rq.query<SytelineMalzemeSatiri>(query)
  return res.recordset
}
