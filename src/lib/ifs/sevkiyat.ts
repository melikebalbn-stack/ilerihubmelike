import 'server-only'
import { getIfsConfig } from './config'
import { getIfsAccessToken } from './token'
import { dostaneIfsHata } from './ifs-hata'

/**
 * Sevkiyat toplama — IFS ShipmentHandling / ReportPickingOfPickListLines / ReturnPartsFromShipmentInventory (/main). SERVER-ONLY.
 *
 * IFS test ortamında doğrulanan akış (27.09.2026, sevkiyat 19):
 *  - Rezerv: StartReserveShipment(ShipmentId, null) (senkron). Toplama listesi: StartCreatePickList(ShipmentId, null).
 *    Reference_PickReservation YALNIZ toplama listesine bağlı rezervleri gösterir.
 *  - Toplama raporlama: ReportPickingOfPickListLines FndTempLobs + ClobData (JSON DİZİSİ, application/json) içine
 *    rezerv SATIR anahtarı (PICK_LIST_NO…QTY_TO_PICK) → PickSelected(ShipLocationNo, SelectionTempLobId).
 *    Liste başlığı seçimi verilirse ORA-20124 ORDER_NO hatası; düz metin ClobData → ORA-40441.
 *    Toplanan stok sevk lokasyonuna (ILER2: 44) taşınır. Kısmi toplamada (CLOSE=false) KALAN REZERV IFS'te düşer.
 *  - Geri alma: CancelPickReporting ILERI'de kapalı → ReturnPartsFromShipmentInventory bound
 *    InventoryPartInStock_ReturnFromShipInv (bağlı kayıt = DÖNÜŞ HEDEFİ stok satırı); o satırın rezervini de bırakır.
 *  - Complete / Deliver / Close / e-irsaliye bu modülde ASLA çağrılmaz (istek katmanında engelli).
 */

const H = 'ShipmentHandling.svc/'
const HN = 'IfsApp.ShipmentHandling.'
const RPPL = 'ReportPickingOfPickListLines.svc/'
const RP = 'ReturnPartsFromShipmentInventory.svc/'
const RPN = 'IfsApp.ReturnPartsFromShipmentInventory.'

export interface RezervSatiri {
  keyref: string
  pickListNo: string
  sourceRef1: string
  sourceRef2: string
  sourceRef3: string
  sourceRef4: string
  partNo: string
  configurationId: string
  locationNo: string
  lotBatchNo: string
  serialNo: string
  engChgLevel: string
  waivDevRejNo: string
  activitySeq: number
  handlingUnitId: number
  rezerve: number
  toplanan: number
}

export interface SevkiyatSatiri {
  lineNo: number
  partNo: string
  partAdi: string
  istenen: number
  rezerve: number
  toplanan: number
  rezerveEdilecek: number
  birim: string
  sourceRef1: string
  sourceRef2: string
  sourceRef3: string
  sourceRef4: string
}

export interface SevkiyatOzet {
  id: number
  aliciNo: string
  aliciAdi: string
  planlananTarih: string
  satirSayisi: number
  istenenToplam: number
  toplananToplam: number
}

export interface Sevkiyat extends SevkiyatOzet {
  durum: string
  sevkLok: string
  satirlar: SevkiyatSatiri[]
  rezervler: RezervSatiri[]
}

// ── HTTP ─────────────────────────────────────────────────────────────────────

function mainRoot(): string {
  const { baseUrl } = getIfsConfig()
  return baseUrl.replace(/[A-Za-z]+\.svc$/, '').replace('/int/', '/main/')
}
const esc = (v: string) => v.replace(/'/g, "''")
const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const str = (v: unknown): string => (v == null ? '' : String(v))
const nz = (v: unknown) => { const s = str(v).trim(); return s ? s : '*' }

// Güvenlik kilidi: stok çıkışı/kapanış/e-irsaliye doğuran eylemler bu modülden hiçbir koşulda çağrılmaz.
const YASAK = /Complete|Deliver|Shipment_Close|CloseShipments|StartCloseShipment|PrintEDelnote|SendOrder|Invoice|Approve/i

type Metod = 'GET' | 'POST' | 'PUT'

async function istek<T = unknown>(method: Metod, pathAndQuery: string, body?: unknown, ifMatch?: string, contentType = 'application/json') {
  if (YASAK.test(pathAndQuery)) throw new Error('Bu IFS eylemi sevkiyat terminalinde yasak')
  const token = await getIfsAccessToken()
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = contentType
  if (method === 'POST') headers.Prefer = 'return=representation'
  if (ifMatch) headers['If-Match'] = ifMatch
  const res = await fetch(`${mainRoot()}${pathAndQuery}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  })
  const text = await res.text()
  let parsed: unknown = text
  try { parsed = text ? JSON.parse(text) : null } catch { /* JSON değil */ }
  return { status: res.status, body: parsed as T, text }
}

async function zorunlu<T = unknown>(ad: string, method: Metod, pathAndQuery: string, body?: unknown, ifMatch?: string): Promise<T> {
  const r = await istek<T>(method, pathAndQuery, body, ifMatch)
  if (r.status < 200 || r.status >= 300) {
    throw new Error(dostaneIfsHata(`${ad} HTTP ${r.status}: ${r.text.slice(0, 1200)}`, `${ad} başarısız`))
  }
  return r.body
}

/** FndTempLobs kaydı + ClobData = JSON dizisi (application/json). LobId döner. */
async function tempLob(proj: string, modul: string, secimler: string[]): Promise<string> {
  const v = await zorunlu<{ LobId?: string }>('Geçici seçim kaydı', 'POST', `${proj}FndTempLobs`, { CreatedByModule: modul })
  const lob = str(v?.LobId)
  if (!lob) throw new Error('Geçici seçim kaydı anahtarı dönmedi')
  const yol = `${proj}FndTempLobs(${encodeURI(`LobId='${esc(lob)}'`)})`
  const g = await zorunlu<{ '@odata.etag'?: string }>('Geçici seçim kaydı', 'GET', yol)
  await zorunlu('Seçim verisi', 'PUT', `${yol}/ClobData`, secimler, g['@odata.etag'])
  return lob
}

// ── Okuma ────────────────────────────────────────────────────────────────────

interface RawBaslik { ShipmentId?: number; Objstate?: string; ReceiverId?: string; ReceiverAddressName?: string; PlannedShipDate?: string; ShipInventoryLocationNo?: string; Contract?: string }
interface RawSatir {
  ShipmentLineNo?: number; InventoryPartNo?: string; SourcePartNo?: string; SourcePartDescription?: string; InventoryQty?: number
  QtyAssigned?: number; QtyPicked?: number; QtyToReserve?: number; SourceUnitMeas?: string; SourceRefType?: string
  SourceRef1?: string; SourceRef2?: string; SourceRef3?: string; SourceRef4?: string
}
interface RawRezerv {
  keyref?: string; PickListNo?: string; SourceRef1?: string; SourceRef2?: string; SourceRef3?: string; SourceRef4?: string; PartNo?: string
  ConfigurationId?: string; LocationNo?: string; LotBatchNo?: string; SerialNo?: string; EngChgLevel?: string; WaivDevRejNo?: string
  ActivitySeq?: number; HandlingUnitId?: number; QtyReserved?: number; QtyPicked?: number
}
const SATIR_SELECT = 'ShipmentLineNo,InventoryPartNo,SourcePartNo,SourcePartDescription,InventoryQty,QtyAssigned,QtyPicked,QtyToReserve,SourceUnitMeas,SourceRefType,SourceRef1,SourceRef2,SourceRef3,SourceRef4'

async function satirlar(id: number): Promise<RawSatir[]> {
  const d = await zorunlu<{ value?: RawSatir[] }>('Sevkiyat satırları', 'GET', `${H}ShipmentLineSet?$filter=${encodeURIComponent(`ShipmentId eq ${id}`)}&$select=${SATIR_SELECT}&$top=500`)
  return d.value ?? []
}
const satirOf = (r: RawSatir): SevkiyatSatiri => ({
  lineNo: num(r.ShipmentLineNo),
  partNo: str(r.InventoryPartNo) || str(r.SourcePartNo),
  partAdi: str(r.SourcePartDescription),
  istenen: num(r.InventoryQty),
  rezerve: num(r.QtyAssigned),
  toplanan: num(r.QtyPicked),
  rezerveEdilecek: num(r.QtyToReserve),
  birim: str(r.SourceUnitMeas),
  sourceRef1: str(r.SourceRef1),
  sourceRef2: str(r.SourceRef2),
  sourceRef3: str(r.SourceRef3),
  sourceRef4: str(r.SourceRef4),
})
const rezervOf = (r: RawRezerv): RezervSatiri => ({
  keyref: str(r.keyref),
  pickListNo: str(r.PickListNo),
  sourceRef1: str(r.SourceRef1),
  sourceRef2: str(r.SourceRef2),
  sourceRef3: str(r.SourceRef3),
  sourceRef4: str(r.SourceRef4),
  partNo: str(r.PartNo),
  configurationId: nz(r.ConfigurationId),
  locationNo: str(r.LocationNo),
  lotBatchNo: nz(r.LotBatchNo),
  serialNo: nz(r.SerialNo),
  engChgLevel: nz(r.EngChgLevel),
  waivDevRejNo: nz(r.WaivDevRejNo),
  activitySeq: num(r.ActivitySeq),
  handlingUnitId: num(r.HandlingUnitId),
  rezerve: num(r.QtyReserved),
  toplanan: num(r.QtyPicked),
})

/** Bekleyen sevkiyatlar: Contract, Preliminary, tüm satırları müşteri siparişi kaynaklı. */
export async function sevkiyatlar(): Promise<SevkiyatOzet[]> {
  const { contract } = getIfsConfig()
  const d = await zorunlu<{ value?: RawBaslik[] }>(
    'Sevkiyatlar',
    'GET',
    `${H}ShipmentSet?$filter=${encodeURIComponent(`Contract eq '${esc(contract)}' and Objstate eq ${HN}ShipmentState'Preliminary'`)}` +
      `&$select=ShipmentId,ReceiverId,ReceiverAddressName,PlannedShipDate&$orderby=ShipmentId desc&$top=50`,
  )
  const basliklar = d.value ?? []
  const tum = await Promise.all(basliklar.map((b) => satirlar(num(b.ShipmentId)).catch(() => [] as RawSatir[])))
  const sonuc: SevkiyatOzet[] = []
  basliklar.forEach((b, i) => {
    const s = tum[i]
    if (!s.length || s.some((x) => x.SourceRefType !== 'CustomerOrder')) return
    sonuc.push({
      id: num(b.ShipmentId),
      aliciNo: str(b.ReceiverId),
      aliciAdi: str(b.ReceiverAddressName),
      planlananTarih: str(b.PlannedShipDate),
      satirSayisi: s.length,
      istenenToplam: s.reduce((t, x) => t + num(x.InventoryQty), 0),
      toplananToplam: s.reduce((t, x) => t + num(x.QtyPicked), 0),
    })
  })
  return sonuc
}

/** Sevkiyat başlığı + satırlar + toplama listesine bağlı rezerv satırları. Yoksa null. */
export async function sevkiyatGetir(id: number): Promise<Sevkiyat | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null
  const h = await istek<RawBaslik>('GET', `${H}ShipmentSet(ShipmentId=${id})?$select=ShipmentId,Objstate,ReceiverId,ReceiverAddressName,PlannedShipDate,ShipInventoryLocationNo,Contract`)
  if (h.status === 404) return null
  if (h.status !== 200 || !h.body?.ShipmentId) throw new Error(dostaneIfsHata(`Sevkiyat HTTP ${h.status}: ${h.text.slice(0, 600)}`, 'Sevkiyat okunamadı'))
  const { contract } = getIfsConfig()
  if (str(h.body.Contract) !== contract) return null
  const [s, r] = await Promise.all([
    satirlar(id),
    zorunlu<{ value?: RawRezerv[] }>('Rezerv satırları', 'GET', `${H}Reference_PickReservation?$filter=${encodeURIComponent(`ShipmentId eq ${id}`)}&$top=500`),
  ])
  return {
    id,
    durum: str(h.body.Objstate),
    aliciNo: str(h.body.ReceiverId),
    aliciAdi: str(h.body.ReceiverAddressName),
    planlananTarih: str(h.body.PlannedShipDate),
    sevkLok: str(h.body.ShipInventoryLocationNo),
    satirSayisi: s.length,
    istenenToplam: s.reduce((t, x) => t + num(x.InventoryQty), 0),
    toplananToplam: s.reduce((t, x) => t + num(x.QtyPicked), 0),
    satirlar: s.map(satirOf),
    rezervler: (r.value ?? []).map(rezervOf),
  }
}

/** Sevk (sevkiyat ambarı) lokasyonları — ILER2'de tek: 44. */
export async function sevkLokasyonlari(): Promise<string[]> {
  const { contract } = getIfsConfig()
  const d = await zorunlu<{ value?: { LocationNo?: string }[] }>(
    'Sevk lokasyonları',
    'GET',
    `${RPPL}Reference_ShipmentInventoryLocation?$filter=${encodeURIComponent(`Contract eq '${esc(contract)}'`)}&$select=LocationNo&$top=50`,
  )
  return (d.value ?? []).map((r) => str(r.LocationNo)).filter(Boolean)
}

// ── Yazma ────────────────────────────────────────────────────────────────────

const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Toplamaya hazırla: rezervi eksik satır varsa StartReserveShipment; rezerve olup toplama listesine
 * bağlanmamış miktar varsa StartCreatePickList. Rezerv yetersizse (kısmi) eksikleri açıkça döner.
 */
export async function hazirla(id: number): Promise<{ rezervYapildi: boolean; listeYapildi: boolean; eksikRezerv: { partNo: string; eksik: number }[] }> {
  let s = await sevkiyatGetir(id)
  if (!s) throw new Error(`Sevkiyat bulunamadı: ${id}`)
  if (s.durum !== 'Preliminary') throw new Error(`Sevkiyat ${id} ${s.durum} durumunda`)
  let rezervYapildi = false
  let listeYapildi = false
  if (s.satirlar.some((x) => x.rezerveEdilecek > 0)) {
    await zorunlu('Rezerv', 'POST', `${H}StartReserveShipment`, { ShipmentId: id, LocationNo: null })
    rezervYapildi = true
    s = (await sevkiyatGetir(id))!
  }
  const rezerveToplam = s.satirlar.reduce((t, x) => t + x.rezerve, 0)
  const listelenen = s.rezervler.reduce((t, x) => t + x.rezerve, 0)
  if (rezerveToplam > listelenen) {
    await zorunlu('Toplama listesi', 'POST', `${H}StartCreatePickList`, { ShipmentId: id, LocationNo: null })
    listeYapildi = true
    for (let i = 0; i < 10; i++) {
      s = (await sevkiyatGetir(id))!
      if (s.rezervler.reduce((t, x) => t + x.rezerve, 0) >= rezerveToplam) break
      await bekle(1500)
    }
  }
  const eksikRezerv = s.satirlar.filter((x) => x.rezerveEdilecek > 0).map((x) => ({ partNo: x.partNo, eksik: x.rezerveEdilecek }))
  return { rezervYapildi, listeYapildi, eksikRezerv }
}

/** Rezerv satırı için PickSelected satır anahtarı (Aurena ağ kaydıyla birebir biçim). */
function satirAnahtari(r: RezervSatiri, miktar: number): string {
  return (
    `PICK_LIST_NO=${r.pickListNo}^SOURCE_REF1=${r.sourceRef1}^SOURCE_REF2=${r.sourceRef2}^SOURCE_REF3=${r.sourceRef3}^SOURCE_REF4=${r.sourceRef4}^` +
    `SOURCE_REF_TYPE_DB=CUSTOMER_ORDER^SHIPMENT_ID=__SID__^CONTRACT=__C__^PART_NO=${r.partNo}^CONFIGURATION_ID=${r.configurationId}^LOCATION_NO=${r.locationNo}^` +
    `LOT_BATCH_NO=${r.lotBatchNo}^SERIAL_NO=${r.serialNo}^ENG_CHG_LEVEL=${r.engChgLevel}^WAIV_DEV_REJ_NO=${r.waivDevRejNo}^CLOSE=false^` +
    `ACTIVITY_SEQ=${r.activitySeq}^HANDLING_UNIT_ID=${r.handlingUnitId}^CATCH_QTY_TO_PICK=^QTY_PICKED=${r.toplanan}^QTY_TO_PICK=${miktar}^`
  )
}

async function pickSelected(anahtarlar: string[], sevkLok: string): Promise<void> {
  const lob = await tempLob(RPPL, 'ReportPickingOfPickListLines', anahtarlar)
  await zorunlu('Toplama raporlama', 'POST', `${RPPL}PickSelected`, { ShipLocationNo: sevkLok, SelectionTempLobId: lob })
}

/**
 * Toplamayı IFS'e raporla. Önce tüm satırlar TEK PickSelected'a çok elemanlı diziyle; hata alırsa
 * satır satır çağırır. Hangi yolun işlediği ve satır bazında sonuç döner.
 */
export async function toplamaRaporla(
  id: number,
  kalemler: { rezerv: RezervSatiri; miktar: number }[],
  sevkLok: string,
): Promise<{ yontem: 'toplu' | 'tekil'; sonuclar: { keyref: string; ok: boolean; hata?: string }[]; topluHata?: string }> {
  if (!kalemler.length) throw new Error('Raporlanacak okutma yok')
  if (!sevkLok) throw new Error('Sevk lokasyonu gerekli')
  const s = await sevkiyatGetir(id)
  if (!s) throw new Error(`Sevkiyat bulunamadı: ${id}`)
  const { contract } = getIfsConfig()
  const anahtar = (k: { rezerv: RezervSatiri; miktar: number }) => {
    const guncel = s.rezervler.find((r) => r.keyref === k.rezerv.keyref)
    if (!guncel) throw new Error(`Rezerv satırı artık yok: ${k.rezerv.partNo} @ ${k.rezerv.locationNo}`)
    if (k.miktar > guncel.rezerve - guncel.toplanan) throw new Error(`Rezervi aşıyor: ${k.rezerv.partNo} @ ${guncel.locationNo}`)
    return satirAnahtari(guncel, k.miktar).replace('__SID__', String(id)).replace('__C__', contract)
  }
  const anahtarlar = kalemler.map(anahtar)
  try {
    await pickSelected(anahtarlar, sevkLok)
    return { yontem: 'toplu', sonuclar: kalemler.map((k) => ({ keyref: k.rezerv.keyref, ok: true })) }
  } catch (e) {
    if (kalemler.length === 1) throw e
    const topluHata = e instanceof Error ? e.message : String(e)
    const sonuclar: { keyref: string; ok: boolean; hata?: string }[] = []
    for (let i = 0; i < kalemler.length; i++) {
      try {
        await pickSelected([anahtarlar[i]], sevkLok)
        sonuclar.push({ keyref: kalemler[i].rezerv.keyref, ok: true })
      } catch (e2) {
        sonuclar.push({ keyref: kalemler[i].rezerv.keyref, ok: false, hata: e2 instanceof Error ? e2.message : String(e2) })
      }
    }
    return { yontem: 'tekil', sonuclar, topluHata }
  }
}

/**
 * Toplamayı geri al: sevk lokasyonundaki toplanmış rezerv satırından `miktar`ı hedef lokasyona (okutmadaki
 * rezerv lokasyonu) geri koyar. IFS o satırın rezervini de bırakır.
 */
export async function toplamaGeriAl(id: number, rezerv: RezervSatiri, miktar: number, hedefLok: string): Promise<void> {
  if (!(miktar > 0)) throw new Error('Miktar sıfırdan büyük olmalı')
  const s = await sevkiyatGetir(id)
  if (!s) throw new Error(`Sevkiyat bulunamadı: ${id}`)
  const r = s.rezervler.find((x) => x.keyref === rezerv.keyref)
  if (!r || !(r.toplanan > 0)) throw new Error('Geri alınacak toplanmış satır bulunamadı')
  if (miktar > r.toplanan) throw new Error(`Toplanandan fazla: ${r.toplanan}`)
  const { contract } = getIfsConfig()
  const hedef = [
    `PartNo='${esc(r.partNo)}'`, `Contract='${esc(contract)}'`, `LocationNo='${esc(hedefLok)}'`, `ConfigurationId='${esc(r.configurationId)}'`,
    `LotBatchNo='${esc(r.lotBatchNo)}'`, `SerialNo='${esc(r.serialNo)}'`, `EngChgLevel='${esc(r.engChgLevel)}'`,
    `WaivDevRejNo='${esc(r.waivDevRejNo)}'`, `ActivitySeq=${r.activitySeq}`, `HandlingUnitId=0`,
  ].join(',')
  const yol = `${RP}Reference_InventoryPartInStock(${encodeURI(hedef)})`
  const g = await zorunlu<{ '@odata.etag'?: string }>('Dönüş stok satırı', 'GET', yol)
  await zorunlu('Sevkiyat ambarından geri alma', 'POST', `${yol}/${RPN}InventoryPartInStock_ReturnFromShipInv`, {
    SourceRef1: r.sourceRef1,
    SourceRef2: r.sourceRef2,
    SourceRef3: r.sourceRef3,
    SourceRef4: r.sourceRef4,
    SourceRefType: 'CustomerOrder',
    FromContract: contract,
    FromLocationNo: r.locationNo,
    FromHandlingUnitId: r.handlingUnitId,
    QtyToReturn: miktar,
    CatchQtyToReturn: null,
    PickListNo: r.pickListNo,
    ShipmentId: id,
    Note: 'ILERIHub el terminali',
  }, g['@odata.etag'])
}
