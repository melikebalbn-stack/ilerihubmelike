import 'server-only'
import { getIfsConfig } from './config'
import { getIfsAccessToken } from './token'
import { dostaneIfsHata } from './ifs-hata'
import { getPartAdi } from './depo-stok'

/**
 * Sayım (standart IFS sayım raporu) — CountReportsAnalysis + CountPerCountReport (/main; "Handling" eki YOK). SERVER-ONLY.
 *
 * IFS test ortamında doğrulanan yollar (27.09.2026, rapor 3):
 *  - YOL C: PATCH CountingReportLineSet(Seq,InvListNo) { QtyCount1 } (If-Match) → sayılan miktar yazılır.
 *  - YOL A: bound CountingReportLine_CountLineWithoutDiff → QtyCount1 = QtyOnhand. IFS dondurulmamış raporda da
 *    kabul ediyor (QtyOnhand rapor oluşturma anı) → terminal yalnız FreezeCode=FrozenForCounting iken izin verir.
 *  - Onay yapılmadıkça stok DEĞİŞMEZ. Onay / iptal / dondurma terminalde YOK (istek katmanında engelli).
 *  - TRDST sayım aktarımı rapor satırına yazmıyor → bu modül TRDST kullanmaz.
 * KÖR SAYIM: sistem miktarı satır sayılmadan istemciye gönderilmez; sayıldıktan sonra yalnız fark yönü döner.
 */

const CR = 'CountReportsAnalysis.svc/'
const CP = 'CountPerCountReport.svc/'
const CPN = 'IfsApp.CountPerCountReport.'

// Güvenlik kilidi: onay (stoğa fark yansıtma), iptal, dondurma, toplu sayım ve satır ekleme terminalde yasak.
const YASAK = /Confirm|Cancel|Freeze|CountAsZero|CountAll|(?<!Line)WithoutDiff|CreateCountReportLines/i

export interface SayimRaporuOzet {
  no: string
  ambar: string
  dondurulmus: boolean
  sayilan: number
  toplam: number
}

export type FarkDurumu = 'esit' | 'fazla' | 'eksik'

export interface SayimSatiri {
  seq: number
  partNo: string
  partAdi: string
  locationNo: string
  lotBatchNo: string
  serialNo: string
  handlingUnitId: number
  sayilan: number | null
  onayli: boolean
  /** Yalnız sayılmış satırda dolu (kör sayım). */
  fark: FarkDurumu | null
}

export interface SayimRaporu extends SayimRaporuOzet {
  satirlar: SayimSatiri[]
}

// ── HTTP ─────────────────────────────────────────────────────────────────────

function mainRoot(): string {
  const { baseUrl } = getIfsConfig()
  return baseUrl.replace(/[A-Za-z]+\.svc$/, '').replace('/int/', '/main/')
}
const esc = (v: string) => v.replace(/'/g, "''")
const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const numOrNull = (v: unknown): number | null => (v == null || v === '' ? null : num(v))
const str = (v: unknown): string => (v == null ? '' : String(v))
const EPS = 1e-9

type Metod = 'GET' | 'POST' | 'PATCH'

async function istek<T = unknown>(method: Metod, pathAndQuery: string, body?: unknown, ifMatch?: string) {
  // Yalnız yol denetlenir: $select içindeki Confirmed / FreezeCode alan adları eylem değildir.
  if (YASAK.test(pathAndQuery.split('?')[0])) throw new Error('Bu IFS eylemi sayım terminalinde yasak')
  const token = await getIfsAccessToken()
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
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

const satirYolu = (no: string, seq: number) => `${CP}CountingReportLineSet(${encodeURI(`Seq=${num(seq)},InvListNo='${esc(no)}'`)})`

// ── Okuma ────────────────────────────────────────────────────────────────────

interface RawRapor { InvListNo?: string; NoOfUncountedRows?: number; NoOfCountedLines?: number; FreezeCode?: string; Contract?: string }
interface RawSatir {
  Seq?: number; PartNo?: string; LocationNo?: string; LotBatchNo?: string; SerialNo?: string; HandlingUnitId?: number
  QtyOnhand?: number | null; QtyCount1?: number | null; Confirmed?: boolean; '@odata.etag'?: string
}
const SATIR_SELECT = 'Seq,PartNo,LocationNo,LotBatchNo,SerialNo,HandlingUnitId,QtyOnhand,QtyCount1,Confirmed'

function farkOf(sistem: number | null, sayilan: number | null): FarkDurumu | null {
  if (sayilan == null || sistem == null) return null
  if (Math.abs(sayilan - sistem) < EPS) return 'esit'
  return sayilan > sistem ? 'fazla' : 'eksik'
}

/** Sayılmamış satırı olan açık raporlar (Contract). */
export async function raporlar(): Promise<SayimRaporuOzet[]> {
  const { contract } = getIfsConfig()
  const f = encodeURIComponent(`Contract eq '${esc(contract)}'`)
  const [acik, analiz] = await Promise.all([
    zorunlu<{ value?: RawRapor[] }>('Sayım raporları', 'GET', `${CP}CountingReportSet?$filter=${f}&$select=InvListNo,NoOfUncountedRows,NoOfCountedLines,FreezeCode&$top=200`),
    zorunlu<{ value?: { InvListNo?: string; WarehouseId?: string }[] }>('Sayım raporu analizi', 'GET', `${CR}CountingReports?$filter=${f}&$select=InvListNo,WarehouseId&$top=500`),
  ])
  const ambar = new Map((analiz.value ?? []).map((r) => [str(r.InvListNo), str(r.WarehouseId)]))
  return (acik.value ?? [])
    .filter((r) => num(r.NoOfUncountedRows) > 0)
    .map((r) => ({
      no: str(r.InvListNo),
      ambar: ambar.get(str(r.InvListNo)) ?? '',
      dondurulmus: str(r.FreezeCode) === 'FrozenForCounting',
      sayilan: num(r.NoOfCountedLines),
      toplam: num(r.NoOfCountedLines) + num(r.NoOfUncountedRows),
    }))
    .sort((a, b) => Number(b.no) - Number(a.no))
}

/** Rapor + satırlar (kör sayım: sistem miktarı dışarı verilmez). Yoksa null. */
export async function raporGetir(no: string): Promise<SayimRaporu | null> {
  const n = no.trim()
  if (!n) return null
  const { contract } = getIfsConfig()
  const [ozet, analiz, satir] = await Promise.all([
    zorunlu<{ value?: RawRapor[] }>('Sayım raporu', 'GET', `${CP}CountingReportSet?$filter=${encodeURIComponent(`InvListNo eq '${esc(n)}'`)}&$select=InvListNo,NoOfUncountedRows,NoOfCountedLines,FreezeCode,Contract`),
    zorunlu<{ value?: { InvListNo?: string; WarehouseId?: string; Contract?: string; FreezeCode?: string }[] }>('Sayım raporu analizi', 'GET', `${CR}CountingReports?$filter=${encodeURIComponent(`InvListNo eq '${esc(n)}'`)}&$select=InvListNo,WarehouseId,Contract,FreezeCode`),
    zorunlu<{ value?: RawSatir[] }>('Sayım satırları', 'GET', `${CP}CountingReportLineSet?$filter=${encodeURIComponent(`InvListNo eq '${esc(n)}'`)}&$select=${SATIR_SELECT}&$orderby=Seq&$top=2000`),
  ])
  const a = analiz.value?.[0]
  if (!a || str(a.Contract) !== contract) return null
  const o = ozet.value?.[0]
  const satirlar = satir.value ?? []
  const adlar = new Map<string, string>()
  const parcalar = [...new Set(satirlar.map((r) => str(r.PartNo)))].slice(0, 100)
  await Promise.all(parcalar.map(async (p) => adlar.set(p, (await getPartAdi(p).catch(() => null)) ?? '')))
  const sayilan = satirlar.filter((r) => r.QtyCount1 != null).length
  return {
    no: n,
    ambar: str(a.WarehouseId),
    dondurulmus: str(o?.FreezeCode ?? a.FreezeCode) === 'FrozenForCounting',
    sayilan,
    toplam: satirlar.length,
    satirlar: satirlar.map((r) => {
      const say = numOrNull(r.QtyCount1)
      return {
        seq: num(r.Seq),
        partNo: str(r.PartNo),
        partAdi: adlar.get(str(r.PartNo)) ?? '',
        locationNo: str(r.LocationNo),
        lotBatchNo: str(r.LotBatchNo) || '*',
        serialNo: str(r.SerialNo) || '*',
        handlingUnitId: num(r.HandlingUnitId),
        sayilan: say,
        onayli: r.Confirmed === true,
        fark: farkOf(numOrNull(r.QtyOnhand), say),
      }
    }),
  }
}

async function satirOku(no: string, seq: number): Promise<RawSatir> {
  const r = await istek<RawSatir>('GET', `${satirYolu(no, seq)}?$select=${SATIR_SELECT}`)
  if (r.status === 404) throw new Error(`Sayım satırı bulunamadı: ${no}/${seq}`)
  if (r.status !== 200) throw new Error(dostaneIfsHata(`Sayım satırı HTTP ${r.status}: ${r.text.slice(0, 600)}`, 'Sayım satırı okunamadı'))
  return r.body
}

// ── Yazma ────────────────────────────────────────────────────────────────────

export interface YazmaSonucu {
  seq: number
  partNo: string
  locationNo: string
  lotBatchNo: string
  sayilan: number
  fark: FarkDurumu | null
}

const sonucOf = (r: RawSatir): YazmaSonucu => ({
  seq: num(r.Seq),
  partNo: str(r.PartNo),
  locationNo: str(r.LocationNo),
  lotBatchNo: str(r.LotBatchNo) || '*',
  sayilan: num(r.QtyCount1),
  fark: farkOf(numOrNull(r.QtyOnhand), numOrNull(r.QtyCount1)),
})

/** YOL C: sayılan miktarı yaz; sonra satırı yeniden okuyup doğrular. Onaylı satır yazılamaz. */
export async function sayilanYaz(no: string, seq: number, miktar: number): Promise<YazmaSonucu> {
  if (!(miktar >= 0) || !Number.isFinite(miktar)) throw new Error('Miktar 0 ya da pozitif olmalı')
  const once = await satirOku(no, seq)
  if (once.Confirmed) throw new Error('Onaylı satır değiştirilemez')
  await zorunlu('Sayılan miktar', 'PATCH', satirYolu(no, seq), { QtyCount1: miktar }, once['@odata.etag'])
  const son = await satirOku(no, seq)
  if (son.QtyCount1 == null || Math.abs(num(son.QtyCount1) - miktar) > EPS) {
    throw new Error(`Sayılan miktar IFS'e yazılamadı (beklenen ${miktar}, okunan ${son.QtyCount1 ?? 'boş'})`)
  }
  return sonucOf(son)
}

/** YOL A: sistemdeki miktarla aynı say (yalnız dondurulmuş raporda). Sonra doğrular. */
export async function sistemleAyni(no: string, seq: number): Promise<YazmaSonucu> {
  const once = await satirOku(no, seq)
  if (once.Confirmed) throw new Error('Onaylı satır değiştirilemez')
  // QtyOnhand dondurulmamış raporda da dolu gelir → karar rapor başlığının dondurma durumundan verilir.
  const baslik = await zorunlu<{ value?: RawRapor[] }>('Sayım raporu', 'GET', `${CP}CountingReportSet?$filter=${encodeURIComponent(`InvListNo eq '${esc(no)}'`)}&$select=InvListNo,FreezeCode`)
  if (str(baslik.value?.[0]?.FreezeCode) !== 'FrozenForCounting' || once.QtyOnhand == null) {
    throw new Error('Rapor dondurulmamış — "sistemdekiyle aynı" kullanılamaz, miktarı girin')
  }
  await zorunlu('Farksız sayım', 'POST', `${satirYolu(no, seq)}/${CPN}CountingReportLine_CountLineWithoutDiff`, {}, once['@odata.etag'])
  const son = await satirOku(no, seq)
  if (son.QtyCount1 == null || Math.abs(num(son.QtyCount1) - num(son.QtyOnhand)) > EPS) {
    throw new Error('Farksız sayım IFS\'e yazılamadı')
  }
  return sonucOf(son)
}
