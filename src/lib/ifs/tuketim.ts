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

export async function getFifoKirilim(partNo: string, ihtiyac: number): Promise<FifoKaynak[]> {
  const { contract } = getIfsConfig()
  const filter = `Contract eq '${esc(contract)}' and PartNo eq '${esc(partNo)}' and AvailableQtyToMove gt 0`
  const { status, body } = await mainGet<{ value?: RawStock[] }>(
    `MoveInventoryPart.svc/InventoryPartInStockSet?$filter=${encodeURIComponent(filter)}` +
      `&$orderby=ReceiptDate,LocationNo&$top=100`,
  )
  if (status !== 200 || !Array.isArray(body?.value)) return []

  // İhtiyacı sırayla (FIFO) karşıla.
  const kaynaklar: FifoKaynak[] = []
  let kalan = ihtiyac
  for (const r of body.value) {
    if (kalan <= 0) break
    const mevcut = num(r.AvailableQtyToMove)
    if (mevcut <= 0) continue
    const alinacak = Math.min(kalan, mevcut)
    kalan -= alinacak
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
      alinacak,
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
