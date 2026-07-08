// EL-3c: taşıma desenleri IFS test ortamında DOĞRULANDI (08.07.2026, HTTP 204):
//  - Hedefte parça+lot(+tüm anahtar) YOKSA → CreateInventoryPartInStockDelivery
//    (düz POST; LocationNo=HEDEF, ParentLocationNo=KAYNAK). Test: 40→64 = 204.
//  - Hedefte VARSA → bound Update, navigasyon yoluyla:
//    InventoryPartInStockSet(<kaynak>)/NewPartLocArray(<hedef>)/...Update... . Test: 40→61 = 204.
// Ortak: Destination='MoveToInventory' (sabit), ConsumeStock='N', SessionId/Note yok,
// sayısal alanlar (ActivitySeq/HandlingUnitId/QuantityMoved) Edm.Decimal → HAM SAYI (string 400 verir).
import 'server-only'
import { getIfsConfig } from './config'
import { getIfsAccessToken } from './token'

/**
 * Depo stok/lokasyon okuma + taşıma altyapısı (EL-3b). SERVER-ONLY.
 *
 * Okuma kaynakları (grant'li, /main/ gateway):
 *  - InventoryLocationsHandling/WarehouseBayBinSet  → raf/lokasyon
 *  - MoveInventoryPart.svc/InventoryPartInStockSet  → raftaki stok (10-anahtar kimlik)
 *
 * Yazma: CreateInventoryPartInStockDelivery (moveStok) — YAZILDI ama bu fazda
 * HİÇBİR YERDEN ÇAĞRILMIYOR (EL-3c'de kontrollü test).
 *
 * Auth/token: shop-order-operations.ts ile aynı yapı (getIfsConfig + getIfsAccessToken).
 */

/** IFS stok kaydının 10-anahtarlı tam kimliği (taşıma çağrısında gerekli). */
export interface StokKimlik {
  contract: string
  partNo: string
  configurationId: string
  locationNo: string
  lotBatchNo: string
  serialNo: string
  engChgLevel: string
  waivDevRejNo: string
  activitySeq: number
  handlingUnitId: number
}

/** Terminal görüntüleme + taşıma için stok kaydı (gerçek sözleşme). */
export interface DepoStokKaydi {
  stokKodu: string
  /** PartDescription bu projeksiyonda YOK → şimdilik '' (TODO: parça master lookup). */
  stokAdi: string
  lot?: string
  /** AvailableQtyToMove — taşınabilir miktar. */
  miktar: number
  /** TODO: base UoM alanı bu projeksiyonda yok → 'ad' fallback. */
  birim: string
  kimlik: StokKimlik
}

export interface DepoRafBilgisi {
  locationNo: string
  aciklama: string
  grup: string
}

/** config.baseUrl (.../int/.../v1/ShopFloorService.svc) → ana gateway kökü (.../main/.../v1/). */
function mainRoot(): string {
  const { baseUrl } = getIfsConfig()
  return baseUrl.replace(/[A-Za-z]+\.svc$/, '').replace('/int/', '/main/')
}

const esc = (v: string) => v.replace(/'/g, "''")
const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
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
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    /* JSON değil */
  }
  return { status: res.status, body: body as T }
}

interface RawLoc {
  LocationNo?: string | null
  Description?: string | null
  LocationGroupDescription?: string | null
}

/**
 * Raf bilgisini getirir. Kullanıcı hem LocationNo (40) hem Description (Y1A01)
 * okutabilir: önce LocationNo eq, bulunamazsa Description eq denenir.
 */
export async function getRafBilgisi(kod: string): Promise<DepoRafBilgisi | null> {
  const { contract } = getIfsConfig()
  const q = (field: string) =>
    `InventoryLocationsHandling.svc/WarehouseBayBinSet?$filter=${encodeURIComponent(
      `Contract eq '${esc(contract)}' and ${field} eq '${esc(kod)}'`,
    )}&$top=1`

  for (const field of ['LocationNo', 'Description']) {
    const { status, body } = await mainGet<{ value?: RawLoc[] }>(q(field))
    if (status !== 200) continue
    const row = body?.value?.[0]
    if (row) {
      return {
        locationNo: str(row.LocationNo),
        aciklama: str(row.Description),
        grup: str(row.LocationGroupDescription),
      }
    }
  }
  return null
}

interface RawStock {
  PartNo?: string | null
  LocationNo?: string | null
  LotBatchNo?: string | null
  SerialNo?: string | null
  ConfigurationId?: string | null
  EngChgLevel?: string | null
  WaivDevRejNo?: string | null
  ActivitySeq?: number | null
  HandlingUnitId?: number | null
  AvailableQtyToMove?: number | null
}

/** Belirtilen LocationNo'daki taşınabilir stok kayıtları (10-anahtar kimlikle). */
export async function getRaftakiStok(locationNo: string): Promise<DepoStokKaydi[]> {
  const { contract } = getIfsConfig()
  const filter = `Contract eq '${esc(contract)}' and LocationNo eq '${esc(locationNo)}'`
  const { status, body } = await mainGet<{ value?: RawStock[] }>(
    `MoveInventoryPart.svc/InventoryPartInStockSet?$filter=${encodeURIComponent(filter)}&$top=200`,
  )
  if (status !== 200 || !Array.isArray(body?.value)) return []

  return body.value.map((r): DepoStokKaydi => {
    const lot = str(r.LotBatchNo)
    return {
      stokKodu: str(r.PartNo),
      stokAdi: '', // TODO: PartDescription bu projeksiyonda yok
      lot: lot && lot !== '*' ? lot : undefined,
      miktar: num(r.AvailableQtyToMove),
      birim: 'ad', // TODO: base UoM alanı yok
      kimlik: {
        contract,
        partNo: str(r.PartNo),
        configurationId: str(r.ConfigurationId) || '*',
        locationNo: str(r.LocationNo),
        lotBatchNo: str(r.LotBatchNo) || '*',
        serialNo: str(r.SerialNo) || '*',
        engChgLevel: str(r.EngChgLevel) || '*',
        waivDevRejNo: str(r.WaivDevRejNo) || '*',
        activitySeq: num(r.ActivitySeq),
        handlingUnitId: num(r.HandlingUnitId),
      },
    }
  })
}

/**
 * Stok taşıma — CreateInventoryPartInStockDelivery action'ı.
 *
 * ⚠️ EL-3c: Bu fonksiyon YAZILDI ama bu fazda HİÇBİR YERDEN ÇAĞRILMIYOR. İlk gerçek
 * çağrı, izole/tek-kayıt kontrollü testle yapılacak; özellikle `Destination` alanının
 * hedef LocationNo mu yoksa sabit bir hedef-tipi kodu mu beklediği doğrulanacak.
 */
/** InventoryPartInStock(Delivery) named-key predicate; LocationNo dışında tüm anahtarlar aynı. */
function keyPred(k: StokKimlik, locationNo: string): string {
  return [
    `Contract='${esc(k.contract)}'`,
    `PartNo='${esc(k.partNo)}'`,
    `ConfigurationId='${esc(k.configurationId)}'`,
    `LocationNo='${esc(locationNo)}'`,
    `LotBatchNo='${esc(k.lotBatchNo)}'`,
    `SerialNo='${esc(k.serialNo)}'`,
    `EngChgLevel='${esc(k.engChgLevel)}'`,
    `WaivDevRejNo='${esc(k.waivDevRejNo)}'`,
    `ActivitySeq=${k.activitySeq}`,
    `HandlingUnitId=${k.handlingUnitId}`,
  ].join(',')
}

async function mainPost(pathAndQuery: string, body: unknown): Promise<{ status: number; text: string }> {
  const token = await getIfsAccessToken()
  const res = await fetch(`${mainRoot()}${pathAndQuery}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Prefer: 'wait=99999',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  return { status: res.status, text: await res.text() }
}

/**
 * Stok taşıma. Hedefte AYNI kimlik (LocationNo dışındaki 9 anahtarın tamamı: PartNo,
 * ConfigurationId, SerialNo, EngChgLevel, WaivDevRejNo, LotBatchNo, ActivitySeq,
 * HandlingUnitId) zaten varsa bound Update; yoksa Create. `yol` hangi dalın çalıştığını verir.
 */
export async function moveStok(
  kimlik: StokKimlik,
  hedefLocationNo: string,
  miktar: number,
): Promise<{ ok: boolean; yol: 'CREATE' | 'UPDATE'; error?: string }> {
  // Hedefte tam-anahtar eşleşen satır var mı? (LocationNo=hedef, diğer 9 anahtar = kaynakla aynı)
  const destFilter =
    `Contract eq '${esc(kimlik.contract)}' and LocationNo eq '${esc(hedefLocationNo)}'` +
    ` and PartNo eq '${esc(kimlik.partNo)}' and ConfigurationId eq '${esc(kimlik.configurationId)}'` +
    ` and SerialNo eq '${esc(kimlik.serialNo)}' and LotBatchNo eq '${esc(kimlik.lotBatchNo)}'` +
    ` and EngChgLevel eq '${esc(kimlik.engChgLevel)}' and WaivDevRejNo eq '${esc(kimlik.waivDevRejNo)}'` +
    ` and ActivitySeq eq ${kimlik.activitySeq} and HandlingUnitId eq ${kimlik.handlingUnitId}`

  let yol: 'CREATE' | 'UPDATE' = 'CREATE'
  try {
    const { status, body } = await mainGet<{ value?: unknown[] }>(
      `MoveInventoryPart.svc/InventoryPartInStockSet?$filter=${encodeURIComponent(destFilter)}&$top=1`,
    )
    if (status !== 200) return { ok: false, yol, error: `Hedef sorgu HTTP ${status}` }
    yol = Array.isArray(body?.value) && body.value.length > 0 ? 'UPDATE' : 'CREATE'

    let res: { status: number; text: string }
    if (yol === 'CREATE') {
      // Düz POST — hedefte yeni satır aç.
      res = await mainPost('MoveInventoryPart.svc/CreateInventoryPartInStockDelivery', {
        Contract: kimlik.contract,
        PartNo: kimlik.partNo,
        ConfigurationId: kimlik.configurationId,
        LocationNo: hedefLocationNo, // HEDEF
        LotBatchNo: kimlik.lotBatchNo,
        SerialNo: kimlik.serialNo,
        EngChgLevel: kimlik.engChgLevel,
        WaivDevRejNo: kimlik.waivDevRejNo,
        ActivitySeq: kimlik.activitySeq,
        HandlingUnitId: kimlik.handlingUnitId,
        Destination: 'MoveToInventory',
        QuantityMoved: miktar,
        ParentLocationNo: kimlik.locationNo, // KAYNAK
        ParentContract: kimlik.contract,
        ParentWaivDevRejNo: kimlik.waivDevRejNo,
        ConsumeStock: 'N',
      })
    } else {
      // Bound Update — mevcut hedef satırına navigasyonla ekle.
      const path =
        `MoveInventoryPart.svc/InventoryPartInStockSet(${encodeURI(keyPred(kimlik, kimlik.locationNo))})` +
        `/NewPartLocArray(${encodeURI(keyPred(kimlik, hedefLocationNo))})` +
        `/IfsApp.MoveInventoryPart.InventoryPartInStockDelivery_UpdateInventoryPartInStockDelivery`
      res = await mainPost(path, {
        ParentLocationNo: kimlik.locationNo, // KAYNAK
        ParentContract: kimlik.contract,
        ParentWaivDevRejNo: kimlik.waivDevRejNo,
        Destination: 'MoveToInventory',
        QuantityMoved: miktar,
        ConsumeStock: 'N',
      })
    }

    if (res.status < 200 || res.status >= 300) {
      return { ok: false, yol, error: `IFS taşıma (${yol}) HTTP ${res.status}: ${res.text.slice(0, 300)}` }
    }
    return { ok: true, yol }
  } catch (e) {
    return { ok: false, yol, error: e instanceof Error ? e.message : 'Taşıma hatası' }
  }
}
