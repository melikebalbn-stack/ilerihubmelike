import 'server-only'
import { getIfsConfig } from './config'
import { getIfsAccessToken } from './token'
import { dostaneIfsHata } from './ifs-hata'
import { getStokSatirlari, type FifoKaynak } from './tuketim'

/**
 * IFS Barcode ID çözücü (EL-9b). SERVER-ONLY.
 *
 * Keşif (EL-9a): barkod verisi InventoryPartInStockHandling içindeki InventoryPartBarcode
 * alt-entity'sinde; erişim seti Reference_InventoryPartBarcodeLov (anahtar BarcodeId+Contract).
 * Barkod KONUM taşımaz (LocationNo/HandlingUnitId yok) → kimlik→raf eşlemesi getStokSatirlari
 * ile birleştirilir.
 */

export interface BarkodKimlik {
  barcodeId: number
  partNo: string
  lotBatchNo: string
  serialNo: string
  configurationId: string
  engChgLevel: string
  waivDevRejNo: string
  activitySeq: number
}

function mainRoot(): string {
  const { baseUrl } = getIfsConfig()
  return baseUrl.replace(/[A-Za-z]+\.svc$/, '').replace('/int/', '/main/')
}
const esc = (v: string) => v.replace(/'/g, "''")
const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const str = (v: unknown): string => (v == null ? '' : String(v))

async function mainGet<T = unknown>(pathAndQuery: string): Promise<{ status: number; body: T }> {
  const token = await getIfsAccessToken()
  const res = await fetch(`${mainRoot()}${pathAndQuery}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  const text = await res.text()
  let body: unknown = text
  try { body = text ? JSON.parse(text) : null } catch { /* JSON değil */ }
  return { status: res.status, body: body as T }
}

interface RawBarcode {
  BarcodeId?: number | null
  PartNo?: string | null
  LotBatchNo?: string | null
  SerialNo?: string | null
  ConfigurationId?: string | null
  EngChgLevel?: string | null
  WaivDevRejNo?: string | null
  ActivitySeq?: number | null
}

/**
 * Barkod ID → stok kimliği. Tekil entity GET (Reference_InventoryPartBarcodeLov).
 * 404/400/geçersiz id → null.
 */
export async function cozBarkodId(id: number): Promise<BarkodKimlik | null> {
  if (!Number.isFinite(id) || id <= 0) return null
  const { contract } = getIfsConfig()
  const key = `BarcodeId=${Math.trunc(id)},Contract='${esc(contract)}'`
  const { status, body } = await mainGet<RawBarcode>(
    `InventoryPartInStockHandling.svc/Reference_InventoryPartBarcodeLov(${encodeURI(key)})` +
      `?$select=BarcodeId,PartNo,LotBatchNo,SerialNo,ConfigurationId,EngChgLevel,WaivDevRejNo,ActivitySeq`,
  )
  if (status !== 200 || !body || !body.PartNo) return null
  return {
    barcodeId: num(body.BarcodeId) || Math.trunc(id),
    partNo: str(body.PartNo),
    lotBatchNo: str(body.LotBatchNo) || '*',
    serialNo: str(body.SerialNo) || '*',
    configurationId: str(body.ConfigurationId) || '*',
    engChgLevel: str(body.EngChgLevel) || '*',
    waivDevRejNo: str(body.WaivDevRejNo) || '*',
    activitySeq: num(body.ActivitySeq),
  }
}

const nz = (v: string) => (v && v.trim() ? v : '*')

/**
 * Barkod kimliğinin fiziksel stok satırları (lokasyonlarıyla). getStokSatirlari(partNo) sonucunu
 * barkod anahtarlarıyla (lot/serial/config/ecl/wdr) süzer. Barkodda konum olmadığından birden
 * çok raf dönebilir (tek satır → otomatik seçim; çok satır → seçtir).
 */
export async function bulBarkodunStoklari(kimlik: BarkodKimlik): Promise<FifoKaynak[]> {
  const tumu = await getStokSatirlari(kimlik.partNo)
  return tumu.filter((k) =>
    nz(k.kimlik.lotBatchNo) === nz(kimlik.lotBatchNo) &&
    nz(k.kimlik.serialNo) === nz(kimlik.serialNo) &&
    nz(k.kimlik.configurationId) === nz(kimlik.configurationId) &&
    nz(k.kimlik.engChgLevel) === nz(kimlik.engChgLevel) &&
    nz(k.kimlik.waivDevRejNo) === nz(kimlik.waivDevRejNo),
  )
}

export interface BarkodUretKimlik {
  partNo: string
  lotBatchNo?: string
  serialNo?: string
  configurationId?: string
  engChgLevel?: string
  waivDevRejNo?: string
  activitySeq?: number
  originPackSize?: number
}

/**
 * IFS'te yeni bir barkod ID tahsis eder (entity/v1 gateway; EL-9b'de 201 Created kanıtlandı).
 * BarcodeId GÖNDERİLMEZ → IFS otomatik üretir; dönen değer yeni BarcodeId.
 *
 * ⚠️ Her çağrı BENZERSİZ ve KALICI bir barkod üretir (IFS'te silinemez) → çağıran taraf
 * tekrar-basmayı önlemekten sorumlu. Token her iki gateway'de geçerli (aynı client_credentials).
 * Hata → IFS gövdesi dostaneIfsHata ile sadeleşip Error olarak fırlatılır.
 */
export async function uretBarkod(kimlik: BarkodUretKimlik): Promise<number> {
  const { contract, entityBaseUrl } = getIfsConfig()
  const token = await getIfsAccessToken()
  const body = {
    Contract: contract,
    PartNo: kimlik.partNo,
    LotBatchNo: kimlik.lotBatchNo ?? '*',
    SerialNo: kimlik.serialNo ?? '*',
    EngChgLevel: kimlik.engChgLevel ?? '1',
    WaivDevRejNo: kimlik.waivDevRejNo ?? '*',
    ConfigurationId: kimlik.configurationId ?? '*',
    ActivitySeq: kimlik.activitySeq ?? 0,
    OriginPackSize: kimlik.originPackSize ?? 1,
  }
  const res = await fetch(`${entityBaseUrl}/InventoryPartBarcodeEntity.svc/InventoryPartBarcodeSet`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const text = await res.text()
  if (res.status < 200 || res.status >= 300) {
    throw new Error(dostaneIfsHata(`Barkod üretimi HTTP ${res.status}: ${text.slice(0, 1200)}`, 'Barkod üretilemedi'))
  }
  let raw: unknown
  try { raw = JSON.parse(text)?.BarcodeId } catch { /* gövde parse edilemedi */ }
  const barcodeId = num(raw)
  if (barcodeId <= 0) throw new Error('Barkod üretildi ama BarcodeId okunamadı')
  return barcodeId
}
