/**
 * PDKS Faz 3 — geçiş olayı alımı (plan §3.1). ÇEKİRDEK: DB erişimi yalnız OlayDeposu
 * arayüzünden (Prisma: olay-depo.ts; testte bellek içi depo). Hem push ucu
 * (/api/pdks/olay) hem AcsEvent boşluk doldurma (toplayici.ts) buradan geçer.
 *
 * Kurallar (kilitli):
 * - Dedup: "<cihazKod>:<seriDonem>:<serialNo>" → ON CONFLICT DO NOTHING (push + poll aynı olayı getirebilir).
 * - PdksGecis DEĞİŞTİRİLEMEZ; kart → personel eşlemesi olay ANINDA yapılır ve satıra yazılır.
 * - Tanımsız kart da yazılır (personnelId null, TANIMSIZ_KART). Pasif kart / pasif personel → PASIF_KART.
 * - Yön okuyucudan (PdksOkuyucu.yon). "Geçti" sensör olayı aynı kapıdaki son kart olayına bağlanır
 *   (bagliGecisId); pdks_gecis_sensoru_zorunlu mantığı Faz 4 — burada yalnız veri.
 * - Olay zamanı panelden gelir; panel saati sunucudan > 60 sn İLERİDEYSE uyarı (cihaz sağlığı).
 * - İmleç (sonSeriNo) = kesintisiz alınan son seri. Delik varsa poll doldurur; delikten sonraki
 *   ilk olay 24 saatten eskiyse delik KAYIP sayılır, imleç ilerletilir ve UYARI yazılır (sessiz değil).
 */
import { timingSafeEqual } from 'node:crypto'
import { cihazOlaySinifi, type OlayEsleme } from './olay-esleme'

export const SAAT_SAPMA_ESIGI_SN = 60
export const SENSOR_BAG_PENCERE_SN = 10
export const KAYIP_BOSLUK_SAAT = 24
/** Aynı dönemde daha küçük seri + bu kadar sn daha yeni zaman → panel seri sayacı sıfırlanmış. */
export const DONEM_SIFIRLAMA_PAYI_SN = 60

export type HubOlayTipi =
  | 'GECERLI_KART'
  | 'YETKISIZ' // Hub'da aktif kart, panel reddetti (ör. senkron bekliyor)
  | 'TANIMSIZ_KART'
  | 'PASIF_KART'
  | 'GECIS_SENSORU'
  | 'YANGIN_ALARMI'
  | 'DIGER'

export interface HamOlay {
  serialNo: number
  zamanHam: string
  major: number
  minor: number
  cardNo: string | null
  employeeNo: string | null
  doorNo: number | null
  cardReaderNo: number | null
  ham: Record<string, unknown>
}

// ── Zaman ────────────────────────────────────────────────────────────────────

/** Panel zamanı. Ofsetsizse Europe/Istanbul (+03:00, 2016'dan beri sabit) varsayılır. */
export function zamanCoz(ham: string | null | undefined): Date | null {
  const s = String(ham ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s)) return null
  const d = Date.parse(/([+-]\d{2}:?\d{2}|Z)$/.test(s) ? s : `${s}+03:00`)
  return Number.isNaN(d) ? null : new Date(d)
}

/** AcsEvent koşulu için: "2026-09-26T08:00:00+03:00" */
export function hikZamanOfsetli(d: Date): string {
  return new Date(d.getTime() + 3 * 3600_000).toISOString().slice(0, 19) + '+03:00'
}

// ── Ayrıştırma ───────────────────────────────────────────────────────────────

const sayi = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}
const metin = (v: unknown): string | null => {
  const s = v === null || v === undefined ? '' : String(v).trim()
  return s === '' ? null : s
}

function olayYap(o: Record<string, unknown>, zamanHam: unknown, major: unknown, minor: unknown, ham: Record<string, unknown>): HamOlay | null {
  const serialNo = sayi(o.serialNo)
  const mj = sayi(major)
  const mn = sayi(minor)
  const z = metin(zamanHam)
  if (serialNo === null || mj === null || mn === null || !z) return null
  return {
    serialNo,
    zamanHam: z,
    major: mj,
    minor: mn,
    cardNo: metin(o.cardNo),
    employeeNo: metin(o.employeeNoString) ?? metin(o.employeeNo),
    doorNo: sayi(o.doorNo),
    cardReaderNo: sayi(o.cardReaderNo),
    ham,
  }
}

export interface PushCozum {
  olaylar: HamOlay[]
  nabiz: boolean
  atlanan: number
}

/**
 * Push gövdesi (EventNotificationAlert, JSON). multipart gelirse route JSON parçalarını (event_log /
 * AccessControllerEvent) metin olarak verir. Kalp atışı (heartBeat) olay değildir ama cihazın canlı
 * olduğunu gösterir. Ayrıştırılamayan parça atlanır ve sayılır — istek düşmez.
 */
export function pushGovdesiCoz(jsonParcalari: string[]): PushCozum {
  const sonuc: PushCozum = { olaylar: [], nabiz: false, atlanan: 0 }
  for (const parca of jsonParcalari) {
    let obj: unknown
    try {
      obj = JSON.parse(parca)
    } catch {
      sonuc.atlanan++
      continue
    }
    if (!obj || typeof obj !== 'object') {
      sonuc.atlanan++
      continue
    }
    const a = obj as Record<string, unknown>
    const tip = String(a.eventType ?? '')
    if (/heartbeat/i.test(tip)) {
      sonuc.nabiz = true
      continue
    }
    const ace = a.AccessControllerEvent as Record<string, unknown> | undefined
    if (!ace || typeof ace !== 'object') {
      sonuc.atlanan++
      continue
    }
    const o = olayYap(ace, a.dateTime ?? ace.time, ace.majorEventType ?? ace.major, ace.subEventType ?? ace.minor, a)
    if (o) sonuc.olaylar.push(o)
    else sonuc.atlanan++
  }
  return sonuc
}

/** AcsEvent arama yanıtı → olaylar + devam (MORE) bayrağı. */
export function acsEventCoz(veri: Record<string, unknown>): { olaylar: HamOlay[]; devam: boolean; atlanan: number } {
  const s = (veri.AcsEvent ?? {}) as { responseStatusStrg?: string; InfoList?: Record<string, unknown>[] }
  const liste = Array.isArray(s.InfoList) ? s.InfoList : []
  const olaylar: HamOlay[] = []
  let atlanan = 0
  for (const i of liste) {
    const o = olayYap(i, i.time, i.major, i.minor, i)
    if (o) olaylar.push(o)
    else atlanan++
  }
  return { olaylar, devam: String(s.responseStatusStrg ?? '').toUpperCase() === 'MORE' && liste.length > 0, atlanan }
}

// ── Push yetkisi ─────────────────────────────────────────────────────────────

export interface PushCihazi {
  id: string
  kod: string
  host: string
}

/**
 * Kaynak IP (nginx X-Real-IP; Next yalnız 127.0.0.1'de dinler, başlık yalnız nginx'ten gelir) aktif bir
 * Hikvision cihazının host IP'si OLMALI ve URL sırrı PDKS_PUSH_SECRET ile sabit zamanlı eşleşmeli.
 */
export function pushYetkisi(p: {
  ip: string | null
  token: string | null
  sir: string | undefined
  cihazlar: PushCihazi[]
}): { ok: true; cihaz: PushCihazi } | { ok: false; sebep: string; durum: 401 | 503 } {
  if (!p.sir || p.sir.length < 16) return { ok: false, sebep: 'PDKS_PUSH_SECRET tanımlı değil / kısa', durum: 503 }
  const ip = (p.ip ?? '').trim()
  const cihaz = p.cihazlar.find((c) => c.host.split(':')[0] === ip)
  const a = Buffer.from(p.token ?? '')
  const b = Buffer.from(p.sir)
  const sirTutar = a.length === b.length && timingSafeEqual(a, b)
  if (!cihaz) return { ok: false, sebep: `IP ${ip || '?'} bir aktif cihaz değil`, durum: 401 }
  if (!sirTutar) return { ok: false, sebep: `IP ${ip} (${cihaz.kod}) — sır tutmadı`, durum: 401 }
  return { ok: true, cihaz }
}

// ── Depo arayüzü ─────────────────────────────────────────────────────────────

export interface CihazDurumu {
  id: string
  kod: string
  seriDonem: number
  sonSeriNo: number | null
}

export interface GecisKaydi {
  dedupAnahtar: string
  cihazId: string
  seriDonem: number
  seriNo: number
  olayZamani: Date
  cihazZamaniHam: string
  major: number
  minor: number
  olayTipi: HubOlayTipi
  gecerli: boolean
  kapiNo: number | null
  okuyucuNo: number | null
  okuyucuId: string | null
  yon: 'GIRIS' | 'CIKIS' | null
  kartNo: string | null
  employeeNo: string | null
  personnelId: string | null
  kaynak: 'PUSH' | 'POLL'
  ham: Record<string, unknown>
  bagliGecisId: string | null
}

export interface BoslukUyarisi {
  cihazKod: string
  seriDonem: number
  seriBaslangic: number
  seriBitis: number
  kayipAdet: number
  zamanBaslangic: string | null
  zamanBitis: string
  tespit: string
}

export interface CihazGuncelleme {
  seriDonem?: number
  sonSeriNo?: number | null
  saatSapmaSn?: number
  saatKontrolAt?: Date
  sonPushAt?: Date
  sonPollAt?: Date
  sonGorulmeAt?: Date
}

export interface OlayDeposu {
  /** Panel cardNo → Hub kartı (AKTİF öncelikli, yoksa en son PASİF). */
  kartBul(cardNo: string): Promise<{ personnelId: string; durum: 'AKTIF' | 'PASIF'; personelAktif: boolean } | null>
  okuyucuBul(cihazId: string, doorNo: number, readerNo: number | null): Promise<{ id: string; yon: 'GIRIS' | 'CIKIS' } | null>
  /** ON CONFLICT DO NOTHING — eklenirse yeni id, tekrar ise null. */
  ekle(k: GecisKaydi): Promise<string | null>
  /** Aynı cihaz + kapıda, `once` anından en fazla pencereSn önceki son GECERLI_KART olayı. */
  sonKartOlayi(cihazId: string, kapiNo: number, once: Date, pencereSn: number): Promise<{ id: string; personnelId: string | null; yon: 'GIRIS' | 'CIKIS' | null } | null>
  /** Dönemdeki en büyük seri (ve zamanı). */
  donemMaks(cihazId: string, donem: number): Promise<{ seriNo: number; olayZamani: Date } | null>
  /** Dönemde `sonrasi`ndan büyük seriler, artan; sonrasi null → baştan. */
  donemSerileri(cihazId: string, donem: number, sonrasi: number | null, limit: number): Promise<{ seriNo: number; olayZamani: Date }[]>
  seriZamani(cihazId: string, donem: number, seriNo: number): Promise<Date | null>
  cihazGuncelle(cihazId: string, d: CihazGuncelleme): Promise<void>
  boslukUyarisiEkle(u: BoslukUyarisi): Promise<void>
}

// ── İşleme ───────────────────────────────────────────────────────────────────

export interface IslemOzeti {
  alinan: number
  eklenen: number
  tekrar: number
  gecersizZaman: number
  tipler: Partial<Record<HubOlayTipi, number>>
  sensorBagli: number
  donemSifirlandi: boolean
  saatSapmaSn: number | null
  uyarilar: string[]
}

function hubTipi(
  sinif: ReturnType<typeof cihazOlaySinifi>,
  kart: Awaited<ReturnType<OlayDeposu['kartBul']>>,
): { tip: HubOlayTipi; gecerli: boolean; personnelId: string | null } {
  if (sinif === 'KART_GECTI' || sinif === 'KART_RED') {
    if (!kart) return { tip: 'TANIMSIZ_KART', gecerli: false, personnelId: null }
    if (kart.durum !== 'AKTIF' || !kart.personelAktif) return { tip: 'PASIF_KART', gecerli: false, personnelId: kart.personnelId }
    return sinif === 'KART_GECTI'
      ? { tip: 'GECERLI_KART', gecerli: true, personnelId: kart.personnelId }
      : { tip: 'YETKISIZ', gecerli: false, personnelId: kart.personnelId }
  }
  if (sinif === 'GECIS_SENSORU') return { tip: 'GECIS_SENSORU', gecerli: false, personnelId: null }
  if (sinif === 'YANGIN_ALARMI') return { tip: 'YANGIN_ALARMI', gecerli: false, personnelId: null }
  return { tip: 'DIGER', gecerli: false, personnelId: kart?.personnelId ?? null }
}

/**
 * Olayları seri sırasıyla yazar. `cihaz` nesnesi dönem sıfırlanırsa YERİNDE güncellenir (çağıran
 * aynı nesneyle imleciIlerlet'i çağırabilsin).
 */
export async function olaylariIsle(
  depo: OlayDeposu,
  cihaz: CihazDurumu,
  olaylar: HamOlay[],
  o: { kaynak: 'PUSH' | 'POLL'; esleme: OlayEsleme; simdi?: Date },
): Promise<IslemOzeti> {
  const simdi = o.simdi ?? new Date()
  const ozet: IslemOzeti = { alinan: olaylar.length, eklenen: 0, tekrar: 0, gecersizZaman: 0, tipler: {}, sensorBagli: 0, donemSifirlandi: false, saatSapmaSn: null, uyarilar: [] }
  const sirali = [...olaylar].sort((a, b) => a.serialNo - b.serialNo)
  let maks = await depo.donemMaks(cihaz.id, cihaz.seriDonem)
  let enIleri = -Infinity

  for (const e of sirali) {
    const zaman = zamanCoz(e.zamanHam)
    if (!zaman) {
      ozet.gecersizZaman++
      ozet.uyarilar.push(`seri ${e.serialNo}: zaman çözülemedi (${e.zamanHam.slice(0, 30)}) — atlandı`)
      continue
    }

    // Seri sayacı sıfırlanması: aynı dönemde daha KÜÇÜK seri ama belirgin şekilde DAHA YENİ zaman.
    if (maks && e.serialNo < maks.seriNo && zaman.getTime() > maks.olayZamani.getTime() + DONEM_SIFIRLAMA_PAYI_SN * 1000) {
      cihaz.seriDonem += 1
      cihaz.sonSeriNo = null
      await depo.cihazGuncelle(cihaz.id, { seriDonem: cihaz.seriDonem, sonSeriNo: null })
      ozet.donemSifirlandi = true
      ozet.uyarilar.push(`${cihaz.kod}: seri sayacı sıfırlanmış (seri ${e.serialNo} < ${maks.seriNo}, zaman daha yeni) — dönem ${cihaz.seriDonem}`)
      maks = null
    }

    const sinif = cihazOlaySinifi(o.esleme, e.major, e.minor)
    const kart = e.cardNo ? await depo.kartBul(e.cardNo) : null
    const t = hubTipi(sinif, kart)

    const okuyucu = e.doorNo !== null ? await depo.okuyucuBul(cihaz.id, e.doorNo, e.cardReaderNo) : null
    let yon = okuyucu?.yon ?? null
    let personnelId = t.personnelId
    let bagliGecisId: string | null = null
    if (t.tip === 'GECIS_SENSORU' && e.doorNo !== null) {
      const bag = await depo.sonKartOlayi(cihaz.id, e.doorNo, zaman, SENSOR_BAG_PENCERE_SN)
      if (bag) {
        bagliGecisId = bag.id
        personnelId = bag.personnelId
        yon = yon ?? bag.yon
        ozet.sensorBagli++
      }
    }

    const id = await depo.ekle({
      dedupAnahtar: `${cihaz.kod}:${cihaz.seriDonem}:${e.serialNo}`,
      cihazId: cihaz.id,
      seriDonem: cihaz.seriDonem,
      seriNo: e.serialNo,
      olayZamani: zaman,
      cihazZamaniHam: e.zamanHam,
      major: e.major,
      minor: e.minor,
      olayTipi: t.tip,
      gecerli: t.gecerli,
      kapiNo: e.doorNo,
      okuyucuNo: e.cardReaderNo,
      okuyucuId: okuyucu?.id ?? null,
      yon,
      kartNo: e.cardNo,
      employeeNo: e.employeeNo,
      personnelId,
      kaynak: o.kaynak,
      ham: e.ham,
      bagliGecisId,
    })
    if (id === null) {
      ozet.tekrar++
      continue
    }
    ozet.eklenen++
    ozet.tipler[t.tip] = (ozet.tipler[t.tip] ?? 0) + 1
    if (!maks || e.serialNo > maks.seriNo) maks = { seriNo: e.serialNo, olayZamani: zaman }
    if (t.tip === 'YANGIN_ALARMI') ozet.uyarilar.push(`${cihaz.kod}: YANGIN ALARMI girişi (seri ${e.serialNo}, ${e.zamanHam})`)
    if (o.kaynak === 'PUSH') enIleri = Math.max(enIleri, (zaman.getTime() - simdi.getTime()) / 1000)
  }

  // Push olayı sunucu saatinden İLERİDE olamaz — ileride ise panel saati kaymıştır. (Geride olması
  // gecikmeli teslim olabilir; onu periyodik /ISAPI/System/time ölçümü yakalar.)
  if (o.kaynak === 'PUSH' && enIleri > SAAT_SAPMA_ESIGI_SN) {
    const sn = Math.round(enIleri)
    ozet.saatSapmaSn = sn
    await depo.cihazGuncelle(cihaz.id, { saatSapmaSn: sn, saatKontrolAt: simdi })
    ozet.uyarilar.push(`${cihaz.kod}: panel saati sunucudan ${sn} sn İLERİDE (eşik ${SAAT_SAPMA_ESIGI_SN} sn) — NTP'yi kontrol edin`)
  }
  return ozet
}

// ── İmleç ────────────────────────────────────────────────────────────────────

export interface ImlecSonucu {
  imlec: number | null
  /** İmleçten sonra, dönemin en büyük serisine kadar HENÜZ gelmemiş seri adedi (poll doldurmayı bekliyor). */
  bekleyenBosluk: number
  kayiplar: BoslukUyarisi[]
}

/**
 * sonSeriNo'yu kesintisiz ilerletir. Delikten sonraki ilk olay KAYIP_BOSLUK_SAAT'ten eskiyse delik
 * kurtarılamaz sayılır: UYARI (depo + log) yazılır ve imleç deliğin üstüne atlar.
 */
export async function imleciIlerlet(depo: OlayDeposu, cihaz: CihazDurumu, simdi = new Date()): Promise<ImlecSonucu> {
  const kayiplar: BoslukUyarisi[] = []
  let imlec = cihaz.sonSeriNo
  if (imlec === null) {
    const ilk = await depo.donemSerileri(cihaz.id, cihaz.seriDonem, null, 1)
    if (!ilk.length) return { imlec: null, bekleyenBosluk: 0, kayiplar }
    imlec = ilk[0].seriNo - 1
  }
  const esik = simdi.getTime() - KAYIP_BOSLUK_SAAT * 3600_000
  let bekleyenBosluk = 0

  for (let tur = 0; tur < 20; tur++) {
    const seriler = await depo.donemSerileri(cihaz.id, cihaz.seriDonem, imlec, 5000)
    if (!seriler.length) break
    let takildi = false
    for (let i = 0; i < seriler.length; i++) {
      const s = seriler[i]
      if (s.seriNo === imlec + 1) {
        imlec = s.seriNo
        continue
      }
      if (s.olayZamani.getTime() < esik) {
        const u: BoslukUyarisi = {
          cihazKod: cihaz.kod,
          seriDonem: cihaz.seriDonem,
          seriBaslangic: imlec + 1,
          seriBitis: s.seriNo - 1,
          kayipAdet: s.seriNo - imlec - 1,
          zamanBaslangic: (await depo.seriZamani(cihaz.id, cihaz.seriDonem, imlec))?.toISOString() ?? null,
          zamanBitis: s.olayZamani.toISOString(),
          tespit: simdi.toISOString(),
        }
        kayiplar.push(u)
        await depo.boslukUyarisiEkle(u)
        console.warn(
          `[pdks-olay] KAYIP BOŞLUK ${u.cihazKod} dönem ${u.seriDonem}: seri ${u.seriBaslangic}-${u.seriBitis} ` +
            `(${u.kayipAdet} olay, ${u.zamanBaslangic ?? '?'} → ${u.zamanBitis}) 24 saatte doldurulamadı — imleç ilerletildi`,
        )
        imlec = s.seriNo
        continue
      }
      // Taze delik — poll doldurana kadar bekle.
      const son = seriler[seriler.length - 1].seriNo
      bekleyenBosluk = son - imlec - (seriler.length - i)
      takildi = true
      break
    }
    if (takildi || seriler.length < 5000) break
  }
  if (imlec !== cihaz.sonSeriNo) {
    cihaz.sonSeriNo = imlec
    await depo.cihazGuncelle(cihaz.id, { sonSeriNo: imlec })
  }
  return { imlec, bekleyenBosluk, kayiplar }
}
