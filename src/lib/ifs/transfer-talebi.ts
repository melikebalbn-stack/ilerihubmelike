import 'server-only'
import { getIfsConfig } from './config'
import { getIfsAccessToken } from './token'
import { dostaneIfsHata } from './ifs-hata'

/**
 * Transfer Talebi — IFS TRDST taşıma talebi: TrdstTransportHeadHandling (/main). SERVER-ONLY.
 * Terminal talep AÇMAZ; IFS'te açılmış ve onaylanmış (Approved/Prepared) talepleri işler.
 *
 * IFS test ortamında doğrulanan akış (26.09.2026, talep 7):
 *  - Stok bağlama yalnız Prepared'da → talep Approved ise önce bound PrepareDelivery.
 *  - "Stoktan Seç": SelectStockItemsHeadVirtuals (sanal) → TrdstTransportPartVirtualArray satırında
 *    Selected + QtyToAdd → AssignSelected(Contract, HeaderNo, Objkey) → Cleanup. Bağlama stoğu REZERVE EDER
 *    ve standart IFS taşıma görevi satırı oluşturur (TrdstSelectedStockArray: TransportTaskId + LineNo).
 *  - Kaldırma: RemoveTask(TransportTaskId, LineNo) → rezerv düşer.
 *  - Transfer: bound TrdstTransportHead_Transfer (TransportTaskRep rapor yetkisi + lokasyon Artı/Eksi yetkisi şart).
 *  - İptal yalnız Planned'da mümkün (terminal iptal etmez).
 *  - PrintEDelnote / CancelPrintEDelnote (e-irsaliye) bu modülde ASLA çağrılmaz.
 */

const P = 'TrdstTransportHeadHandling.svc/'
const NS = 'IfsApp.TrdstTransportHeadHandling.'
const DURUM = (d: string) => `${NS}TrdstTransportHeadState'${d}'`

export interface TalepStokSatiri {
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

export interface TalepSatirAnahtar {
  partNo: string
  configurationId: string
  activitySeq: number
}

export interface TalepMalzeme extends TalepSatirAnahtar {
  partAdi: string
  istenen: number
  baglanan: number
  kalan: number
  birim: string
  mevcut: number
}

export interface SeciliStok {
  taskId: number
  lineNo: number
  partNo: string
  partAdi: string
  locationNo: string
  lotBatchNo: string
  serialNo: string
  handlingUnitId: number
  miktar: number
}

export interface TalepOzet {
  no: number
  durum: string
  hedefLok: string
  kaynakAmbar: string
  isEmriNo: string
  urunAdi: string
  tarih: string
  not: string
  kalemSayisi: number
  kalanToplam: number
}

export interface Talep extends TalepOzet {
  malzemeler: TalepMalzeme[]
  seciliStoklar: SeciliStok[]
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
  return `TrdstTransportHeads(${encodeURI(`Contract='${esc(contract)}',HeaderNo=${no}`)})`
}

// ── Okuma ────────────────────────────────────────────────────────────────────

interface RawBaslik {
  HeaderNo?: number; Objstate?: string; ToLocationNo?: string; FromWarehouse?: string; Cf_So_Order_No?: string
  Cf_Part_Desc?: string; RequestedDate?: string; NoteText?: string; '@odata.etag'?: string
}
interface RawParca {
  PartNo?: string; ConfigurationId?: string; ActivitySeq?: number; Quantity?: number; UnitMeas?: string
  CurrentQtyAvail?: number; TotalMatched?: number
}
interface RawSecili {
  TransportTaskId?: number; LineNo?: number; PartNo?: string; Description?: string; LocationNo?: string
  LotBatchNo?: string; SerialNo?: string; HandlingUnitId?: number; Quantity?: number
}
const BASLIK_SELECT = 'HeaderNo,Objstate,ToLocationNo,FromWarehouse,Cf_So_Order_No,Cf_Part_Desc,RequestedDate,NoteText'

const malzemeOf = (r: RawParca): TalepMalzeme => {
  const istenen = num(r.Quantity)
  const baglanan = num(r.TotalMatched)
  return {
    partNo: str(r.PartNo),
    configurationId: nz(r.ConfigurationId),
    activitySeq: num(r.ActivitySeq),
    partAdi: '',
    istenen,
    baglanan,
    // IFS GetRemainQty(Quantity, SelectedQty) ile aynı: istenen − bağlanan (negatif olamaz).
    kalan: Math.max(0, istenen - baglanan),
    birim: str(r.UnitMeas),
    mevcut: num(r.CurrentQtyAvail),
  }
}
const ozetOf = (h: RawBaslik, m: TalepMalzeme[]): TalepOzet => ({
  no: num(h.HeaderNo),
  durum: str(h.Objstate),
  hedefLok: str(h.ToLocationNo),
  kaynakAmbar: str(h.FromWarehouse),
  isEmriNo: str(h.Cf_So_Order_No),
  urunAdi: str(h.Cf_Part_Desc),
  tarih: str(h.RequestedDate),
  not: str(h.NoteText),
  kalemSayisi: m.length,
  kalanToplam: m.reduce((t, x) => t + x.kalan, 0),
})

async function malzemeler(no: number): Promise<TalepMalzeme[]> {
  const d = await zorunlu<{ value?: RawParca[] }>(
    'Talep satırları',
    'GET',
    `${P}${baslikYolu(no)}/TrdstTransportPartArray?$select=PartNo,ConfigurationId,ActivitySeq,Quantity,UnitMeas,CurrentQtyAvail,TotalMatched&$top=200`,
  )
  return (d.value ?? []).map(malzemeOf)
}

/** İşlenecek talepler: Contract, durum Approved veya Prepared — en yeni önce. */
export async function talepler(): Promise<TalepOzet[]> {
  const { contract } = getIfsConfig()
  const d = await zorunlu<{ value?: RawBaslik[] }>(
    'Talepler',
    'GET',
    `${P}TrdstTransportHeads?$filter=${encodeURIComponent(`Contract eq '${esc(contract)}' and (Objstate eq ${DURUM('Approved')} or Objstate eq ${DURUM('Prepared')})`)}` +
      `&$select=${BASLIK_SELECT}&$orderby=HeaderNo desc&$top=50`,
  )
  const basliklar = d.value ?? []
  const satirlar = await Promise.all(basliklar.map((h) => malzemeler(num(h.HeaderNo)).catch(() => [] as TalepMalzeme[])))
  return basliklar.map((h, i) => ozetOf(h, satirlar[i]))
}

/** Talep başlığı + istenen malzemeler + seçili stoklar (taşıma görevi satırları). Yoksa null. */
export async function talepGetir(no: number): Promise<Talep | null> {
  if (!Number.isSafeInteger(no) || no <= 0) return null
  const h = await istek<RawBaslik>('GET', `${P}${baslikYolu(no)}?$select=${BASLIK_SELECT}`)
  if (h.status === 404) return null
  if (h.status !== 200 || !h.body?.HeaderNo) throw new Error(dostaneIfsHata(`Talep HTTP ${h.status}: ${h.text.slice(0, 600)}`, 'Talep okunamadı'))
  const [m, s] = await Promise.all([
    malzemeler(no),
    zorunlu<{ value?: RawSecili[] }>('Seçili stoklar', 'GET', `${P}${baslikYolu(no)}/TrdstSelectedStockArray?$top=500`),
  ])
  const secili = (s.value ?? []).map((r) => ({
    taskId: num(r.TransportTaskId),
    lineNo: num(r.LineNo),
    partNo: str(r.PartNo),
    partAdi: str(r.Description),
    locationNo: str(r.LocationNo),
    lotBatchNo: nz(r.LotBatchNo),
    serialNo: nz(r.SerialNo),
    handlingUnitId: num(r.HandlingUnitId),
    miktar: num(r.Quantity),
  }))
  // Parça açıklaması seçili stoktan (varsa) — talep satırı açıklama taşımıyor.
  for (const x of m) x.partAdi = secili.find((y) => y.partNo === x.partNo)?.partAdi ?? ''
  return { ...ozetOf(h.body, m), malzemeler: m, seciliStoklar: secili }
}

// ── Yazma ────────────────────────────────────────────────────────────────────

async function etag(no: number): Promise<string | undefined> {
  const h = await zorunlu<{ '@odata.etag'?: string }>('Talep', 'GET', `${P}${baslikYolu(no)}?$select=Objstate`)
  return h['@odata.etag']
}

interface RawAday {
  Objkey?: string; '@odata.etag'?: string; LocationNo?: string; LotBatchNo?: string; SerialNo?: string; EngChgLevel?: string
  WaivDevRejNo?: string; ActivitySeq?: number; HandlingUnitId?: number; QtyOnhand?: number
}
const ayni = (k: TalepStokSatiri, r: RawAday) =>
  str(r.LocationNo) === k.locationNo && nz(r.LotBatchNo) === nz(k.lotBatchNo) && nz(r.SerialNo) === nz(k.serialNo) &&
  nz(r.EngChgLevel) === nz(k.engChgLevel) && nz(r.WaivDevRejNo) === nz(k.waivDevRejNo) &&
  num(r.ActivitySeq) === num(k.activitySeq) && num(r.HandlingUnitId) === num(k.handlingUnitId)

/**
 * Talep satırına okutulan stok satırını bağla (rezerv + taşıma görevi satırı). Approved ise önce PrepareDelivery.
 * Yalnız okutulan stok satırı seçilir; miktar satırın kalanını aşamaz.
 */
export async function stokBagla(no: number, satir: TalepSatirAnahtar, stok: TalepStokSatiri, miktar: number): Promise<void> {
  if (!(miktar > 0)) throw new Error('Miktar sıfırdan büyük olmalı')
  if (stok.partNo !== satir.partNo) throw new Error(`Okutulan malzeme (${stok.partNo}) talep satırıyla (${satir.partNo}) eşleşmiyor`)
  const t = await talepGetir(no)
  if (!t) throw new Error(`Talep bulunamadı: ${no}`)
  if (t.durum !== 'Approved' && t.durum !== 'Prepared') throw new Error(`Talep ${no} ${t.durum} durumunda — stok bağlanamaz`)
  const m = t.malzemeler.find((x) => x.partNo === satir.partNo && x.configurationId === nz(satir.configurationId) && x.activitySeq === num(satir.activitySeq))
  if (!m) throw new Error(`Talepte bu malzeme yok: ${satir.partNo}`)
  if (miktar > m.kalan) throw new Error(`Kalan miktarı aşıyor: kalan ${m.kalan}`)
  if (stok.locationNo === t.hedefLok) throw new Error(`Kaynak lokasyon hedefle aynı: ${t.hedefLok}`)

  if (t.durum === 'Approved') {
    await zorunlu('Teslimata hazırlama', 'POST', `${P}${baslikYolu(no)}/${NS}TrdstTransportHead_PrepareDelivery`, {}, await etag(no))
  }
  const { contract } = getIfsConfig()
  const v = await zorunlu<{ Objkey?: string }>('Stoktan seç penceresi', 'POST', `${P}SelectStockItemsHeadVirtuals`, {
    Contract: contract,
    HeaderNo: no,
    PartNo: m.partNo,
    ConfigurationId: m.configurationId,
    ActivitySeq: m.activitySeq,
    Warehouse: t.kaynakAmbar,
    Quantity: m.kalan,
  })
  const objkey = str(v?.Objkey)
  if (!objkey) throw new Error('Stoktan seç penceresi açıldı ama anahtar dönmedi')
  const yol = `${P}SelectStockItemsHeadVirtuals(${encodeURI(`Objkey='${esc(objkey)}'`)})`
  try {
    const adaylar = (await zorunlu<{ value?: RawAday[] }>('Stok adayları', 'GET', `${yol}/TrdstTransportPartVirtualArray`)).value ?? []
    const hedef = adaylar.filter((r) => ayni(stok, r))
    if (hedef.length !== 1) {
      throw new Error(`Okutulan stok ${stok.locationNo} adaylarda ${hedef.length === 0 ? `yok (kaynak ambar ${t.kaynakAmbar} olmalı)` : 'tekil değil'}`)
    }
    await zorunlu(
      'Stok seçimi',
      'PATCH',
      `${yol}/TrdstTransportPartVirtualArray(${encodeURI(`Objkey='${esc(str(hedef[0].Objkey))}'`)})`,
      { Selected: true, QtyToAdd: miktar },
      hedef[0]['@odata.etag'],
    )
    await zorunlu('Stok bağlama', 'POST', `${P}AssignSelected`, { Contract: contract, HeaderNo: no, Objkey: objkey })
  } finally {
    await istek('POST', `${yol}/${NS}SelectStockItemsHeadVirtual_CleanupVirtualEntity`, {}).catch(() => undefined)
  }
}

/** Bağlanan stoğu kaldır (taşıma görevi satırı silinir, rezerv düşer). */
export async function stokKaldir(no: number, taskId: number, lineNo: number): Promise<SeciliStok> {
  const t = await talepGetir(no)
  if (!t) throw new Error(`Talep bulunamadı: ${no}`)
  if (t.durum !== 'Prepared') throw new Error(`Talep ${no} ${t.durum} durumunda — stok kaldırılamaz`)
  const s = t.seciliStoklar.find((x) => x.taskId === taskId && x.lineNo === lineNo)
  if (!s) throw new Error(`Seçili stok bu talepte yok: ${taskId}/${lineNo}`)
  await zorunlu('Stok kaldırma', 'POST', `${P}RemoveTask`, { TransportTaskId: taskId, LineNo: lineNo })
  return s
}

/** Transfer — yalnız Prepared ve tüm satırların kalanı 0 iken. Kısmi transfere izin verilmez. */
export async function transferEt(no: number): Promise<{ ok: boolean; durum: string; eksikler: TalepMalzeme[] }> {
  const t = await talepGetir(no)
  if (!t) throw new Error(`Talep bulunamadı: ${no}`)
  if (t.durum !== 'Prepared') throw new Error(`Talep ${no} ${t.durum} durumunda — önce stok bağlayın`)
  const eksikler = t.malzemeler.filter((m) => m.kalan > 0)
  if (eksikler.length) return { ok: false, durum: t.durum, eksikler }
  await zorunlu('Transfer', 'POST', `${P}${baslikYolu(no)}/${NS}TrdstTransportHead_Transfer`, {}, await etag(no))
  return { ok: true, durum: (await talepGetir(no))?.durum ?? '', eksikler: [] }
}
