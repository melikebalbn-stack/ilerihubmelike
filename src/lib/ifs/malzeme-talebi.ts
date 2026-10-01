import 'server-only'
import { getIfsConfig } from './config'
import { getIfsAccessToken } from './token'
import { dostaneIfsHata } from './ifs-hata'

/**
 * Malzeme Talebi (sarf malzeme çıkışı) — IFS MaterialRequisitionHandling (/main). SERVER-ONLY.
 *
 * Akışlar IFS test ortamında uçtan uca doğrulandı (26.09.2026, talep 6):
 *  - Başlık POST → OrderNo IFS'te atanır, durum doğrudan Released.
 *  - Satır POST (…/MaterialRequisitionLinesArray) → LineNo/ReleaseNo/LineItemNo IFS'te atanır.
 *  - Manuel rezerv: ManualReservationSet sanal başlık → PartInStockToReserveArray (otomatik dolu)
 *    → PATCH QtyToReserve → ReserveMaterials. GERİ ALMA = aynı akış, NEGATİF QtyToReserve.
 *  - Manuel çıkış: ManualIssueSet → PartInStockToIssueArray (yalnız rezervli stok) → PATCH QtyToIssue
 *    → IssueMaterial. Tam teslimde satır ve başlık IFS'te kendiliğinden Closed olur.
 * OrderClass her zaman INT (dahili talep), Contract = IFS_CONTRACT.
 */

const P = 'MaterialRequisitionHandling.svc/'
const NS = 'IfsApp.MaterialRequisitionHandling.'
const INT = `${NS}MaterialRequisType'INT'`

export interface StokKimligi {
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

export interface SatirAnahtar {
  lineNo: string
  releaseNo: string
  lineItemNo: number
}

export interface TalepRezerv {
  locationNo: string
  lotBatchNo: string
  serialNo: string
  engChgLevel: string
  waivDevRejNo: string
  configurationId: string
  activitySeq: number
  handlingUnitId: number
  rezerve: number
  cikis: number
}

export interface TalepSatir extends SatirAnahtar {
  partNo: string
  partAdi: string
  miktar: number
  birim: string
  rezerve: number
  cikis: number
  /** Henüz rezerve/çıkış yapılmamış istenen miktar = QtyDue − rezerve − çıkış (kapalı satırda 0). */
  kalan: number
  durum: string
  rezervler: TalepRezerv[]
}

export interface TalepOzet {
  orderNo: string
  durum: string
  termin: string
  varisYeri: string
  not: string
  kalemSayisi: number
  /** Kalanı (rezerve edilecek miktarı) olan satır sayısı. */
  acikKalem: number
  /** Rezervi olup henüz tüketilmemiş satır sayısı. */
  rezerveKalem: number
}

export interface TalepDetay {
  orderNo: string
  contract: string
  intCustomerNo: string
  destinationId: string
  varisYeri: string
  durum: string
  termin: string
  not: string
  olusturan: string
  satirlar: TalepSatir[]
}

export interface TalepListeleri {
  musteriler: { id: string; ad: string }[]
  varisYerleri: { id: string; ad: string }[]
}

export interface TuketSatirSonuc extends SatirAnahtar {
  partNo: string
  miktar: number
  lokasyonlar: string[]
  ok: boolean
  hata?: string
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

type Yanit<T> = { status: number; body: T; text: string }

async function istek<T = unknown>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  pathAndQuery: string,
  body?: unknown,
  ifMatch?: string,
): Promise<Yanit<T>> {
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

/** 2xx değilse IFS hatasını sadeleştirip fırlatır. */
async function zorunlu<T = unknown>(
  ad: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  pathAndQuery: string,
  body?: unknown,
  ifMatch?: string,
): Promise<T> {
  const r = await istek<T>(method, pathAndQuery, body, ifMatch)
  if (r.status < 200 || r.status >= 300) {
    throw new Error(dostaneIfsHata(`${ad} HTTP ${r.status}: ${r.text.slice(0, 1200)}`, `${ad} başarısız`))
  }
  return r.body
}

const baslikYolu = (orderNo: string) =>
  `MaterialRequisitionSet(${encodeURI(`OrderNo='${esc(orderNo)}',OrderClass=${INT}`)})`
const satirYolu = (orderNo: string, s: SatirAnahtar) =>
  `MaterialRequisitionLineSet(${encodeURI(
    `OrderClass=${INT},OrderNo='${esc(orderNo)}',LineNo='${esc(s.lineNo)}',ReleaseNo='${esc(s.releaseNo)}',LineItemNo=${num(s.lineItemNo)}`,
  )})`
const sanalYolu = (set: string, objkey: string) => `${set}(${encodeURI(`Objkey='${esc(objkey)}'`)})`
const satirParam = (orderNo: string, s: SatirAnahtar) => ({
  OrderClass: 'INT',
  OrderNo: orderNo,
  LineNo: s.lineNo,
  ReleaseNo: s.releaseNo,
  LineItemNo: num(s.lineItemNo),
})

// ── Okuma ────────────────────────────────────────────────────────────────────

interface RawBaslik {
  OrderNo?: string; Contract?: string; IntCustomerNo?: string; DestinationId?: string
  InternalDestination?: string; StatusCode?: string; DueDate?: string; NoteText?: string; CreatedByUserId?: string
}
interface RawSatir {
  LineNo?: string; ReleaseNo?: string; LineItemNo?: number; PartNo?: string; PartDescription?: string
  QtyDue?: number; UnitMeas?: string; QtyAssigned?: number; QtyShipped?: number; StatusCode?: string
}
interface RawRezerv {
  LineNo?: string; ReleaseNo?: string; LineItemNo?: number; LocationNo?: string; LotBatchNo?: string
  SerialNo?: string; EngChgLevel?: string; WaivDevRejNo?: string; ConfigurationId?: string
  ActivitySeq?: number; HandlingUnitId?: number; QtyAssigned?: number; QtyIssued?: number
}

const ayniSatir = (a: SatirAnahtar, b: { LineNo?: string; ReleaseNo?: string; LineItemNo?: number }) =>
  str(b.LineNo) === a.lineNo && str(b.ReleaseNo) === a.releaseNo && num(b.LineItemNo) === num(a.lineItemNo)

/** Talep başlığı + satırlar + satır bazında rezervasyonlar. Bulunamazsa null. */
export async function talepGetir(orderNo: string): Promise<TalepDetay | null> {
  const no = orderNo.trim()
  if (!no) return null
  const b = await istek<RawBaslik>(
    'GET',
    `${P}${baslikYolu(no)}?$select=OrderNo,Contract,IntCustomerNo,DestinationId,InternalDestination,StatusCode,DueDate,NoteText,CreatedByUserId`,
  )
  if (b.status === 404) return null
  if (b.status !== 200 || !b.body?.OrderNo) throw new Error(dostaneIfsHata(`Talep HTTP ${b.status}: ${b.text.slice(0, 600)}`, 'Talep okunamadı'))
  const { contract } = getIfsConfig()
  if (str(b.body.Contract) !== contract) return null // başka sitenin talebi terminalde açılmaz

  const [satirlar, rezervler] = await Promise.all([
    zorunlu<{ value?: RawSatir[] }>(
      'Talep satırları',
      'GET',
      `${P}${baslikYolu(no)}/MaterialRequisitionLinesArray?$select=LineNo,ReleaseNo,LineItemNo,PartNo,PartDescription,QtyDue,UnitMeas,QtyAssigned,QtyShipped,StatusCode&$orderby=LineNo,ReleaseNo&$top=200`,
    ),
    zorunlu<{ value?: RawRezerv[] }>(
      'Rezervasyonlar',
      'GET',
      `${P}MaterialRequisReservatSet?$filter=${encodeURIComponent(`OrderClass eq ${INT} and OrderNo eq '${esc(no)}'`)}` +
        `&$select=LineNo,ReleaseNo,LineItemNo,LocationNo,LotBatchNo,SerialNo,EngChgLevel,WaivDevRejNo,ConfigurationId,ActivitySeq,HandlingUnitId,QtyAssigned,QtyIssued&$top=500`,
    ),
  ])
  const rv = rezervler.value ?? []
  return {
    orderNo: str(b.body.OrderNo),
    contract: str(b.body.Contract),
    intCustomerNo: str(b.body.IntCustomerNo),
    destinationId: str(b.body.DestinationId),
    varisYeri: str(b.body.InternalDestination),
    durum: str(b.body.StatusCode),
    termin: str(b.body.DueDate),
    not: str(b.body.NoteText),
    olusturan: str(b.body.CreatedByUserId),
    satirlar: (satirlar.value ?? []).map((r) => {
      const anahtar = { lineNo: str(r.LineNo), releaseNo: str(r.ReleaseNo), lineItemNo: num(r.LineItemNo) }
      const kapali = str(r.StatusCode) === 'Closed'
      return {
        ...anahtar,
        kalan: kapali ? 0 : Math.max(0, num(r.QtyDue) - num(r.QtyAssigned) - num(r.QtyShipped)),
        partNo: str(r.PartNo),
        partAdi: str(r.PartDescription),
        miktar: num(r.QtyDue),
        birim: str(r.UnitMeas),
        rezerve: num(r.QtyAssigned),
        cikis: num(r.QtyShipped),
        durum: str(r.StatusCode),
        rezervler: rv.filter((x) => ayniSatir(anahtar, x)).map((x) => ({
          locationNo: str(x.LocationNo),
          lotBatchNo: nz(x.LotBatchNo),
          serialNo: nz(x.SerialNo),
          engChgLevel: nz(x.EngChgLevel),
          waivDevRejNo: nz(x.WaivDevRejNo),
          configurationId: nz(x.ConfigurationId),
          activitySeq: num(x.ActivitySeq),
          handlingUnitId: num(x.HandlingUnitId),
          rezerve: num(x.QtyAssigned),
          cikis: num(x.QtyIssued),
        })),
      }
    }),
  }
}

/**
 * Terminal listesi: bu sitenin kapanmamış dahili talepleri (IFS'te planlamanın açtıkları dahil) — kalanı ya da
 * tüketilecek rezervi olanlar, terminine göre. Başlık durumu OData filtresinde değil (enum tipi adı belirsiz),
 * okunduktan sonra eleniyor; satırlar talep başına okunur (en fazla LISTE_UST talep, 8'erli paralel).
 */
const LISTE_UST = 40
export async function bekleyenTalepler(): Promise<TalepOzet[]> {
  const { contract } = getIfsConfig()
  const b = await zorunlu<{ value?: RawBaslik[] }>(
    'Talepler',
    'GET',
    `${P}MaterialRequisitionSet?$filter=${encodeURIComponent(`Contract eq '${esc(contract)}' and OrderClass eq ${INT}`)}` +
      `&$select=OrderNo,StatusCode,DueDate,InternalDestination,NoteText&$orderby=DueDate desc&$top=300`,
  )
  const acik = (b.value ?? []).filter((r) => str(r.StatusCode) !== 'Closed' && str(r.OrderNo)).slice(0, LISTE_UST)
  const sonuc: TalepOzet[] = []
  for (let i = 0; i < acik.length; i += 8) {
    const parca = await Promise.all(
      acik.slice(i, i + 8).map(async (r) => {
        const no = str(r.OrderNo)
        const s = await zorunlu<{ value?: RawSatir[] }>(
          'Talep satırları',
          'GET',
          `${P}${baslikYolu(no)}/MaterialRequisitionLinesArray?$select=PartNo,QtyDue,QtyAssigned,QtyShipped,StatusCode&$top=200`,
        )
        const satirlar = (s.value ?? []).filter((x) => str(x.StatusCode) !== 'Closed')
        return {
          orderNo: no,
          durum: str(r.StatusCode),
          termin: str(r.DueDate),
          varisYeri: str(r.InternalDestination),
          not: str(r.NoteText),
          kalemSayisi: (s.value ?? []).length,
          acikKalem: satirlar.filter((x) => num(x.QtyDue) - num(x.QtyAssigned) - num(x.QtyShipped) > 0).length,
          rezerveKalem: satirlar.filter((x) => num(x.QtyAssigned) > 0).length,
        }
      }),
    )
    sonuc.push(...parca)
  }
  return sonuc
    .filter((t) => t.acikKalem > 0 || t.rezerveKalem > 0)
    .sort((a, b) => (a.termin || '9999').localeCompare(b.termin || '9999'))
}

/** Dahili müşteriler (Active) + dahili varış yerleri (Contract, Active). */
export async function degerListeleri(): Promise<TalepListeleri> {
  const { contract } = getIfsConfig()
  const [m, v] = await Promise.all([
    zorunlu<{ value?: { IntCustomerNo?: string; Name?: string; Objstate?: string }[] }>(
      'Dahili müşteriler',
      'GET',
      `${P}Reference_InternalCustomer?$select=IntCustomerNo,Name,Objstate&$orderby=IntCustomerNo&$top=200`,
    ),
    zorunlu<{ value?: { DestinationId?: string; Description?: string; Objstate?: string }[] }>(
      'Varış yerleri',
      'GET',
      `${P}Reference_InternalDestinationLov?$filter=${encodeURIComponent(`Contract eq '${esc(contract)}'`)}` +
        `&$select=DestinationId,Description,Objstate&$orderby=DestinationId&$top=200`,
    ),
  ])
  const aktif = (s?: string) => !s || s === 'Active'
  return {
    musteriler: (m.value ?? []).filter((r) => aktif(r.Objstate)).map((r) => ({ id: str(r.IntCustomerNo), ad: str(r.Name) || str(r.IntCustomerNo) })),
    varisYerleri: (v.value ?? []).filter((r) => aktif(r.Objstate)).map((r) => ({ id: str(r.DestinationId), ad: str(r.Description) || str(r.DestinationId) })),
  }
}

// ── Yazma ────────────────────────────────────────────────────────────────────

/** Yeni dahili talep; IFS'in atadığı OrderNo'yu döndürür. */
export async function talepOlustur(intCustomerNo: string, destinationId: string, not?: string): Promise<string> {
  const { contract } = getIfsConfig()
  const dflt = await zorunlu<{ DueDate?: string }>('Talep varsayılanları', 'GET', `${P}MaterialRequisitionSet/${NS}MaterialRequisition_Default()`)
  const govde: Record<string, unknown> = {
    OrderClass: 'INT',
    Contract: contract,
    IntCustomerNo: intCustomerNo,
    DestinationId: destinationId,
    DueDate: dflt.DueDate,
  }
  if (not?.trim()) govde.NoteText = not.trim()
  const h = await zorunlu<{ OrderNo?: string }>('Talep oluşturma', 'POST', `${P}MaterialRequisitionSet`, govde)
  const orderNo = str(h?.OrderNo)
  if (!orderNo) throw new Error('Talep oluştu ama IFS talep numarası dönmedi')
  return orderNo
}

interface RawAday {
  Objkey?: string; '@odata.etag'?: string; LocationNo?: string; LotBatchNo?: string; SerialNo?: string
  EngChgLevel?: string; WaivDevRejNo?: string; ActivitySeq?: number; HandlingUnitId?: number
  AvailableQty?: number; QtyReserved?: number; QtyAssigned?: number; ConfigurationId?: string
}

/** Sanal aday satırı okutulan stok satırıyla aynı mı? (Rezerv adayında ConfigurationId yok.) */
function ayniStok(k: Omit<StokKimligi, 'partNo'>, r: RawAday): boolean {
  return (
    str(r.LocationNo) === k.locationNo &&
    nz(r.LotBatchNo) === nz(k.lotBatchNo) &&
    nz(r.SerialNo) === nz(k.serialNo) &&
    nz(r.EngChgLevel) === nz(k.engChgLevel) &&
    nz(r.WaivDevRejNo) === nz(k.waivDevRejNo) &&
    num(r.ActivitySeq) === num(k.activitySeq) &&
    num(r.HandlingUnitId) === num(k.handlingUnitId) &&
    (r.ConfigurationId === undefined || nz(r.ConfigurationId) === nz(k.configurationId))
  )
}

/**
 * Manuel rezerv (miktar > 0) ya da rezerv geri alma (miktar < 0) — yalnız verilen stok satırı için.
 * Sanal başlık her durumda temizlenir (temizlik hatası asıl sonucu bozmaz).
 */
async function manuelRezerv(orderNo: string, satir: SatirAnahtar, kimlik: StokKimligi, miktar: number): Promise<void> {
  const { contract } = getIfsConfig()
  const v = await zorunlu<{ Objkey?: string }>('Rezerv penceresi', 'POST', `${P}ManualReservationSet`, {
    ...satirParam(orderNo, satir),
    Contract: contract,
    PartNo: kimlik.partNo,
  })
  const objkey = str(v?.Objkey)
  if (!objkey) throw new Error('Rezerv penceresi açıldı ama anahtar dönmedi')
  const yol = sanalYolu('ManualReservationSet', objkey)
  try {
    const adaylar = await zorunlu<{ value?: RawAday[] }>('Rezerv adayları', 'GET', `${P}${yol}/PartInStockToReserveArray`)
    const hedef = (adaylar.value ?? []).filter((r) => ayniStok(kimlik, r))
    if (hedef.length !== 1) {
      throw new Error(`Okutulan stok satırı rezerv adaylarında ${hedef.length === 0 ? 'bulunamadı' : 'tekil değil'} (${kimlik.locationNo})`)
    }
    const t = hedef[0]
    if (miktar > 0 && num(t.AvailableQty) < miktar) {
      throw new Error(`Kullanılabilir miktar yetersiz: ${num(t.AvailableQty)} < ${miktar}`)
    }
    if (miktar < 0 && num(t.QtyReserved) < -miktar) {
      throw new Error(`Geri alınacak rezerv bulunamadı: ${num(t.QtyReserved)} < ${-miktar}`)
    }
    await zorunlu(
      'Rezerv miktarı',
      'PATCH',
      `${P}${yol}/PartInStockToReserveArray(${encodeURI(`Objkey='${esc(str(t.Objkey))}'`)})`,
      { QtyToReserve: miktar },
      t['@odata.etag'],
    )
    await zorunlu('Rezerv', 'POST', `${P}ReserveMaterials`, {
      ...satirParam(orderNo, satir),
      Contract: contract,
      PartNo: kimlik.partNo,
      ParentObjkey: objkey,
    })
  } finally {
    await istek('POST', `${P}${yol}/${NS}ManualReservationVirtual_CleanupVirtualEntity`, {}).catch(() => undefined)
  }
}

async function satirSil(orderNo: string, satir: SatirAnahtar): Promise<void> {
  const g = await zorunlu<{ '@odata.etag'?: string }>('Satır', 'GET', `${P}${satirYolu(orderNo, satir)}?$select=LineNo`)
  await zorunlu('Satır silme', 'DELETE', `${P}${satirYolu(orderNo, satir)}`, undefined, g['@odata.etag'] ?? '*')
}

/**
 * Satır ekle + okutulan stok satırından rezerv. Rezerv başarısızsa eklenen satır geri silinir;
 * silme de başarısızsa iki hatayı birlikte içeren açık bir hata fırlatılır.
 */
export async function satirEkleVeRezerve(orderNo: string, kimlik: StokKimligi, miktar: number): Promise<SatirAnahtar> {
  if (!(miktar > 0)) throw new Error('Miktar sıfırdan büyük olmalı')
  const talep = await talepGetir(orderNo)
  if (!talep) throw new Error(`Talep bulunamadı: ${orderNo}`)
  if (talep.durum === 'Closed') throw new Error(`Talep kapalı: ${orderNo}`)
  const { contract } = getIfsConfig()
  const l = await zorunlu<{ LineNo?: string; ReleaseNo?: string; LineItemNo?: number }>(
    'Satır ekleme',
    'POST',
    `${P}${baslikYolu(orderNo)}/MaterialRequisitionLinesArray`,
    { OrderClass: 'INT', OrderNo: orderNo, Contract: contract, PartNo: kimlik.partNo, QtyDue: miktar, DueDate: talep.termin || undefined },
  )
  const satir: SatirAnahtar = { lineNo: str(l?.LineNo), releaseNo: str(l?.ReleaseNo), lineItemNo: num(l?.LineItemNo) }
  if (!satir.lineNo) throw new Error('Satır eklendi ama IFS satır anahtarı dönmedi')
  try {
    await manuelRezerv(orderNo, satir, kimlik, miktar)
  } catch (e) {
    const rezervHata = e instanceof Error ? e.message : String(e)
    try {
      await satirSil(orderNo, satir)
    } catch (e2) {
      const silHata = e2 instanceof Error ? e2.message : String(e2)
      throw new Error(`Rezerv başarısız (${rezervHata}) ve eklenen satır ${satir.lineNo}/${satir.releaseNo} SİLİNEMEDİ (${silHata}) — IFS'te elle kontrol edin`)
    }
    throw new Error(`Rezerv başarısız, satır geri alındı: ${rezervHata}`)
  }
  return satir
}

/**
 * Talepteki MEVCUT satıra (IFS'te planlamanın açtığı) okutulan stoktan rezerv — yeni satır AÇILMAZ.
 * Okutulan parça satırın parçası olmalı; miktar satırın kalanını aşamaz.
 */
export async function satirRezerve(orderNo: string, satir: SatirAnahtar, kimlik: StokKimligi, miktar: number): Promise<TalepSatir> {
  if (!(miktar > 0)) throw new Error('Miktar sıfırdan büyük olmalı')
  const talep = await talepGetir(orderNo)
  if (!talep) throw new Error(`Talep bulunamadı: ${orderNo}`)
  if (talep.durum === 'Closed') throw new Error(`Talep kapalı: ${orderNo}`)
  const s = talep.satirlar.find((x) => x.lineNo === satir.lineNo && x.releaseNo === satir.releaseNo && x.lineItemNo === num(satir.lineItemNo))
  if (!s) throw new Error(`Talep satırı bulunamadı: ${satir.lineNo}/${satir.releaseNo}`)
  if (s.durum === 'Closed') throw new Error(`Talep satırı kapalı: ${s.partNo}`)
  if (s.partNo !== kimlik.partNo) throw new Error(`Okutulan malzeme ${s.partNo} değil (${kimlik.partNo})`)
  if (miktar > s.kalan + 1e-9) throw new Error(`Talepte kalan ${s.kalan} ${s.birim} — fazlası rezerve edilemez`)
  await manuelRezerv(orderNo, satir, kimlik, miktar)
  return s
}

/** Mevcut satırdaki tek bir stok rezervini (kısmen ya da tamamen) geri alır; satır silinmez. */
export async function rezervGeriAl(orderNo: string, satir: SatirAnahtar, kimlik: StokKimligi, miktar: number): Promise<void> {
  if (!(miktar > 0)) throw new Error('Miktar sıfırdan büyük olmalı')
  await manuelRezerv(orderNo, satir, kimlik, -miktar)
}

/** Satırın tüm rezervlerini geri alır, satırı SİLMEZ (talep satırı planlamanındır). Çıkışı yapılmış satırda olmaz. */
export async function satirRezervleriniKaldir(orderNo: string, satir: SatirAnahtar): Promise<{ partNo: string; geriAlinan: TalepRezerv[] }> {
  const talep = await talepGetir(orderNo)
  if (!talep) throw new Error(`Talep bulunamadı: ${orderNo}`)
  const s = talep.satirlar.find((x) => x.lineNo === satir.lineNo && x.releaseNo === satir.releaseNo && x.lineItemNo === num(satir.lineItemNo))
  if (!s) throw new Error(`Satır bulunamadı: ${satir.lineNo}/${satir.releaseNo}`)
  if (s.cikis > 0) throw new Error('Bu satırdan çıkış yapılmış — rezerv kaldırılamaz')
  const geriAlinan = s.rezervler.filter((x) => x.rezerve > 0)
  if (!geriAlinan.length) throw new Error('Bu satırda rezerv yok')
  for (const r of geriAlinan) {
    await manuelRezerv(orderNo, satir, { ...r, partNo: s.partNo }, -r.rezerve)
  }
  return { partNo: s.partNo, geriAlinan }
}

/** Satırı çıkar: tüm rezervlerini negatif miktarla geri al, sonra satırı sil. Çıkışı yapılmış satır çıkarılamaz. */
export async function satirCikar(orderNo: string, satir: SatirAnahtar): Promise<{ partNo: string; geriAlinan: TalepRezerv[] }> {
  const talep = await talepGetir(orderNo)
  if (!talep) throw new Error(`Talep bulunamadı: ${orderNo}`)
  const s = talep.satirlar.find((x) => x.lineNo === satir.lineNo && x.releaseNo === satir.releaseNo && x.lineItemNo === num(satir.lineItemNo))
  if (!s) throw new Error(`Satır bulunamadı: ${satir.lineNo}/${satir.releaseNo}`)
  if (s.cikis > 0) throw new Error('Bu satırdan çıkış yapılmış — çıkarılamaz')
  for (const r of s.rezervler.filter((x) => x.rezerve > 0)) {
    await manuelRezerv(orderNo, satir, { ...r, partNo: s.partNo }, -r.rezerve)
  }
  await satirSil(orderNo, satir)
  return { partNo: s.partNo, geriAlinan: s.rezervler.filter((x) => x.rezerve > 0) }
}

/**
 * Rezervli her açık satır için manuel çıkış (QtyToIssue = rezerve miktar). Bir satırın hatası
 * diğerlerini durdurmaz; satır bazında sonuç + güncel talep durumu döner.
 */
export async function tuket(orderNo: string): Promise<{ sonuclar: TuketSatirSonuc[]; talepDurumu: string }> {
  const talep = await talepGetir(orderNo)
  if (!talep) throw new Error(`Talep bulunamadı: ${orderNo}`)
  const { contract } = getIfsConfig()
  const sonuclar: TuketSatirSonuc[] = []
  for (const s of talep.satirlar.filter((x) => x.rezerve > 0 && x.durum !== 'Closed')) {
    const anahtar = { lineNo: s.lineNo, releaseNo: s.releaseNo, lineItemNo: s.lineItemNo }
    const sonuc: TuketSatirSonuc = { ...anahtar, partNo: s.partNo, miktar: 0, lokasyonlar: [], ok: false }
    let objkey = ''
    try {
      const v = await zorunlu<{ Objkey?: string }>('Çıkış penceresi', 'POST', `${P}ManualIssueSet`, {
        ...satirParam(orderNo, anahtar),
        Contract: contract,
        PartNo: s.partNo,
      })
      objkey = str(v?.Objkey)
      if (!objkey) throw new Error('Çıkış penceresi açıldı ama anahtar dönmedi')
      const yol = sanalYolu('ManualIssueSet', objkey)
      const adaylar = (await zorunlu<{ value?: RawAday[] }>('Çıkış adayları', 'GET', `${P}${yol}/PartInStockToIssueArray`)).value ?? []
      const rezervli = adaylar.filter((r) => num(r.QtyAssigned) > 0)
      if (!rezervli.length) throw new Error('Çıkış adaylarında rezervli stok yok')
      for (const r of rezervli) {
        await zorunlu(
          'Çıkış miktarı',
          'PATCH',
          `${P}${yol}/PartInStockToIssueArray(${encodeURI(`Objkey='${esc(str(r.Objkey))}'`)})`,
          { QtyToIssue: num(r.QtyAssigned) },
          r['@odata.etag'],
        )
      }
      await zorunlu('Çıkış', 'POST', `${P}IssueMaterial`, {
        ...satirParam(orderNo, anahtar),
        PartNo: s.partNo,
        Contract: contract,
        ParentObjkey: objkey,
      })
      sonuc.miktar = rezervli.reduce((t, r) => t + num(r.QtyAssigned), 0)
      sonuc.lokasyonlar = rezervli.map((r) => str(r.LocationNo))
      sonuc.ok = true
    } catch (e) {
      sonuc.hata = e instanceof Error ? e.message : String(e)
    } finally {
      if (objkey) {
        await istek('POST', `${P}${sanalYolu('ManualIssueSet', objkey)}/${NS}ManualIssueVirtual_CleanupVirtualEntity`, {}).catch(() => undefined)
      }
    }
    sonuclar.push(sonuc)
  }
  const son = await talepGetir(orderNo).catch(() => null)
  return { sonuclar, talepDurumu: son?.durum ?? talep.durum }
}
