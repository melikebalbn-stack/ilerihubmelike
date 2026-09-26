import 'server-only'
import { getIfsConfig } from './config'
import { getIfsAccessToken } from './token'
import { dostaneIfsHata } from './ifs-hata'
import { lokasyonVarMi } from './tasima-birimi'

/**
 * Toplu Taşıma — IFS "Stok Transferi-Toplu" (TR yerelleştirme, TRDST): TrdstLocTransferHeadHandling (/main). SERVER-ONLY.
 *
 * IFS test ortamında doğrulanan akış (26.09.2026, fiş 6/7): başlık POST (_Default'tan TransferId + TransferUser;
 * TransferUser ZORUNLU) → AddLine (stok kimliği + QtyToAdd) → bound TransferEt / IptalEt (If-Match ETag).
 * DİKKAT:
 *  - AddLine stok REZERVE ETMEZ → taslak fiş stoğu kilitlemez; transferEt hemen önce her satırın güncel
 *    AvailableQty'sini kontrol eder, yetersizse IFS'e gitmez.
 *  - IptalEt detay satırını silmez; iptal edilen fişler listede gösterilmez.
 *  - Lokasyon hareketi IFS "Lokasyon Kullanıcı Yetkilendirmesi" (Artı/Eksi) ister → aksi hâlde ILERILOCNOTALLOWED.
 *  - PrintEDelnote / CancelPrintEDelnote (e-irsaliye) bu modülde ASLA çağrılmaz.
 */

const P = 'TrdstLocTransferHeadHandling.svc/'
const NS = 'IfsApp.TrdstLocTransferHeadHandling.'
const DURUM = (d: string) => `${NS}TrdstLocTransferHeadState'${d}'`

export interface TasimaStokSatiri {
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

export interface FisSatir extends TasimaStokSatiri {
  miktar: number
  partAdi: string
  lokasyonAdi: string
}

export interface Fis {
  no: number
  durum: string
  tarih: string
  varisLok: string
  not: string
  kullanici: string
  satirlar: FisSatir[]
}

export interface FisOzet {
  no: number
  durum: string
  tarih: string
  varisLok: string
  not: string
}

export interface TransferSonuc {
  ok: boolean
  durum: string
  /** ok=false ise: güncel kullanılabilir miktarı yetmeyen satırlar (IFS'e gidilmedi). */
  eksikler: { partNo: string; locationNo: string; lotBatchNo: string; gerekli: number; mevcut: number }[]
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

type Metod = 'GET' | 'POST' | 'DELETE'

async function istek<T = unknown>(method: Metod, pathAndQuery: string, body?: unknown, ifMatch?: string) {
  // Güvenlik kilidi: e-irsaliye eylemleri bu modülden hiçbir koşulda çağrılmaz.
  if (/PrintEDelnote/i.test(pathAndQuery)) throw new Error('E-irsaliye eylemi bu modülde yasak')
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

const baslikYolu = (no: number) => {
  const { contract } = getIfsConfig()
  return `TrdstLocTransferHeads(${encodeURI(`Contract='${esc(contract)}',TransferId=${no}`)})`
}

// ── Okuma ────────────────────────────────────────────────────────────────────

interface RawBaslik {
  TransferId?: number; Objstate?: string; TransferDate?: string; ArrivalLoc?: string; NoteText?: string
  TransferUser?: string; Contract?: string; '@odata.etag'?: string
}
interface RawSatir {
  PartNo?: string; LocationNo?: string; LotBatchNo?: string; SerialNo?: string; EngChgLevel?: string; WaivDevRejNo?: string
  ConfigurationId?: string; ActivitySeq?: number; HandlingUnitId?: number; Qty?: number; PartInfo?: string; LocationInfo?: string
  '@odata.etag'?: string
}
const ozetOf = (r: RawBaslik): FisOzet => ({
  no: num(r.TransferId),
  durum: str(r.Objstate),
  tarih: str(r.TransferDate),
  varisLok: str(r.ArrivalLoc),
  not: str(r.NoteText),
})
const satirOf = (r: RawSatir): FisSatir => ({
  partNo: str(r.PartNo),
  locationNo: str(r.LocationNo),
  lotBatchNo: nz(r.LotBatchNo),
  serialNo: nz(r.SerialNo),
  engChgLevel: nz(r.EngChgLevel),
  waivDevRejNo: nz(r.WaivDevRejNo),
  configurationId: nz(r.ConfigurationId),
  activitySeq: num(r.ActivitySeq),
  handlingUnitId: num(r.HandlingUnitId),
  miktar: num(r.Qty),
  partAdi: str(r.PartInfo),
  lokasyonAdi: str(r.LocationInfo),
})

/** Fiş başlığı + satırlar. Yoksa ya da başka sitenin ise null. */
export async function fisGetir(no: number): Promise<Fis | null> {
  if (!Number.isSafeInteger(no) || no <= 0) return null
  const h = await istek<RawBaslik>('GET', `${P}${baslikYolu(no)}?$select=TransferId,Objstate,TransferDate,ArrivalLoc,NoteText,TransferUser`)
  if (h.status === 404) return null
  if (h.status !== 200 || !h.body?.TransferId) throw new Error(dostaneIfsHata(`Fiş HTTP ${h.status}: ${h.text.slice(0, 600)}`, 'Fiş okunamadı'))
  const d = await zorunlu<{ value?: RawSatir[] }>('Fiş satırları', 'GET', `${P}${baslikYolu(no)}/TrdstLocTransferDetailArray?$top=500`)
  return { ...ozetOf(h.body), kullanici: str(h.body.TransferUser), satirlar: (d.value ?? []).map(satirOf) }
}

/** Açık (Yeni) fişler — en yeni önce. İptal/transfer edilmişler listelenmez. */
export async function acikFisler(): Promise<FisOzet[]> {
  const { contract } = getIfsConfig()
  const d = await zorunlu<{ value?: RawBaslik[] }>(
    'Açık fişler',
    'GET',
    `${P}TrdstLocTransferHeads?$filter=${encodeURIComponent(`Contract eq '${esc(contract)}' and Objstate eq ${DURUM('Yeni')}`)}` +
      `&$select=TransferId,Objstate,TransferDate,ArrivalLoc,NoteText&$orderby=TransferId desc&$top=50`,
  )
  return (d.value ?? []).map(ozetOf)
}

// ── Yazma ────────────────────────────────────────────────────────────────────

/** Yeni fiş: aynı site içinde varış lokasyonuna. IFS'in önerdiği TransferId ile. */
export async function fisOlustur(varisLok: string, not?: string): Promise<number> {
  const varis = varisLok.trim()
  if (!varis) throw new Error('Hedef lokasyon gerekli')
  if (!(await lokasyonVarMi(varis))) throw new Error(`Lokasyon bulunamadı: ${varis}`)
  const { contract } = getIfsConfig()
  const dflt = await zorunlu<{ TransferId?: number; TransferDate?: string; TransferUser?: string }>(
    'Fiş varsayılanları',
    'GET',
    `${P}TrdstLocTransferHeads/${NS}TrdstLocTransferHead_Default()`,
  )
  const govde: Record<string, unknown> = {
    Contract: contract,
    TransferId: dflt.TransferId,
    TransferDate: dflt.TransferDate,
    ToContract: contract,
    ArrivalLoc: varis,
    TransType: 'MoveToInventory',
    TransferUser: dflt.TransferUser, // zorunlu (yoksa ORA-20124)
  }
  if (not?.trim()) govde.NoteText = not.trim()
  const h = await zorunlu<RawBaslik>('Fiş oluşturma', 'POST', `${P}TrdstLocTransferHeads`, govde)
  const no = num(h?.TransferId)
  if (!no) throw new Error('Fiş oluştu ama IFS fiş numarası dönmedi')
  return no
}

async function acikFis(no: number): Promise<Fis> {
  const f = await fisGetir(no)
  if (!f) throw new Error(`Fiş bulunamadı: ${no}`)
  if (f.durum !== 'Yeni') throw new Error(`Fiş ${no} ${f.durum} durumunda — değiştirilemez`)
  return f
}

/** Satır ekle (AddLine). Rezerv YAPMAZ; güncel kullanılabilir miktar yine de burada kontrol edilir. */
export async function satirEkle(no: number, stok: TasimaStokSatiri, miktar: number): Promise<void> {
  if (!(miktar > 0)) throw new Error('Miktar sıfırdan büyük olmalı')
  const f = await acikFis(no)
  if (stok.locationNo === f.varisLok) throw new Error(`Kaynak ve hedef lokasyon aynı: ${f.varisLok}`)
  const mevcut = await kullanilabilir(stok)
  const fisteki = f.satirlar.filter((s) => ayniStok(s, stok)).reduce((t, s) => t + s.miktar, 0)
  if (mevcut < fisteki + miktar) throw new Error(`Kullanılabilir miktar yetersiz: ${mevcut} (fişte zaten ${fisteki})`)
  const { contract } = getIfsConfig()
  await zorunlu('Satır ekleme', 'POST', `${P}AddLine`, {
    Contract: contract,
    TransferId: no,
    PartNo: stok.partNo,
    LocationNo: stok.locationNo,
    LotBatchNo: nz(stok.lotBatchNo),
    EngChgLevel: nz(stok.engChgLevel),
    SerialNo: nz(stok.serialNo),
    WaivDevRejNo: nz(stok.waivDevRejNo),
    ConfigurationId: nz(stok.configurationId),
    ActivitySeq: num(stok.activitySeq),
    HandlingUnitId: num(stok.handlingUnitId),
    QtyToAdd: miktar,
  })
}

const ayniStok = (a: TasimaStokSatiri, b: TasimaStokSatiri) =>
  a.partNo === b.partNo && a.locationNo === b.locationNo && nz(a.lotBatchNo) === nz(b.lotBatchNo) &&
  nz(a.serialNo) === nz(b.serialNo) && nz(a.engChgLevel) === nz(b.engChgLevel) && nz(a.waivDevRejNo) === nz(b.waivDevRejNo) &&
  nz(a.configurationId) === nz(b.configurationId) && num(a.activitySeq) === num(b.activitySeq) && num(a.handlingUnitId) === num(b.handlingUnitId)

/** Tam stok kimliğinin güncel kullanılabilir miktarı (satır yoksa 0). */
async function kullanilabilir(k: TasimaStokSatiri): Promise<number> {
  const { contract } = getIfsConfig()
  const filtre = [
    `Contract eq '${esc(contract)}'`, `PartNo eq '${esc(k.partNo)}'`, `LocationNo eq '${esc(k.locationNo)}'`,
    `LotBatchNo eq '${esc(nz(k.lotBatchNo))}'`, `SerialNo eq '${esc(nz(k.serialNo))}'`, `EngChgLevel eq '${esc(nz(k.engChgLevel))}'`,
    `WaivDevRejNo eq '${esc(nz(k.waivDevRejNo))}'`, `ConfigurationId eq '${esc(nz(k.configurationId))}'`,
    `ActivitySeq eq ${num(k.activitySeq)}`, `HandlingUnitId eq ${num(k.handlingUnitId)}`,
  ].join(' and ')
  const d = await zorunlu<{ value?: { AvailableQty?: number }[] }>(
    'Stok',
    'GET',
    `InventoryPartInStockHandling.svc/InventoryPartInStockSet?$filter=${encodeURIComponent(filtre)}&$select=AvailableQty&$top=2`,
  )
  return (d.value ?? []).reduce((t, r) => t + num(r.AvailableQty), 0)
}

/** Fiş satırını sil (detay DELETE). */
export async function satirSil(no: number, satir: TasimaStokSatiri): Promise<FisSatir> {
  const f = await acikFis(no)
  const s = f.satirlar.find((x) => ayniStok(x, satir))
  if (!s) throw new Error('Satır fişte bulunamadı')
  const { contract } = getIfsConfig()
  const anahtar = [
    `Contract='${esc(contract)}'`, `TransferId=${no}`, `PartNo='${esc(s.partNo)}'`, `LocationNo='${esc(s.locationNo)}'`,
    `LotBatchNo='${esc(s.lotBatchNo)}'`, `EngChgLevel='${esc(s.engChgLevel)}'`, `SerialNo='${esc(s.serialNo)}'`,
    `WaivDevRejNo='${esc(s.waivDevRejNo)}'`, `ConfigurationId='${esc(s.configurationId)}'`,
    `ActivitySeq=${s.activitySeq}`, `HandlingUnitId=${s.handlingUnitId}`,
  ].join(',')
  const yol = `${P}${baslikYolu(no)}/TrdstLocTransferDetailArray(${encodeURI(anahtar)})`
  const g = await zorunlu<{ '@odata.etag'?: string }>('Satır', 'GET', yol)
  await zorunlu('Satır silme', 'DELETE', yol, undefined, g['@odata.etag'] ?? '*')
  return s
}

/**
 * Fişi transfer et. Önce her satırın GÜNCEL kullanılabilir miktarı kontrol edilir (AddLine rezerv yapmadığı
 * için arada stok tükenmiş olabilir); yetersiz satır varsa IFS'e gidilmez, eksikler döner.
 */
export async function transferEt(no: number): Promise<TransferSonuc> {
  const f = await acikFis(no)
  if (!f.satirlar.length) throw new Error(`Fiş ${no} boş — transfer edilecek satır yok`)
  const eksikler: TransferSonuc['eksikler'] = []
  // Aynı stok kimliği birden çok satırda olabilir → kimlik başına toplam ihtiyaç.
  const gruplar: { k: FisSatir; gerekli: number }[] = []
  for (const s of f.satirlar) {
    const g = gruplar.find((x) => ayniStok(x.k, s))
    if (g) g.gerekli += s.miktar
    else gruplar.push({ k: s, gerekli: s.miktar })
  }
  for (const g of gruplar) {
    const mevcut = await kullanilabilir(g.k)
    if (mevcut < g.gerekli) {
      eksikler.push({ partNo: g.k.partNo, locationNo: g.k.locationNo, lotBatchNo: g.k.lotBatchNo, gerekli: g.gerekli, mevcut })
    }
  }
  if (eksikler.length) return { ok: false, durum: f.durum, eksikler }
  const h = await zorunlu<{ '@odata.etag'?: string }>('Fiş', 'GET', `${P}${baslikYolu(no)}?$select=Objstate`)
  await zorunlu('Transfer', 'POST', `${P}${baslikYolu(no)}/${NS}TrdstLocTransferHead_TransferEt`, {}, h['@odata.etag'])
  const son = await fisGetir(no)
  return { ok: true, durum: son?.durum ?? '', eksikler: [] }
}

/** Fişi iptal et (yalnız Yeni). Satırlar IFS'te kalır ama fiş listeden düşer. */
export async function iptalEt(no: number): Promise<string> {
  await acikFis(no)
  const h = await zorunlu<{ '@odata.etag'?: string }>('Fiş', 'GET', `${P}${baslikYolu(no)}?$select=Objstate`)
  await zorunlu('İptal', 'POST', `${P}${baslikYolu(no)}/${NS}TrdstLocTransferHead_IptalEt`, {}, h['@odata.etag'])
  return (await fisGetir(no))?.durum ?? ''
}
