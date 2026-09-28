import 'server-only'
import { getIfsConfig } from './config'
import { getIfsAccessToken } from './token'
import { cozBarkodId, type BarkodKimlik } from './barkod'
import { parseEtiket, type EtiketKaynak } from '@/lib/depo/etiket-parse'

/**
 * Malzeme Stok Bilgisi (IFS "Inventory Part In Stock" karşılığı). SERVER-ONLY, SADECE OKUMA.
 *
 * Kaynak: /main InventoryPartInStockHandling.svc/InventoryPartInStockSet, Contract = IFS_CONTRACT.
 * Barkod ID bu entity'de YOK → Reference_InventoryPartBarcodeLov ile kimliğe çevrilip
 * PartNo/Lot/Seri/Konfig/Müh.seviye/Aktivite ile süzülür (barkod konum taşımaz → çok lokasyon normal).
 * Kullanılabilir miktar hazır alan (AvailableQty = QtyOnhand − QtyReserved, test ortamında doğrulandı).
 */

export interface StokBilgisiFiltre {
  warehouse?: string
  locationNo?: string
  /** startswith(PartNo) — elle filtre. */
  partNo?: string
  /** PartNo eq — okutma çözümü / barkod. */
  partNoEq?: string
  /** contains(PartNoDesc) */
  partNoDesc?: string
  lotBatchNo?: string
  serialNo?: string
  handlingUnitId?: number
  projectId?: string
  configurationId?: string
  engChgLevel?: string
  activitySeq?: number
}

export interface StokBilgisiSatir {
  partNo: string
  partAdi: string
  eldeki: number
  rezerve: number
  kullanilabilir: number
  birim: string
  ambar: string
  lokasyonNo: string
  lokasyonAdi: string
  lot: string
  seri: string
  tasimaBirimi: number
  konfigurasyon: string
  kosulKodu: string
  muhSeviye: string
  waivDevRejNo: string
  aktiviteSira: number
  kullanilabilirlikKontrolu: string
  proje: string
  barkodVar: boolean
}

export type OkutCozumTip = 'barkod' | 'parca' | 'lokasyon'

export interface StokBilgisiSonuc {
  satirlar: StokBilgisiSatir[]
  toplam: number
  /** Sonuç tek bir parçaya aitse (tüm eşleşen satırlar) toplam kullanılabilir + birim. */
  tekParca?: { partNo: string; kullanilabilir: number; birim: string }
  /** okut verildiyse neye çözüldüğü; hiçbirine çözülemediyse null. */
  cozum?: { tip: OkutCozumTip; deger: string; barkod?: BarkodKimlik } | null
}

export interface DegerListeleri {
  ambarlar: { id: string; ad: string }[]
  projeler: { id: string; ad: string }[]
}

export const STOK_SAYFA = 50
const TEK_PARCA_UST = 1000

function mainRoot(): string {
  const { baseUrl } = getIfsConfig()
  return baseUrl.replace(/[A-Za-z]+\.svc$/, '').replace('/int/', '/main/')
}
const esc = (v: string) => v.replace(/'/g, "''")
const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const str = (v: unknown): string => (v == null ? '' : String(v))
const dolu = (v?: string) => (v ?? '').trim()

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

const SET = 'InventoryPartInStockHandling.svc/InventoryPartInStockSet'
const SELECT = [
  'PartNo', 'PartNoDesc', 'QtyOnhand', 'QtyReserved', 'AvailableQty', 'UoM', 'Warehouse', 'LocationNo',
  'LocationDescription', 'LotBatchNo', 'SerialNo', 'HandlingUnitId', 'ConfigurationId', 'ConditionCode',
  'EngChgLevel', 'WaivDevRejNo', 'ActivitySeq', 'AvailabilityControlId', 'ProjectId', 'InvPartBarcodeExist',
].join(',')

interface RawStok {
  PartNo?: string | null
  PartNoDesc?: string | null
  QtyOnhand?: number | null
  QtyReserved?: number | null
  AvailableQty?: number | null
  UoM?: string | null
  Warehouse?: string | null
  LocationNo?: string | null
  LocationDescription?: string | null
  LotBatchNo?: string | null
  SerialNo?: string | null
  HandlingUnitId?: number | null
  ConfigurationId?: string | null
  ConditionCode?: string | null
  EngChgLevel?: string | null
  WaivDevRejNo?: string | null
  ActivitySeq?: number | null
  AvailabilityControlId?: string | null
  ProjectId?: string | null
  InvPartBarcodeExist?: string | null
}

function filtreMetni(f: StokBilgisiFiltre): string {
  const { contract } = getIfsConfig()
  // IFS çıkarma/taşıma sonrası 0 miktarlı satır bırakır (ör. boşalan palet) → eldeki ve rezerve 0 ise gizle.
  // Filtre sorguda: $count/sayfalama/tek parça toplamı da aynı kümeye göre.
  const p = [`Contract eq '${esc(contract)}'`, '(QtyOnhand gt 0 or QtyReserved gt 0)']
  const eq = (alan: string, v?: string) => { if (dolu(v)) p.push(`${alan} eq '${esc(dolu(v))}'`) }
  eq('Warehouse', f.warehouse)
  eq('LocationNo', f.locationNo)
  eq('PartNo', f.partNoEq)
  if (dolu(f.partNo)) p.push(`startswith(PartNo,'${esc(dolu(f.partNo))}')`)
  if (dolu(f.partNoDesc)) p.push(`contains(PartNoDesc,'${esc(dolu(f.partNoDesc))}')`)
  eq('LotBatchNo', f.lotBatchNo)
  eq('SerialNo', f.serialNo)
  eq('ProjectId', f.projectId)
  eq('ConfigurationId', f.configurationId)
  eq('EngChgLevel', f.engChgLevel)
  // Decimal alanlar → tırnaksız.
  if (f.handlingUnitId != null && Number.isFinite(f.handlingUnitId)) p.push(`HandlingUnitId eq ${Math.trunc(f.handlingUnitId)}`)
  if (f.activitySeq != null && Number.isFinite(f.activitySeq)) p.push(`ActivitySeq eq ${Math.trunc(f.activitySeq)}`)
  return p.join(' and ')
}

function satira(r: RawStok): StokBilgisiSatir {
  return {
    partNo: str(r.PartNo),
    partAdi: str(r.PartNoDesc),
    eldeki: num(r.QtyOnhand),
    rezerve: num(r.QtyReserved),
    kullanilabilir: num(r.AvailableQty),
    birim: str(r.UoM),
    ambar: str(r.Warehouse),
    lokasyonNo: str(r.LocationNo),
    lokasyonAdi: str(r.LocationDescription),
    lot: str(r.LotBatchNo),
    seri: str(r.SerialNo),
    tasimaBirimi: num(r.HandlingUnitId),
    konfigurasyon: str(r.ConfigurationId),
    kosulKodu: str(r.ConditionCode),
    muhSeviye: str(r.EngChgLevel),
    waivDevRejNo: str(r.WaivDevRejNo) || '*',
    aktiviteSira: num(r.ActivitySeq),
    kullanilabilirlikKontrolu: str(r.AvailabilityControlId),
    proje: str(r.ProjectId),
    barkodVar: str(r.InvPartBarcodeExist).toUpperCase() === 'TRUE',
  }
}

/** Filtreye uyan stok satırları — PartNo, LocationNo sıralı, sayfa başına 50, $count. */
export async function getStokBilgisi(filtre: StokBilgisiFiltre, sayfa = 0): Promise<StokBilgisiSonuc> {
  const filter = encodeURIComponent(filtreMetni(filtre))
  const { status, body } = await mainGet<{ value?: RawStok[]; '@odata.count'?: number }>(
    `${SET}?$filter=${filter}&$select=${SELECT}&$orderby=${encodeURIComponent('PartNo,LocationNo')}` +
      `&$count=true&$top=${STOK_SAYFA}&$skip=${Math.max(0, sayfa) * STOK_SAYFA}`,
  )
  if (status !== 200 || !Array.isArray(body?.value)) throw new Error(`IFS stok sorgusu başarısız (HTTP ${status})`)
  const satirlar = body.value.map(satira)
  const toplam = Number(body['@odata.count'] ?? satirlar.length) || 0

  // Tek parça mı? Tüm eşleşen satırlar (sayfa değil) için toplam kullanılabilir — yalnız ilk sayfada.
  let tekParca: StokBilgisiSonuc['tekParca']
  if (sayfa === 0 && toplam > 0 && toplam <= TEK_PARCA_UST) {
    const tumu = toplam <= satirlar.length
      ? satirlar
      : await (async () => {
          const r = await mainGet<{ value?: RawStok[] }>(
            `${SET}?$filter=${filter}&$select=PartNo,AvailableQty,UoM&$top=${TEK_PARCA_UST}`,
          )
          return r.status === 200 && Array.isArray(r.body?.value) ? r.body.value.map(satira) : []
        })()
    const parcalar = new Set(tumu.map((s) => s.partNo))
    if (tumu.length && parcalar.size === 1) {
      tekParca = {
        partNo: tumu[0].partNo,
        kullanilabilir: tumu.reduce((t, s) => t + s.kullanilabilir, 0),
        birim: tumu[0].birim,
      }
    }
  }
  return { satirlar, toplam, tekParca }
}

/**
 * Tek okutma alanı çözümü. Okutucu: barkod (çıplak sayı/B: ve LOV'da varsa) → PartNo (tam) → LocationNo.
 * Elle: barkod DENENMEZ (etiket-parse kuralı); sabit lokasyon yoksa LocationNo → PartNo (tam). Bulunamadı → cozum: null.
 * Ek filtreler (ambar, lot…) her adıma eklenir. İlk sonuç veren adımın sayfası döner.
 */
export async function okutVeGetir(
  ham: string,
  kaynak: EtiketKaynak,
  ekFiltre: StokBilgisiFiltre,
  sayfa = 0,
): Promise<StokBilgisiSonuc> {
  const v = dolu(ham)
  const p = parseEtiket(v, kaynak)

  if (p.tip === 'barkodId' && p.barkodId != null) {
    const k = await cozBarkodId(p.barkodId)
    if (k) {
      const sonuc = await getStokBilgisi({
        ...ekFiltre,
        partNoEq: k.partNo,
        lotBatchNo: k.lotBatchNo,
        serialNo: k.serialNo,
        configurationId: k.configurationId,
        engChgLevel: k.engChgLevel,
        activitySeq: k.activitySeq,
      }, sayfa)
      // Barkod çözüldü ama stok satırı yoksa da barkod sonucu döner (UI "stokta yok" der).
      return { ...sonuc, cozum: { tip: 'barkod', deger: String(k.barcodeId), barkod: k } }
    }
  }

  // Elle giriş ve sabit lokasyon yok: raf (LocationNo) önce, sonra stok kodu — tüm depo ekranlarında ortak kural
  // (elle "64" raf 64'tür; barkod elle girişte zaten denenmez, parseEtiket).
  if (kaynak === 'elle' && v && !dolu(ekFiltre.locationNo)) {
    const lok = await getStokBilgisi({ ...ekFiltre, locationNo: v }, sayfa)
    if (lok.toplam > 0) return { ...lok, cozum: { tip: 'lokasyon', deger: v } }
  }

  // Barkod değil / LOV'da yok → parça no adayı: segmentli etikette P:, aksi halde ham değer.
  const parcaAday = dolu(p.stokKodu) || v
  if (parcaAday) {
    const parca = await getStokBilgisi({ ...ekFiltre, partNoEq: parcaAday }, sayfa)
    if (parca.toplam > 0) return { ...parca, cozum: { tip: 'parca', deger: parcaAday } }
  }
  // Çıplak sayı barkod olarak çözülemediyse lokasyon da olabilir (ör. "76") → ham değerle dene (elle yukarıda denendi).
  if (v && !(kaynak === 'elle' && !dolu(ekFiltre.locationNo))) {
    const lok = await getStokBilgisi({ ...ekFiltre, locationNo: v }, sayfa)
    if (lok.toplam > 0) return { ...lok, cozum: { tip: 'lokasyon', deger: v } }
  }
  return { satirlar: [], toplam: 0, cozum: null }
}

/** Filtre değer listeleri: ambarlar (Contract'a göre) + projeler (yoksa boş dizi). */
export async function getDegerListeleri(): Promise<DegerListeleri> {
  const { contract } = getIfsConfig()
  const [amb, prj] = await Promise.all([
    mainGet<{ value?: { WarehouseId?: string; Description?: string }[] }>(
      `InventoryPartInStockHandling.svc/Reference_Warehouse?$filter=${encodeURIComponent(`Contract eq '${esc(contract)}'`)}` +
        `&$select=WarehouseId,Description&$orderby=WarehouseId&$top=200`,
    ),
    mainGet<{ value?: { ProjectId?: string; Name?: string }[] }>(
      `InventoryPartInStockHandling.svc/Reference_Project?$select=ProjectId,Name&$orderby=ProjectId&$top=500`,
    ),
  ])
  const ambarlar = amb.status === 200 && Array.isArray(amb.body?.value)
    ? amb.body.value.map((r) => ({ id: str(r.WarehouseId), ad: str(r.Description) || str(r.WarehouseId) }))
    : []
  const projeler = prj.status === 200 && Array.isArray(prj.body?.value)
    ? prj.body.value.map((r) => ({ id: str(r.ProjectId), ad: str(r.Name) || str(r.ProjectId) }))
    : []
  return { ambarlar, projeler }
}

// ── Terminal stok seçimi yardımcıları (barkodsuz akış) ──────────────────────

export interface StokYeri {
  lokasyonNo: string
  lokasyonAdi: string
  kullanilabilir: number
  birim: string
}

/** Parçanın kullanılabilir stoğu olan lokasyonlar (ambar verilirse yalnız orada), çoktan aza, en fazla `adet`. */
export async function stokYerleri(partNo: string, warehouse?: string, adet = 3): Promise<StokYeri[]> {
  const r = await getStokBilgisi({ partNoEq: partNo, ...(dolu(warehouse) ? { warehouse: dolu(warehouse) } : {}) })
  const lok = new Map<string, StokYeri>()
  for (const s of r.satirlar) {
    if (!(s.kullanilabilir > 0)) continue
    const y = lok.get(s.lokasyonNo)
    if (y) y.kullanilabilir += s.kullanilabilir
    else lok.set(s.lokasyonNo, { lokasyonNo: s.lokasyonNo, lokasyonAdi: s.lokasyonAdi, kullanilabilir: s.kullanilabilir, birim: s.birim })
  }
  return [...lok.values()].sort((a, b) => b.kullanilabilir - a.kullanilabilir).slice(0, adet)
}
