import 'server-only'
import { getIfsConfig } from './config'
import { getIfsAccessToken } from './token'
import { getPartAdi, type StokKimlik } from './depo-stok'

/**
 * Malzeme toplama (tüketim) okuma katmanı (EL-6a). SERVER-ONLY.
 *
 * Okuma zinciri: ShopOrds (başlık) → MaterialArray (kalem listesi) →
 * InventoryPartInStock (FIFO kaynak kırılımı, ReceiptDate artan).
 * Auth/token: shop-order-operations.ts / depo-stok.ts ile aynı yapı.
 *
 * SADECE OKUMA — yazma (reserve/issue) EL-6b'de.
 */

export interface IsEmriBaslik {
  orderNo: string
  releaseNo: string
  sequenceNo: string
  urunKodu: string
  urunAdi: string
  miktar: number
  durum: string
}

export interface ToplamaSatiri {
  lineItemNo: number
  partNo: string
  partAdi: string
  gerekli: number
  cikilan: number
  kalan: number
  birim: string
  lotOrigin: boolean
}

export interface FifoKaynak {
  kimlik: StokKimlik
  locationNo: string
  lokasyonAdi: string
  lotBatchNo?: string
  alinacak: number
  mevcutMiktar: number
  receiptDate: string
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

/** Entity'nin güncel ETag'ini GET ile çeker (bound yazma öncesi taze — EL-5e deseni). */
async function etagOf(pathAndQuery: string): Promise<string | null> {
  const token = await getIfsAccessToken()
  const res = await fetch(`${mainRoot()}${pathAndQuery}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  const et = res.headers.get('etag')
  if (et) return et
  const j = await res.json().catch(() => null)
  return (j && (j as Record<string, unknown>)['@odata.etag']) as string | null
}

async function mainPost(
  pathAndQuery: string,
  body: unknown,
  ifMatch?: string,
  contentType = 'application/json',
): Promise<{ status: number; text: string }> {
  const token = await getIfsAccessToken()
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': contentType,
    Accept: contentType,
    Prefer: 'wait=99999',
  }
  if (ifMatch) headers['If-Match'] = ifMatch
  const res = await fetch(`${mainRoot()}${pathAndQuery}`, { method: 'POST', headers, body: JSON.stringify(body), cache: 'no-store' })
  return { status: res.status, text: await res.text() }
}

/**
 * İş emri barkodunu normalize eder. TODO: IFS iş emri barkod formatı netleşince
 * kesinleşecek. Şimdilik: 'M' + uzun sayısal (eski format M002232828) → baştaki
 * harf ve sıfırlar soyulur; düz sayı aynen kalır.
 */
export function normalizeIsEmriNo(ham: string): string {
  const s = (ham ?? '').trim()
  if (/^M\d{6,}$/i.test(s)) {
    const rakam = s.slice(1).replace(/^0+/, '')
    return rakam || s
  }
  return s
}

interface RawShopOrd {
  OrderNo?: string | null
  ReleaseNo?: string | null
  SequenceNo?: string | null
  PartNo?: string | null
  PartDescription?: string | null
  RevisedQtyDue?: number | null
  Objstate?: string | null
}

export async function getIsEmriBaslik(orderNo: string): Promise<IsEmriBaslik | null> {
  const { contract } = getIfsConfig()
  const filter = `Contract eq '${esc(contract)}' and OrderNo eq '${esc(orderNo)}'`
  const { status, body } = await mainGet<{ value?: RawShopOrd[] }>(
    `ShopOrderHandling.svc/ShopOrds?$filter=${encodeURIComponent(filter)}&$select=OrderNo,ReleaseNo,SequenceNo,PartNo,PartDescription,RevisedQtyDue,Objstate&$top=1`,
  )
  if (status !== 200) return null
  const r = body?.value?.[0]
  if (!r) return null

  const urunKodu = str(r.PartNo)
  let urunAdi = str(r.PartDescription)
  if (!urunAdi && urunKodu) urunAdi = (await getPartAdi(urunKodu)) ?? ''

  return {
    orderNo: str(r.OrderNo),
    releaseNo: str(r.ReleaseNo),
    sequenceNo: str(r.SequenceNo),
    urunKodu,
    urunAdi,
    miktar: num(r.RevisedQtyDue),
    durum: str(r.Objstate),
  }
}

interface RawMat {
  LineItemNo?: number | null
  PartNo?: string | null
  PartDescription?: string | null
  QtyRequired?: number | null
  QtyIssued?: number | null
  QtyRemainToIssue?: number | null
  UnitMeas?: string | null
  LotBatchOrigin?: boolean | string | null
}

export async function getToplamaListesi(
  orderNo: string,
  releaseNo: string,
  sequenceNo: string,
): Promise<ToplamaSatiri[]> {
  // ShopOrd anahtarı Contract İÇERMEZ.
  const key = `OrderNo='${esc(orderNo)}',ReleaseNo='${esc(releaseNo)}',SequenceNo='${esc(sequenceNo)}'`
  const { status, body } = await mainGet<{ value?: RawMat[] }>(
    `ShopOrderHandling.svc/ShopOrds(${encodeURI(key)})/MaterialArray?$select=LineItemNo,PartNo,PartDescription,QtyRequired,QtyIssued,QtyRemainToIssue,UnitMeas,LotBatchOrigin&$top=100`,
  )
  if (status !== 200 || !Array.isArray(body?.value)) return []

  const satirlar: ToplamaSatiri[] = body.value.map((r) => ({
    lineItemNo: num(r.LineItemNo),
    partNo: str(r.PartNo),
    partAdi: str(r.PartDescription),
    gerekli: num(r.QtyRequired),
    cikilan: num(r.QtyIssued),
    kalan: num(r.QtyRemainToIssue),
    // TODO: UoM projeksiyonda yoksa 'ad' fallback.
    birim: str(r.UnitMeas) || 'ad',
    lotOrigin: r.LotBatchOrigin === true || String(r.LotBatchOrigin) === 'true',
  }))

  // partAdi boş olanları N+1 yapmadan paralel tamamla (max 10 benzersiz).
  const eksik = [...new Set(satirlar.filter((s) => !s.partAdi && s.partNo).map((s) => s.partNo))].slice(0, 10)
  if (eksik.length) {
    const adlar = await Promise.all(eksik.map(async (pn) => [pn, (await getPartAdi(pn)) ?? ''] as const))
    const map = new Map(adlar)
    satirlar.forEach((s) => { if (!s.partAdi) s.partAdi = map.get(s.partNo) ?? '' })
  }
  return satirlar
}

interface RawStock {
  Contract?: string | null
  PartNo?: string | null
  ConfigurationId?: string | null
  LocationNo?: string | null
  LotBatchNo?: string | null
  SerialNo?: string | null
  EngChgLevel?: string | null
  WaivDevRejNo?: string | null
  ActivitySeq?: number | null
  HandlingUnitId?: number | null
  AvailableQtyToMove?: number | null
  ReceiptDate?: string | null
}

/**
 * Ortak: PartNo için FIFO sıralı (ReceiptDate,LocationNo artan) TÜM taşınabilir stok
 * satırları, lokasyon adları doldurulmuş. Kesme YOK — `alinacak` = tüm mevcut miktar.
 * getFifoKirilim (ihtiyaca kadar keser) ve getStokSatirlari (alternatif liste) bunu paylaşır.
 */
async function fetchStokKaynaklari(partNo: string): Promise<FifoKaynak[]> {
  const { contract } = getIfsConfig()
  const filter = `Contract eq '${esc(contract)}' and PartNo eq '${esc(partNo)}' and AvailableQtyToMove gt 0`
  const { status, body } = await mainGet<{ value?: RawStock[] }>(
    `MoveInventoryPart.svc/InventoryPartInStockSet?$filter=${encodeURIComponent(filter)}` +
      `&$orderby=ReceiptDate,LocationNo&$top=100`,
  )
  if (status !== 200 || !Array.isArray(body?.value)) return []

  const kaynaklar: FifoKaynak[] = []
  for (const r of body.value) {
    const mevcut = num(r.AvailableQtyToMove)
    if (mevcut <= 0) continue
    const lot = str(r.LotBatchNo)
    kaynaklar.push({
      kimlik: {
        contract, partNo: str(r.PartNo), configurationId: str(r.ConfigurationId) || '*',
        locationNo: str(r.LocationNo), lotBatchNo: str(r.LotBatchNo) || '*', serialNo: str(r.SerialNo) || '*',
        engChgLevel: str(r.EngChgLevel) || '*', waivDevRejNo: str(r.WaivDevRejNo) || '*',
        activitySeq: num(r.ActivitySeq), handlingUnitId: num(r.HandlingUnitId),
      },
      locationNo: str(r.LocationNo),
      lokasyonAdi: str(r.LocationNo), // aşağıda WarehouseBayBin ile doldurulur
      lotBatchNo: lot && lot !== '*' ? lot : undefined,
      alinacak: mevcut,
      mevcutMiktar: mevcut,
      receiptDate: r.ReceiptDate ? String(r.ReceiptDate).slice(0, 10) : '',
    })
  }
  if (!kaynaklar.length) return []

  // Benzersiz lokasyon adlarını TEK sorguda çek.
  const uniqLoc = [...new Set(kaynaklar.map((k) => k.locationNo))]
  const locFilter =
    `Contract eq '${esc(contract)}' and (` +
    uniqLoc.map((l) => `LocationNo eq '${esc(l)}'`).join(' or ') +
    `)`
  const loc = await mainGet<{ value?: { LocationNo?: string; Description?: string }[] }>(
    `InventoryLocationsHandling.svc/WarehouseBayBinSet?$filter=${encodeURIComponent(locFilter)}&$select=LocationNo,Description&$top=100`,
  )
  if (loc.status === 200 && Array.isArray(loc.body?.value)) {
    const adMap = new Map(loc.body.value.map((x) => [str(x.LocationNo), str(x.Description)]))
    kaynaklar.forEach((k) => { k.lokasyonAdi = adMap.get(k.locationNo) || k.locationNo })
  }
  return kaynaklar
}

/** FIFO kırılımı — `ihtiyac` miktarını sırayla karşılar (kesilmiş liste, her satırda `alinacak`). */
export async function getFifoKirilim(partNo: string, ihtiyac: number): Promise<FifoKaynak[]> {
  const tumu = await fetchStokKaynaklari(partNo)
  const kaynaklar: FifoKaynak[] = []
  let kalan = ihtiyac
  for (const k of tumu) {
    if (kalan <= 0) break
    const alinacak = Math.min(kalan, k.mevcutMiktar)
    kalan -= alinacak
    kaynaklar.push({ ...k, alinacak })
  }
  return kaynaklar
}

/**
 * PartNo için FIFO sıralı TÜM stok satırları (kesme yok) — sapma yolu alternatif liste.
 * getFifoKirilim'in ihtiyaca-kadar-kesmeyen hali; ilk satır FIFO önerisi.
 */
export async function getStokSatirlari(partNo: string): Promise<FifoKaynak[]> {
  return fetchStokKaynaklari(partNo)
}

// ── Yazma (EL-6b) — reserve → issue. EL-5e'de 147/8001 ile HTTP 204 kanıtlandı.
export interface SatirAnahtar {
  orderNo: string
  releaseNo: string
  sequenceNo: string
  lineItemNo: number
}
export interface RezervKirilim {
  locationNo: string
  lotBatchNo?: string
  qtyAssigned: number
}

function soKeyOf(s: SatirAnahtar): string {
  return `OrderNo='${esc(s.orderNo)}',ReleaseNo='${esc(s.releaseNo)}',SequenceNo='${esc(s.sequenceNo)}'`
}
function allocKeyOf(s: SatirAnahtar): string {
  return `OrderNo='${esc(s.orderNo)}',ReleaseNo='${esc(s.releaseNo)}',SequenceNo='${esc(s.sequenceNo)}',LineItemNo=${s.lineItemNo}`
}
function allocEntityOf(s: SatirAnahtar): string {
  return `ShopOrderHandling.svc/ShopOrds(${encodeURI(soKeyOf(s))})/MaterialArray(${encodeURI(allocKeyOf(s))})`
}

/** Bound ShopMaterialAlloc_Reserve — taze ETag + If-Match zorunlu (EL-5e). */
export async function reserveSatir(s: SatirAnahtar): Promise<{ ok: boolean; error?: string }> {
  const entity = allocEntityOf(s)
  const etag = await etagOf(entity)
  if (!etag) return { ok: false, error: 'Satır ETag alınamadı (satır bulunamadı?)' }
  const res = await mainPost(`${entity}/IfsApp.ShopOrderHandling.ShopMaterialAlloc_Reserve`, {}, etag)
  if (res.status < 200 || res.status >= 300) {
    return { ok: false, error: `Rezervasyon HTTP ${res.status}: ${res.text.slice(0, 300)}` }
  }
  return { ok: true }
}

/** Unbound IssueMaterial — Selection=UPPER_SNAKE keyref, IssueOnlyReserved=1 (If-Match gerekmez). */
export async function issueSatir(s: SatirAnahtar): Promise<{ ok: boolean; error?: string }> {
  const selection = `LINE_ITEM_NO=${s.lineItemNo}^ORDER_NO=${s.orderNo}^RELEASE_NO=${s.releaseNo}^SEQUENCE_NO=${s.sequenceNo}^;`
  const res = await mainPost('ShopOrderHandling.svc/IssueMaterial', { Selection: selection, IssueOnlyReserved: 1 })
  if (res.status < 200 || res.status >= 300) {
    return { ok: false, error: `Çıkış HTTP ${res.status}: ${res.text.slice(0, 300)}` }
  }
  return { ok: true }
}

// ── Manuel/sapma rezervasyon (EL-6c). Aurena deseni EL-6c-test v2'de HTTP 204 kanıtlandı.
const MRS_SVC = 'ManualReservationShopOrderHandling.svc'
const MODIFY_ACTION = 'IfsApp.ManualReservationShopOrderHandling.ShopMaterialAllocSingleUtil_DataRecordExecuteModifySingle'
const IEEE_JSON = 'application/json;IEEE754Compatible=true'

/**
 * ShopMaterialAllocSingleUtilArray içinde verilen stok kimliğine (LocationNo + lot)
 * karşılık gelen üyeyi bulur → { relPath, etag }.
 *
 * PROTOKOL NOTU (EL-6c-test v2): üyenin @odata.id / @odata.etag alanları YALNIZCA
 * `Accept: application/json;odata.metadata=full` ile döner. Varsayılan (minimal)
 * metadata bu alanları vermez → taze ETag alınamaz → bound ModifySingle 428 olur.
 */
async function getSingleUtilUye(
  s: SatirAnahtar,
  k: StokKimlik,
): Promise<{ relPath: string; etag: string } | null> {
  const token = await getIfsAccessToken()
  const url = `${mainRoot()}${MRS_SVC}/ShopMaterialAllocSet(${encodeURI(allocKeyOf(s))})/ShopMaterialAllocSingleUtilArray?$top=100`
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json;odata.metadata=full' },
    cache: 'no-store',
  })
  if (res.status !== 200) return null
  const j = (await res.json().catch(() => null)) as { value?: Record<string, unknown>[] } | null
  const rows = j?.value ?? []
  const lot = k.lotBatchNo || '*'
  const uye =
    rows.find((r) => str(r.LocationNo) === k.locationNo && (str(r.LotBatchNo) || '*') === lot) ??
    rows.find((r) => str(r.LocationNo) === k.locationNo)
  if (!uye) return null
  const id = str(uye['@odata.id'])
  const etag = str(uye['@odata.etag'])
  if (!id || !etag) return null
  return { relPath: id.replace(mainRoot(), ''), etag }
}

/**
 * Manuel/sapma rezervasyonu — belirli stok satırına (kimlik) `qtyReserved` kadar rezerve.
 * Bound ModifySingle action'ı (EL-6c-test v2, HTTP 204 kanıtlı):
 *  1) SingleUtil üyesini full-metadata ile GET → taze ETag (getSingleUtilUye).
 *  2) POST <üye>/…ShopMaterialAllocSingleUtil_DataRecordExecuteModifySingle,
 *     If-Match=ETag, Content-Type=application/json;IEEE754Compatible=true.
 *  3) Gövde: Parent* = iş emri satır ref, QtyReserved=String(qty), Input*=null.
 *
 * `qtyReserved=0` → UNRESERVE (aynı action): hem stok rezervini hem QtyAssigned'ı
 * sıfırlar — telafi/geri-alma bu yolla yapılır (EL-6c-test v2'de doğrulandı).
 */
export async function modifyManuelRezerv(
  s: SatirAnahtar,
  k: StokKimlik,
  qtyReserved: number,
): Promise<{ ok: boolean; error?: string }> {
  const uye = await getSingleUtilUye(s, k)
  if (!uye) {
    return { ok: false, error: `Rezerv üyesi bulunamadı (Loc ${k.locationNo}) veya ETag alınamadı` }
  }
  const body = {
    ParentOrderNo: s.orderNo,
    ParentReleaseNo: s.releaseNo,
    ParentSequenceNo: s.sequenceNo,
    ParentLineItemNo: String(s.lineItemNo),
    QtyReserved: String(qtyReserved),
    InputQty: null,
    InputUnitMeas: null,
    InputConvFactor: null,
    InputVariableValues: null,
    BlockedForPickByChoice: false,
  }
  const res = await mainPost(`${uye.relPath}/${MODIFY_ACTION}`, body, uye.etag, IEEE_JSON)
  if (res.status < 200 || res.status >= 300) {
    // Ham gövde sadeleştirme route'ta (dostaneIfsHata) yapılır → details[0].message
    // kesilmesin diye burada geniş tutuluyor.
    return { ok: false, error: `Manuel rezerv HTTP ${res.status}: ${res.text.slice(0, 1200)}` }
  }
  return { ok: true }
}

/** Satırın PartNo'su (kısmi yolda FIFO ilk kaynağı bulmak için). */
export async function getSatirPartNo(s: SatirAnahtar): Promise<string> {
  const r = await mainGet<{ PartNo?: string }>(`${allocEntityOf(s)}?$select=PartNo`)
  return r.status === 200 ? str(r.body?.PartNo) : ''
}

/**
 * Rezerve sonrası kırılım: PartNo için QtyReserved>0 stok satırları.
 * TODO: kesin iş-emri-bazlı kırılım için ShopMaterialAssign'a girilecek (şimdilik
 * QtyReserved yeterli — tek kullanıcı akışı).
 */
export async function getRezervKirilim(s: SatirAnahtar): Promise<RezervKirilim[]> {
  const { contract } = getIfsConfig()
  // partNo'yu satırdan al (tekil entity → body doğrudan kayıt)
  const line = await mainGet<{ PartNo?: string }>(`${allocEntityOf(s)}?$select=PartNo`)
  const partNo = str(line.body?.PartNo)
  if (line.status !== 200 || !partNo) return []
  const filter = `Contract eq '${esc(contract)}' and PartNo eq '${esc(partNo)}' and QtyReserved gt 0`
  const r = await mainGet<{ value?: { LocationNo?: string; LotBatchNo?: string; QtyReserved?: number }[] }>(
    `InventoryPartInStockHandling.svc/InventoryPartInStockSet?$filter=${encodeURIComponent(filter)}&$select=LocationNo,LotBatchNo,QtyReserved&$top=50`,
  )
  if (r.status !== 200 || !Array.isArray(r.body?.value)) return []
  return r.body.value.map((x) => {
    const lot = str(x.LotBatchNo)
    return { locationNo: str(x.LocationNo), lotBatchNo: lot && lot !== '*' ? lot : undefined, qtyAssigned: num(x.QtyReserved) }
  })
}

/** Satırın taze durumu (çıkış sonrası liste tazeleme için). */
export async function getSatirDurum(s: SatirAnahtar): Promise<{ qtyIssued: number; kalan: number } | null> {
  const r = await mainGet<{ QtyIssued?: number; QtyRemainToIssue?: number }>(
    `${allocEntityOf(s)}?$select=QtyIssued,QtyRemainToIssue`,
  )
  if (r.status !== 200) return null
  return { qtyIssued: num(r.body?.QtyIssued), kalan: num(r.body?.QtyRemainToIssue) }
}
