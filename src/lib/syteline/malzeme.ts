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
 * Watermark'tan (dahil değil, `>`) sonraki TÜM aktif malzemeleri TEK sorguda getirir
 * (TOP/limit YOK — ~17k satır küçük, streaming gerekmez). site env'de tanımlıysa site_ref
 * ile de süzülür. ORDER BY RecordDate, item deterministik watermark ilerletme sağlar.
 */
export async function getMalzemeler(watermark: Date): Promise<SytelineMalzemeSatiri[]> {
  const cfg = getSytelineConfig()
  const pool = await sytePool()
  const rq = pool.request().input('wm', sql.DateTime2, watermark)
  let siteClause = ''
  if (cfg.site) {
    rq.input('site', sql.NVarChar, cfg.site)
    siteClause = ' AND site_ref = @site'
  }
  // product_code <> '9999' → test parçalarını dışla (TESTA/TESTB… vb.).
  const query =
    `SELECT site_ref, item, description, u_m, product_code, p_m_t_code, ` +
    `family_code, stat, lot_tracked, revision, drawing_nbr, RecordDate ` +
    `FROM item_mst WHERE stat = 'A' AND RecordDate > @wm AND (product_code IS NULL OR product_code <> '9999')${siteClause} ` +
    `ORDER BY RecordDate, item`
  const res = await rq.query<SytelineMalzemeSatiri>(query)
  return res.recordset
}

/**
 * Belirli item kodlarının GÜNCEL aktif satırlarını getirir (watermark'sız). Kuyruğu işlerken
 * kayıtları payload'dan değil, güncel eşleme ile YENİDEN map etmek için kullanılır — böylece
 * eşleme değişiklikleri bekleyen kayıtlara da yansır. Parametreli IN — string birleştirme YOK.
 * Boş liste → boş dizi (sorgu atılmaz).
 */
export async function getMalzemelerByItems(items: string[]): Promise<SytelineMalzemeSatiri[]> {
  const temiz = [...new Set(items.map((i) => i.trim()).filter(Boolean))]
  if (temiz.length === 0) return []
  const cfg = getSytelineConfig()
  const pool = await sytePool()
  const rq = pool.request()
  const yerTutucular: string[] = []
  temiz.forEach((it, idx) => {
    rq.input(`i${idx}`, sql.NVarChar, it)
    yerTutucular.push(`@i${idx}`)
  })
  let siteClause = ''
  if (cfg.site) {
    rq.input('site', sql.NVarChar, cfg.site)
    siteClause = ' AND site_ref = @site'
  }
  const query =
    `SELECT site_ref, item, description, u_m, product_code, p_m_t_code, ` +
    `family_code, stat, lot_tracked, revision, drawing_nbr, RecordDate ` +
    `FROM item_mst WHERE stat = 'A' AND item IN (${yerTutucular.join(', ')})${siteClause}`
  const res = await rq.query<SytelineMalzemeSatiri>(query)
  return res.recordset
}
