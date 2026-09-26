import 'server-only'
import { getIfsConfig } from './config'
import { getIfsAccessToken } from './token'
import { dostaneIfsHata } from './ifs-hata'

/**
 * Taşıma birimi (IFS Handling Unit — palet/kutu) işlemleri. SERVER-ONLY.
 *
 * IFS test ortamında uçtan uca doğrulanan akışlar (26.09.2026, 10003019 @ 61/64):
 *  - Tür listesi: HandlingUnitsHandling Reference_HandlingUnitType.
 *  - Boş palet: HandlingUnitHandling CreateNewHandlingUnitSet (sanal) → CreateNewHandlingUnit → FirstHandlingUnitId.
 *  - Ekle: InventoryPartInStockHandling AttachPartsToHandlingUnitSet {ObjidListArr, ConnectedSource "INVENT",
 *    CreateOption AddToExisting} → PartsToAddArray.QtyToAttach → ExecuteAttachToHandlingUnit.
 *    ConnectedSource "INVENT" OLMADAN liste boş gelir.
 *  - Çıkar: UnattachPartsFromHandlingUnitSet {ObjListArr, ConnectedSource "INVENT"} → QtyToUnattach → ExecuteUnAttachFromHandlingUnit.
 *  - Taşı: HandlingUnitHandling MoveInventory(HandlingUnitIdList, Contract, LocationNo, "MoveToInventory", yorum).
 *  - Değiştir: HandlingUnitHandling RepackPartInHandlingUnit(Old, New, 10-anahtar stok kimliği, QtyToMove).
 * IFS çıkarma/taşıma sonrası 0 miktarlı stok satırı bırakır → içerikte gizlenir; bu yüzden boş palet silinemez.
 */

const IP = 'InventoryPartInStockHandling.svc/'
const IPN = 'IfsApp.InventoryPartInStockHandling.'
const HU = 'HandlingUnitHandling.svc/'
const HUN = 'IfsApp.HandlingUnitHandling.'

export interface HuStokSatiri {
  partNo: string
  locationNo: string
  lotBatchNo: string
  serialNo: string
  engChgLevel: string
  waivDevRejNo: string
  configurationId: string
  activitySeq: number
  handlingUnitId: number
}

export interface PaletIcerik extends HuStokSatiri {
  partAdi: string
  eldeki: number
  rezerve: number
  kullanilabilir: number
  birim: string
}

export interface Palet {
  id: number
  tur: string
  turAdi: string
  kategori: string
  lokasyonNo: string
  icerik: PaletIcerik[]
}

export interface PaletTuru {
  id: string
  ad: string
  kategori: string
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

type Metod = 'GET' | 'POST' | 'PATCH'

async function istek<T = unknown>(method: Metod, pathAndQuery: string, body?: unknown, ifMatch?: string) {
  const token = await getIfsAccessToken()
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
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

const sanal = (set: string, objkey: string) => `${set}(${encodeURI(`Objkey='${esc(objkey)}'`)})`

/** Tam stok kimliği için $filter parçası (Contract dahil). */
function kimlikFiltre(k: HuStokSatiri): string {
  const { contract } = getIfsConfig()
  return [
    `Contract eq '${esc(contract)}'`,
    `PartNo eq '${esc(k.partNo)}'`,
    `LocationNo eq '${esc(k.locationNo)}'`,
    `LotBatchNo eq '${esc(nz(k.lotBatchNo))}'`,
    `SerialNo eq '${esc(nz(k.serialNo))}'`,
    `EngChgLevel eq '${esc(nz(k.engChgLevel))}'`,
    `WaivDevRejNo eq '${esc(nz(k.waivDevRejNo))}'`,
    `ConfigurationId eq '${esc(nz(k.configurationId))}'`,
    `ActivitySeq eq ${num(k.activitySeq)}`,
    `HandlingUnitId eq ${num(k.handlingUnitId)}`,
  ].join(' and ')
}

interface RawStok {
  ObjId?: string; PartNo?: string; PartNoDesc?: string; LocationNo?: string; LotBatchNo?: string; SerialNo?: string
  EngChgLevel?: string; WaivDevRejNo?: string; ConfigurationId?: string; ActivitySeq?: number; HandlingUnitId?: number
  QtyOnhand?: number; QtyReserved?: number; AvailableQty?: number; UoM?: string
}
const STOK_SELECT = 'ObjId,PartNo,PartNoDesc,LocationNo,LotBatchNo,SerialNo,EngChgLevel,WaivDevRejNo,ConfigurationId,ActivitySeq,HandlingUnitId,QtyOnhand,QtyReserved,AvailableQty,UoM'

const icerikOf = (r: RawStok): PaletIcerik => ({
  partNo: str(r.PartNo),
  partAdi: str(r.PartNoDesc),
  locationNo: str(r.LocationNo),
  lotBatchNo: nz(r.LotBatchNo),
  serialNo: nz(r.SerialNo),
  engChgLevel: nz(r.EngChgLevel),
  waivDevRejNo: nz(r.WaivDevRejNo),
  configurationId: nz(r.ConfigurationId),
  activitySeq: num(r.ActivitySeq),
  handlingUnitId: num(r.HandlingUnitId),
  eldeki: num(r.QtyOnhand),
  rezerve: num(r.QtyReserved),
  kullanilabilir: num(r.AvailableQty),
  birim: str(r.UoM),
})

/** Tek stok satırı (tam kimlikle) — yoksa açık hata. */
async function stokSatiri(k: HuStokSatiri): Promise<RawStok> {
  const d = await zorunlu<{ value?: RawStok[] }>(
    'Stok satırı',
    'GET',
    `${IP}InventoryPartInStockSet?$filter=${encodeURIComponent(kimlikFiltre(k))}&$select=${STOK_SELECT}&$top=2`,
  )
  const v = d.value ?? []
  if (v.length !== 1) throw new Error(`Stok satırı ${v.length === 0 ? 'bulunamadı' : 'tekil değil'}: ${k.partNo} @ ${k.locationNo}`)
  return v[0]
}

// ── Okuma ────────────────────────────────────────────────────────────────────

/** Taşıma birimi türleri — PALLET kategorisi önce. */
export async function paletTurleri(): Promise<PaletTuru[]> {
  const d = await zorunlu<{ value?: { HandlingUnitTypeId?: string; Description?: string; HandlingUnitCategoryId?: string }[] }>(
    'Taşıma birimi türleri',
    'GET',
    `HandlingUnitsHandling.svc/Reference_HandlingUnitType?$select=HandlingUnitTypeId,Description,HandlingUnitCategoryId&$top=200`,
  )
  return (d.value ?? [])
    .map((r) => ({ id: str(r.HandlingUnitTypeId), ad: str(r.Description) || str(r.HandlingUnitTypeId), kategori: str(r.HandlingUnitCategoryId) }))
    .sort((a, b) => Number(b.kategori === 'PALLET') - Number(a.kategori === 'PALLET') || a.id.localeCompare(b.id))
}

/** Palet başlığı + içerik (0 miktarlı satırlar gizli). Yoksa ya da başka sitenin ise null. */
export async function paletGetir(id: number): Promise<Palet | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null
  const h = await istek<{ HandlingUnitId?: number; HandlingUnitTypeId?: string; HandlingUnitTypeDescription?: string; HandlingUnitCategoryId?: string; Contract?: string; LocationNo?: string }>(
    'GET',
    `HandlingUnitsHandling.svc/HandlingUnits(HandlingUnitId=${id})`,
  )
  if (h.status === 404) return null
  if (h.status !== 200 || !h.body?.HandlingUnitId) throw new Error(dostaneIfsHata(`Palet HTTP ${h.status}: ${h.text.slice(0, 600)}`, 'Palet okunamadı'))
  const { contract } = getIfsConfig()
  if (h.body.Contract && h.body.Contract !== contract) return null
  const d = await zorunlu<{ value?: RawStok[] }>(
    'Palet içeriği',
    'GET',
    `${IP}InventoryPartInStockSet?$filter=${encodeURIComponent(`Contract eq '${esc(contract)}' and HandlingUnitId eq ${id} and QtyOnhand gt 0`)}` +
      `&$select=${STOK_SELECT}&$orderby=PartNo&$top=200`,
  )
  const icerik = (d.value ?? []).map(icerikOf)
  const tur = str(h.body.HandlingUnitTypeId)
  // HandlingUnits tür açıklamasını taşımaz → tür listesinden tamamla (hata olursa kodla yetin).
  const turAdi = str(h.body.HandlingUnitTypeDescription) || (await paletTurleri().catch(() => [])).find((t) => t.id === tur)?.ad || ''
  return {
    id,
    tur,
    turAdi,
    kategori: str(h.body.HandlingUnitCategoryId),
    // Boş palette IFS lokasyonu null tutar; içerik varsa satırın lokasyonu esastır.
    lokasyonNo: str(h.body.LocationNo) || icerik[0]?.locationNo || '',
    icerik,
  }
}

/** Lokasyon ILER2'de tanımlı mı (hedef lokasyon doğrulama). */
export async function lokasyonVarMi(locationNo: string): Promise<boolean> {
  const { contract } = getIfsConfig()
  const d = await zorunlu<{ value?: unknown[] }>(
    'Lokasyon',
    'GET',
    `${IP}Reference_InventoryLocation19?$filter=${encodeURIComponent(`Contract eq '${esc(contract)}' and LocationNo eq '${esc(locationNo)}'`)}&$select=LocationNo&$top=1`,
  )
  return (d.value ?? []).length > 0
}

// ── Yazma ────────────────────────────────────────────────────────────────────

/** Boş palet oluştur; IFS'in atadığı ID'yi döndürür. */
export async function paletOlustur(tur: string): Promise<number> {
  const v = await zorunlu<{ Objkey?: string }>('Palet penceresi', 'POST', `${HU}CreateNewHandlingUnitSet`, {
    AddHandlingUnitOption: 'UsingHuType',
    HandlingUnitTypeId: tur,
  })
  const objkey = str(v?.Objkey)
  if (!objkey) throw new Error('Palet penceresi açıldı ama anahtar dönmedi')
  try {
    const r = await zorunlu<{ FirstHandlingUnitId?: number }>('Palet oluşturma', 'POST', `${HU}CreateNewHandlingUnit`, {
      HandlingUnitTypeId: tur,
      AltHandlingUnitLabelId: null,
      Sscc: null,
      AddHandlingUnitOption: 'UsingHuType',
      ParentObjkey: objkey,
    })
    const id = num(r?.FirstHandlingUnitId)
    if (!id) throw new Error('Palet oluştu ama IFS palet numarası dönmedi')
    return id
  } finally {
    await istek('POST', `${HU}${sanal('CreateNewHandlingUnitSet', objkey)}/${HUN}CreateNewHandlingUnitVirtual_CleanupVirtualEntity`, {}).catch(() => undefined)
  }
}

interface RawAday {
  Objkey?: string; '@odata.etag'?: string; LocationNo?: string; HandlingUnitId?: number; LotBatchNo?: string
  SerialNo?: string; EngChgLevel?: string; WaivDevRejNo?: string; ActivitySeq?: number; PartNo?: string; AvailableQty?: number; QtyOnhand?: number
}
const ayni = (k: HuStokSatiri, r: RawAday) =>
  str(r.PartNo) === k.partNo && str(r.LocationNo) === k.locationNo && num(r.HandlingUnitId) === num(k.handlingUnitId) &&
  nz(r.LotBatchNo) === nz(k.lotBatchNo) && nz(r.SerialNo) === nz(k.serialNo) && nz(r.EngChgLevel) === nz(k.engChgLevel) &&
  nz(r.WaivDevRejNo) === nz(k.waivDevRejNo) && num(r.ActivitySeq) === num(k.activitySeq)

/** Stok satırından (genelde birimsiz) mevcut palete ekle. Palet başka lokasyondaysa reddedilir. */
export async function paleteEkle(id: number, stok: HuStokSatiri, miktar: number): Promise<void> {
  if (!(miktar > 0)) throw new Error('Miktar sıfırdan büyük olmalı')
  if (num(stok.handlingUnitId) === id) throw new Error('Malzeme zaten bu palette')
  const palet = await paletGetir(id)
  if (!palet) throw new Error(`Palet bulunamadı: ${id}`)
  if (palet.lokasyonNo && palet.lokasyonNo !== stok.locationNo) {
    throw new Error(`Palet ${id} ${palet.lokasyonNo} lokasyonunda, malzeme ${stok.locationNo} lokasyonunda`)
  }
  const kaynak = await stokSatiri(stok)
  if (num(kaynak.AvailableQty) < miktar) throw new Error(`Kullanılabilir miktar yetersiz: ${num(kaynak.AvailableQty)} < ${miktar}`)
  const v = await zorunlu<{ Objkey?: string }>('Palete ekle penceresi', 'POST', `${IP}AttachPartsToHandlingUnitSet`, {
    ObjidListArr: str(kaynak.ObjId),
    ConnectedSource: 'INVENT',
    CreateOption: 'AddToExisting',
    HandlingUnitId: id,
    PrintLabel: false,
    GenerateSscc: false,
    PrintHUContentLabel: false,
  })
  const objkey = str(v?.Objkey)
  if (!objkey) throw new Error('Palete ekle penceresi açıldı ama anahtar dönmedi')
  const yol = `${IP}${sanal('AttachPartsToHandlingUnitSet', objkey)}`
  try {
    const adaylar = (await zorunlu<{ value?: RawAday[] }>('Eklenecek satırlar', 'GET', `${yol}/PartsToAddArray`)).value ?? []
    const hedef = adaylar.filter((r) => ayni(stok, r))
    if (hedef.length !== 1) throw new Error(`Eklenecek stok satırı ${hedef.length === 0 ? 'bulunamadı' : 'tekil değil'}`)
    await zorunlu('Eklenecek miktar', 'PATCH', `${yol}/PartsToAddArray(${encodeURI(`Objkey='${esc(str(hedef[0].Objkey))}'`)})`, { QtyToAttach: miktar }, hedef[0]['@odata.etag'])
    await zorunlu('Palete ekleme', 'POST', `${IP}ExecuteAttachToHandlingUnit`, { ParentObjkey: objkey })
  } finally {
    await istek('POST', `${yol}/${IPN}AttachPartsToHandlingUnitVirtual_CleanupVirtualEntity`, {}).catch(() => undefined)
  }
}

/** Paletteki bir stok satırından miktar çıkar (malzeme aynı lokasyonda birimsiz kalır). */
export async function palettenCikar(id: number, stok: HuStokSatiri, miktar: number): Promise<void> {
  if (!(miktar > 0)) throw new Error('Miktar sıfırdan büyük olmalı')
  if (num(stok.handlingUnitId) !== id) throw new Error('Satır bu palete ait değil')
  const kaynak = await stokSatiri(stok)
  if (num(kaynak.QtyOnhand) < miktar) throw new Error(`Palette yeterli miktar yok: ${num(kaynak.QtyOnhand)} < ${miktar}`)
  const v = await zorunlu<{ Objkey?: string }>('Paletten çıkar penceresi', 'POST', `${IP}UnattachPartsFromHandlingUnitSet`, {
    ObjListArr: str(kaynak.ObjId),
    ConnectedSource: 'INVENT',
    UnattachAllQtyAsDefault: false,
  })
  const objkey = str(v?.Objkey)
  if (!objkey) throw new Error('Paletten çıkar penceresi açıldı ama anahtar dönmedi')
  const yol = `${IP}${sanal('UnattachPartsFromHandlingUnitSet', objkey)}`
  try {
    const adaylar = (await zorunlu<{ value?: RawAday[] }>('Çıkarılacak satırlar', 'GET', `${yol}/InventoryPartInStockToUnattachArray`)).value ?? []
    const hedef = adaylar.filter((r) => ayni(stok, r))
    if (hedef.length !== 1) throw new Error(`Çıkarılacak stok satırı ${hedef.length === 0 ? 'bulunamadı' : 'tekil değil'}`)
    await zorunlu('Çıkarılacak miktar', 'PATCH', `${yol}/InventoryPartInStockToUnattachArray(${encodeURI(`Objkey='${esc(str(hedef[0].Objkey))}'`)})`, { QtyToUnattach: miktar }, hedef[0]['@odata.etag'])
    await zorunlu('Paletten çıkarma', 'POST', `${IP}ExecuteUnAttachFromHandlingUnit`, { ParentObjkey: objkey })
  } finally {
    await istek('POST', `${yol}/${IPN}UnattachPartsFromHandlingUnitVirtual_CleanupVirtualEntity`, {}).catch(() => undefined)
  }
}

/** Bütün paleti hedef lokasyona taşı. Boş palet taşınamaz. */
export async function paletTasi(id: number, hedefLok: string): Promise<{ kaynakLok: string }> {
  const palet = await paletGetir(id)
  if (!palet) throw new Error(`Palet bulunamadı: ${id}`)
  if (!palet.icerik.length) throw new Error(`Palet ${id} boş — taşınacak stok yok`)
  const hedef = hedefLok.trim()
  if (!hedef) throw new Error('Hedef lokasyon gerekli')
  if (hedef === palet.lokasyonNo) throw new Error(`Palet zaten ${hedef} lokasyonunda`)
  if (!(await lokasyonVarMi(hedef))) throw new Error(`Lokasyon bulunamadı: ${hedef}`)
  const { contract } = getIfsConfig()
  await zorunlu('Palet taşıma', 'POST', `${HU}MoveInventory`, {
    HandlingUnitIdList: String(id),
    Contract: contract,
    LocationNo: hedef,
    Destination: 'MoveToInventory',
    MoveComment: 'ILERIHub el terminali',
  })
  return { kaynakLok: palet.lokasyonNo }
}

/** Kaynak paletteki stok satırından hedef palete aktar (aynı lokasyon). */
export async function paletDegistir(kaynakId: number, hedefId: number, stok: HuStokSatiri, miktar: number): Promise<void> {
  if (!(miktar > 0)) throw new Error('Miktar sıfırdan büyük olmalı')
  if (kaynakId === hedefId) throw new Error('Kaynak ve hedef palet aynı')
  if (num(stok.handlingUnitId) !== kaynakId) throw new Error('Satır kaynak palete ait değil')
  const hedef = await paletGetir(hedefId)
  if (!hedef) throw new Error(`Hedef palet bulunamadı: ${hedefId}`)
  if (hedef.lokasyonNo && hedef.lokasyonNo !== stok.locationNo) {
    throw new Error(`Hedef palet ${hedef.lokasyonNo} lokasyonunda, kaynak ${stok.locationNo} — önce aynı lokasyona taşıyın`)
  }
  const kaynak = await stokSatiri(stok)
  if (num(kaynak.QtyOnhand) < miktar) throw new Error(`Kaynak palette yeterli miktar yok: ${num(kaynak.QtyOnhand)} < ${miktar}`)
  const { contract } = getIfsConfig()
  await zorunlu('Palet aktarma', 'POST', `${HU}RepackPartInHandlingUnit`, {
    OldHandlingUnitId: kaynakId,
    NewHandlingUnitId: hedefId,
    Contract: contract,
    PartNo: stok.partNo,
    ConfigurationId: nz(stok.configurationId),
    LocationNo: stok.locationNo,
    LotBatchNo: nz(stok.lotBatchNo),
    SerialNo: nz(stok.serialNo),
    EngChgLevel: nz(stok.engChgLevel),
    WaivDevRejNo: nz(stok.waivDevRejNo),
    ActivitySeq: num(stok.activitySeq),
    QtyToMove: miktar,
    CatchQtyToMove: null,
  })
}
