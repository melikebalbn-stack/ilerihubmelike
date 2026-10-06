// @vitest-environment node
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  imleciIlerlet,
  olaylariIsle,
  pushGovdesiCoz,
  pushYetkisi,
  zamanCoz,
  type BoslukUyarisi,
  type CihazDurumu,
  type CihazGuncelleme,
  type GecisKaydi,
  type HamOlay,
  type OlayDeposu,
} from './olay-alim'
import { VARSAYILAN_OLAY_ESLEME, olayEslemeBirlestir } from './olay-esleme'
import { toplayiciTuru, type ToplayiciCihazi } from './toplayici'

// ── Bellek içi depo (Prisma deposunun davranışını taklit eder) ───────────────

class BellekDepo implements OlayDeposu {
  gecisler: (GecisKaydi & { id: string })[] = []
  kartlar = new Map<string, { personnelId: string; durum: 'AKTIF' | 'PASIF'; personelAktif: boolean }>()
  okuyucular = new Map<string, { id: string; yon: 'GIRIS' | 'CIKIS' }>() // "kapi:okuyucu"
  cihazGuncellemeleri: CihazGuncelleme[] = []
  bosluklar: BoslukUyarisi[] = []
  private n = 0

  async kartBul(cardNo: string) {
    return this.kartlar.get(cardNo) ?? null
  }
  async okuyucuBul(_c: string, doorNo: number, readerNo: number | null) {
    return this.okuyucular.get(`${doorNo}:${readerNo}`) ?? null
  }
  async ekle(k: GecisKaydi) {
    if (this.gecisler.some((g) => g.dedupAnahtar === k.dedupAnahtar)) return null
    const id = `g${++this.n}`
    this.gecisler.push({ ...k, id })
    return id
  }
  async sonKartOlayi(cihazId: string, kapiNo: number, once: Date, pencereSn: number) {
    const g = this.gecisler
      .filter((x) => x.cihazId === cihazId && x.kapiNo === kapiNo && x.olayTipi === 'GECERLI_KART' &&
        x.olayZamani <= once && x.olayZamani.getTime() >= once.getTime() - pencereSn * 1000)
      .sort((a, b) => b.olayZamani.getTime() - a.olayZamani.getTime())[0]
    return g ? { id: g.id, personnelId: g.personnelId, yon: g.yon } : null
  }
  private donem(cihazId: string, d: number) {
    return this.gecisler.filter((g) => g.cihazId === cihazId && g.seriDonem === d).sort((a, b) => a.seriNo - b.seriNo)
  }
  async donemMaks(cihazId: string, d: number) {
    const s = this.donem(cihazId, d).at(-1)
    return s ? { seriNo: s.seriNo, olayZamani: s.olayZamani } : null
  }
  async donemSerileri(cihazId: string, d: number, sonrasi: number | null, limit: number) {
    return this.donem(cihazId, d).filter((g) => sonrasi === null || g.seriNo > sonrasi).slice(0, limit)
      .map((g) => ({ seriNo: g.seriNo, olayZamani: g.olayZamani }))
  }
  async seriZamani(cihazId: string, d: number, seriNo: number) {
    return this.donem(cihazId, d).find((g) => g.seriNo === seriNo)?.olayZamani ?? null
  }
  async cihazGuncelle(_id: string, d: CihazGuncelleme) {
    this.cihazGuncellemeleri.push(d)
  }
  async boslukUyarisiEkle(u: BoslukUyarisi) {
    this.bosluklar.push(u)
  }
  tip(seri: number) {
    return this.gecisler.find((g) => g.seriNo === seri)
  }
}

const SIMDI = new Date('2026-09-27T08:00:00+03:00')
const iso = (d: Date) => new Date(d.getTime() + 3 * 3600_000).toISOString().slice(0, 19) + '+03:00'
const sn = (s: number) => new Date(SIMDI.getTime() + s * 1000)
const olay = (serialNo: number, t: Date, major: number, minor: number, ek: Partial<HamOlay> = {}): HamOlay => ({
  serialNo, zamanHam: iso(t), major, minor, cardNo: null, employeeNo: null, doorNo: 1, cardReaderNo: 1, ham: {}, ...ek,
})
const E = VARSAYILAN_OLAY_ESLEME

let depo: BellekDepo
let cihaz: CihazDurumu
beforeEach(() => {
  depo = new BellekDepo()
  depo.kartlar.set('11863577', { personnelId: 'p-aktif', durum: 'AKTIF', personelAktif: true })
  depo.kartlar.set('11800001', { personnelId: 'p-eski', durum: 'PASIF', personelAktif: true })
  depo.kartlar.set('11800002', { personnelId: 'p-ayrildi', durum: 'AKTIF', personelAktif: false })
  depo.okuyucular.set('1:1', { id: 'o1', yon: 'GIRIS' })
  depo.okuyucular.set('2:2', { id: 'o2', yon: 'CIKIS' })
  cihaz = { id: 'c1', kod: 'HIK-ANA-1', seriDonem: 1, sonSeriNo: null }
})

// ── Ayrıştırma + yetki ───────────────────────────────────────────────────────

describe('push gövdesi ve yetki', () => {
  it('EventNotificationAlert JSON → olay; heartBeat nabız; bozuk parça atlanır', () => {
    const r = pushGovdesiCoz([
      JSON.stringify({
        ipAddress: '10.0.50.10', dateTime: '2026-09-27T07:59:58+03:00', eventType: 'AccessControllerEvent',
        AccessControllerEvent: { majorEventType: 5, subEventType: 1, cardNo: '11863577', employeeNoString: 'ILR-00001', doorNo: 1, cardReaderNo: 1, serialNo: 101 },
      }),
      JSON.stringify({ eventType: 'heartBeat', dateTime: '2026-09-27T08:00:00+03:00' }),
      'bozuk{',
      JSON.stringify({ eventType: 'AccessControllerEvent', AccessControllerEvent: { majorEventType: 5 } }), // serialNo yok
    ])
    expect(r.nabiz).toBe(true)
    expect(r.atlanan).toBe(2)
    expect(r.olaylar).toHaveLength(1)
    expect(r.olaylar[0]).toMatchObject({ serialNo: 101, major: 5, minor: 1, cardNo: '11863577', employeeNo: 'ILR-00001', doorNo: 1, cardReaderNo: 1 })
  })

  it('zamanCoz: ofsetsiz zaman İstanbul (+03:00) kabul edilir', () => {
    expect(zamanCoz('2026-09-27T08:00:00')?.toISOString()).toBe('2026-09-27T05:00:00.000Z')
    expect(zamanCoz('2026-09-27T08:00:00Z')?.toISOString()).toBe('2026-09-27T08:00:00.000Z')
    expect(zamanCoz('dün')).toBeNull()
  })

  it('pushYetkisi: sır yok 503; yabancı IP 401; yanlış sır 401; doğru IP + sır OK', () => {
    const cihazlar = [{ id: 'c1', kod: 'HIK-ANA-1', host: '10.0.50.10:80' }]
    const sir = 'x'.repeat(32)
    expect(pushYetkisi({ ip: '10.0.50.10', token: sir, sir: undefined, cihazlar })).toMatchObject({ ok: false, durum: 503 })
    expect(pushYetkisi({ ip: '10.0.50.99', token: sir, sir, cihazlar })).toMatchObject({ ok: false, durum: 401 })
    expect(pushYetkisi({ ip: '10.0.50.10', token: 'yanlis', sir, cihazlar })).toMatchObject({ ok: false, durum: 401 })
    expect(pushYetkisi({ ip: null, token: sir, sir, cihazlar })).toMatchObject({ ok: false, durum: 401 })
    expect(pushYetkisi({ ip: '10.0.50.10', token: sir, sir, cihazlar })).toMatchObject({ ok: true, cihaz: { kod: 'HIK-ANA-1' } })
  })

  it('olay eşlemesi SystemSetting ile genişler, bozuk girdi atlanır', () => {
    const r = olayEslemeBirlestir(JSON.stringify({ '5:75': 'KART_GECTI', '5:1': 'DIGER', 'x': 'KART_GECTI', '5:9': 'UYDURMA' }))
    expect(r.esleme['5:75']).toBe('KART_GECTI')
    expect(r.esleme['5:1']).toBe('DIGER')
    expect(r.esleme['5:9']).toBe('KART_RED') // bozuk sınıf → varsayılan kalır
    expect(r.uyarilar).toHaveLength(2)
    expect(olayEslemeBirlestir('{bozuk').uyarilar).toHaveLength(1)
  })
})

// ── Sınıflandırma, dedup, sensör, sapma ──────────────────────────────────────

describe('olaylariIsle', () => {
  it('geçerli / tanımsız / pasif kart / pasif personel / yetkisiz — Hub durumuna göre', async () => {
    const r = await olaylariIsle(depo, cihaz, [
      olay(1, sn(-50), 5, 1, { cardNo: '11863577' }), // aktif kart, geçti
      olay(2, sn(-40), 5, 9, { cardNo: '99999999' }), // Hub'da yok
      olay(3, sn(-30), 5, 1, { cardNo: '11800001' }), // Hub'da PASİF kart (panel yine de açtı)
      olay(4, sn(-20), 5, 1, { cardNo: '11800002', doorNo: 2, cardReaderNo: 2 }), // aktif kart, pasif personel
      olay(5, sn(-10), 5, 6, { cardNo: '11863577' }), // aktif kart, panel reddetti
    ], { kaynak: 'POLL', esleme: E, simdi: SIMDI })
    expect(r.eklenen).toBe(5)
    expect(depo.tip(1)).toMatchObject({ olayTipi: 'GECERLI_KART', gecerli: true, personnelId: 'p-aktif', yon: 'GIRIS', okuyucuId: 'o1' })
    expect(depo.tip(2)).toMatchObject({ olayTipi: 'TANIMSIZ_KART', gecerli: false, personnelId: null, kartNo: '99999999' })
    expect(depo.tip(3)).toMatchObject({ olayTipi: 'PASIF_KART', gecerli: false, personnelId: 'p-eski' })
    expect(depo.tip(4)).toMatchObject({ olayTipi: 'PASIF_KART', gecerli: false, personnelId: 'p-ayrildi', yon: 'CIKIS' })
    expect(depo.tip(5)).toMatchObject({ olayTipi: 'YETKISIZ', gecerli: false, personnelId: 'p-aktif' })
    expect(depo.tip(1)!.dedupAnahtar).toBe('HIK-ANA-1:1:1')
  })

  it('dedup: push ve poll aynı olayı getirirse ikincisi tekrar sayılır, satır tek kalır', async () => {
    const e = olay(7, sn(-5), 5, 1, { cardNo: '11863577' })
    await olaylariIsle(depo, cihaz, [e], { kaynak: 'PUSH', esleme: E, simdi: SIMDI })
    const r = await olaylariIsle(depo, cihaz, [e], { kaynak: 'POLL', esleme: E, simdi: SIMDI })
    expect(r).toMatchObject({ eklenen: 0, tekrar: 1 })
    expect(depo.gecisler).toHaveLength(1)
    expect(depo.gecisler[0].kaynak).toBe('PUSH')
  })

  it('"geçti" sensörü aynı kapıdaki son 10 sn içindeki kart olayına bağlanır, dışındakine bağlanmaz', async () => {
    const r = await olaylariIsle(depo, cihaz, [
      olay(10, sn(-60), 5, 1, { cardNo: '11863577' }),
      olay(11, sn(-57), 5, 21, { cardReaderNo: null }), // 3 sn sonra → bağlanır
      olay(12, sn(-30), 5, 21, { cardReaderNo: null }), // 30 sn sonra → bağlanmaz
      olay(13, sn(-58), 5, 21, { doorNo: 2, cardReaderNo: null }), // başka kapı → bağlanmaz
    ], { kaynak: 'POLL', esleme: E, simdi: SIMDI })
    expect(r.sensorBagli).toBe(1)
    const kartOlayi = depo.tip(10)!
    expect(depo.tip(11)).toMatchObject({ olayTipi: 'GECIS_SENSORU', bagliGecisId: kartOlayi.id, personnelId: 'p-aktif', yon: 'GIRIS' })
    expect(depo.tip(12)).toMatchObject({ olayTipi: 'GECIS_SENSORU', bagliGecisId: null, personnelId: null })
    expect(depo.tip(13)).toMatchObject({ bagliGecisId: null })
  })

  it('panel saati İLERİDE (push, > 60 sn) → saatSapmaSn + uyarı; eşik altı ve poll → uyarı yok', async () => {
    const ileri = await olaylariIsle(depo, cihaz, [olay(20, sn(95), 5, 1, { cardNo: '11863577' })], { kaynak: 'PUSH', esleme: E, simdi: SIMDI })
    expect(ileri.saatSapmaSn).toBe(95)
    expect(ileri.uyarilar.join()).toMatch(/İLERİDE/)
    expect(depo.cihazGuncellemeleri).toContainEqual({ saatSapmaSn: 95, saatKontrolAt: SIMDI })

    const az = await olaylariIsle(depo, cihaz, [olay(21, sn(30), 5, 1, { cardNo: '11863577' })], { kaynak: 'PUSH', esleme: E, simdi: SIMDI })
    expect(az.saatSapmaSn).toBeNull()
    const poll = await olaylariIsle(depo, cihaz, [olay(22, sn(500), 5, 1, { cardNo: '11863577' })], { kaynak: 'POLL', esleme: E, simdi: SIMDI })
    expect(poll.saatSapmaSn).toBeNull()
  })

  it('yangın girişi YANGIN_ALARMI + uyarı; bilinmeyen kod DIGER olarak saklanır', async () => {
    const r = await olaylariIsle(depo, cihaz, [olay(30, sn(-5), 1, 1034), olay(31, sn(-4), 3, 112)], { kaynak: 'PUSH', esleme: E, simdi: SIMDI })
    expect(depo.tip(30)!.olayTipi).toBe('YANGIN_ALARMI')
    expect(depo.tip(31)).toMatchObject({ olayTipi: 'DIGER', major: 3, minor: 112 })
    expect(r.uyarilar.join()).toMatch(/YANGIN/)
  })

  it('seri sayacı sıfırlanırsa (küçük seri + daha yeni zaman) dönem artar, eski olaylar ezilmez', async () => {
    await olaylariIsle(depo, cihaz, [olay(500, sn(-3600), 5, 1, { cardNo: '11863577' })], { kaynak: 'POLL', esleme: E, simdi: SIMDI })
    const r = await olaylariIsle(depo, cihaz, [olay(1, sn(-10), 5, 1, { cardNo: '11863577' })], { kaynak: 'PUSH', esleme: E, simdi: SIMDI })
    expect(r.donemSifirlandi).toBe(true)
    expect(cihaz.seriDonem).toBe(2)
    expect(depo.gecisler.map((g) => g.dedupAnahtar)).toEqual(['HIK-ANA-1:1:500', 'HIK-ANA-1:2:1'])
    // eski (daha eski zamanlı) küçük seri — sıfırlama SAYILMAZ (poll örtüşmesi)
    const c2: CihazDurumu = { id: 'c1', kod: 'HIK-ANA-1', seriDonem: 1, sonSeriNo: null }
    const d2 = new BellekDepo()
    await olaylariIsle(d2, c2, [olay(500, sn(-10), 5, 1)], { kaynak: 'POLL', esleme: E, simdi: SIMDI })
    const r2 = await olaylariIsle(d2, c2, [olay(499, sn(-20), 5, 1)], { kaynak: 'POLL', esleme: E, simdi: SIMDI })
    expect(r2.donemSifirlandi).toBe(false)
  })
})

// ── İmleç ve 24 saat boşluk uyarısı ──────────────────────────────────────────

describe('imleciIlerlet', () => {
  it('kesintisiz serilerde ilerler; taze delikte durur ve bekleyen boşluğu sayar', async () => {
    await olaylariIsle(depo, cihaz, [1, 2, 3, 6, 7].map((s) => olay(s, sn(-600 + s), 5, 1)), { kaynak: 'POLL', esleme: E, simdi: SIMDI })
    const r = await imleciIlerlet(depo, cihaz, SIMDI)
    expect(r).toMatchObject({ imlec: 3, bekleyenBosluk: 2, kayiplar: [] })
    expect(cihaz.sonSeriNo).toBe(3)
    // poll deliği doldurunca imleç sona kadar gider
    await olaylariIsle(depo, cihaz, [olay(4, sn(-596), 5, 1), olay(5, sn(-595), 5, 1)], { kaynak: 'POLL', esleme: E, simdi: SIMDI })
    expect(await imleciIlerlet(depo, cihaz, SIMDI)).toMatchObject({ imlec: 7, bekleyenBosluk: 0 })
  })

  it('24 saatten eski delik KAYIP: uyarı (aralık + adet) depoya ve log\'a yazılır, imleç atlar', async () => {
    const uyar = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const saat = 3600
    await olaylariIsle(depo, cihaz, [
      olay(100, sn(-30 * saat), 5, 1),
      olay(101, sn(-30 * saat + 5), 5, 1),
      olay(140, sn(-26 * saat), 5, 1), // 102-139 hiç gelmedi, 26 saat önce
      olay(141, sn(-60), 5, 1),
      olay(150, sn(-30), 5, 1), // 142-149 taze delik → beklenir
    ], { kaynak: 'POLL', esleme: E, simdi: SIMDI })
    const r = await imleciIlerlet(depo, cihaz, SIMDI)
    expect(r.imlec).toBe(141)
    expect(r.bekleyenBosluk).toBe(8)
    expect(r.kayiplar).toHaveLength(1)
    expect(r.kayiplar[0]).toMatchObject({
      cihazKod: 'HIK-ANA-1', seriBaslangic: 102, seriBitis: 139, kayipAdet: 38,
      zamanBaslangic: sn(-30 * saat + 5).toISOString(), zamanBitis: sn(-26 * saat).toISOString(),
    })
    expect(depo.bosluklar).toEqual(r.kayiplar)
    expect(uyar.mock.calls.flat().join()).toMatch(/KAYIP BOŞLUK HIK-ANA-1 dönem 1: seri 102-139 \(38 olay/)
    uyar.mockRestore()
  })
})

// ── Toplayıcı turu: sahte DS-K2604T (AcsEvent + System/time) ─────────────────

describe('toplayiciTuru (sahte panel)', () => {
  const panelOlaylari: Record<string, unknown>[] = []
  let panelSaatiIleriSn = 0
  let sonKosul: Record<string, unknown> | null = null
  const sunucu = http.createServer((req, res) => {
    if (!(req.headers.authorization ?? '').startsWith('Digest ')) {
      res.writeHead(401, { 'WWW-Authenticate': 'Digest qop="auth", realm="DS-K2604T", nonce="n1"' })
      return res.end()
    }
    let govde = ''
    req.on('data', (c) => (govde += c))
    req.on('end', () => {
      if (req.url?.startsWith('/ISAPI/System/time')) {
        res.writeHead(200, { 'Content-Type': 'application/xml' })
        return res.end(`<Time><timeMode>NTP</timeMode><localTime>${iso(new Date(Date.now() + panelSaatiIleriSn * 1000))}</localTime></Time>`)
      }
      if (req.url?.startsWith('/ISAPI/AccessControl/AcsEvent')) {
        const k = JSON.parse(govde).AcsEventCond
        sonKosul = k
        const dilim = panelOlaylari.slice(k.searchResultPosition, k.searchResultPosition + k.maxResults)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({
          AcsEvent: {
            searchID: k.searchID, totalMatches: panelOlaylari.length, numOfMatches: dilim.length,
            responseStatusStrg: k.searchResultPosition + k.maxResults < panelOlaylari.length ? 'MORE' : 'OK',
            InfoList: dilim,
          },
        }))
      }
      res.writeHead(404)
      res.end()
    })
  })
  let tc: ToplayiciCihazi
  beforeAll(async () => {
    process.env.PDKS_CIHAZ_TOPLA_USER = 'hub'
    process.env.PDKS_CIHAZ_TOPLA_PASS = 'p'
    await new Promise<void>((r) => sunucu.listen(0, '127.0.0.1', r))
  })
  afterAll(() => new Promise<void>((r) => sunucu.close(() => r())))
  beforeEach(() => {
    panelOlaylari.length = 0
    panelSaatiIleriSn = 0
    tc = { ...cihaz, host: `127.0.0.1:${(sunucu.address() as AddressInfo).port}`, envOnek: 'PDKS_CIHAZ_TOPLA', saatKontrolAt: null }
  })

  it('push\'un kaçırdığı olayları sayfalı AcsEvent ile doldurur, imleci ilerletir, saati ölçer', async () => {
    const simdi = new Date()
    // Push yalnız 1, 2 ve 65'i getirmiş…
    const t = (s: number) => new Date(simdi.getTime() - (70 - s) * 1000)
    await olaylariIsle(depo, tc, [1, 2, 65].map((s) => olay(s, t(s), 5, 1, { cardNo: '11863577' })), { kaynak: 'PUSH', esleme: E, simdi })
    expect((await imleciIlerlet(depo, tc, simdi)).imlec).toBe(2)
    // …panel günlüğünde 1-65 hepsi var (maxResults 5 → 13 sayfa).
    for (let s = 1; s <= 65; s++) {
      panelOlaylari.push({ major: 5, minor: 1, time: iso(t(s)), cardNo: '11863577', doorNo: 1, cardReaderNo: 1, serialNo: s })
    }
    panelSaatiIleriSn = 120

    const oz = await toplayiciTuru(depo, tc, E, simdi)
    expect(oz.sayfa).toBe(13)
    expect(oz.pencereTamam).toBe(true)
    expect(oz.islem).toMatchObject({ alinan: 65, eklenen: 62, tekrar: 3 })
    expect(oz.imlec).toMatchObject({ imlec: 65, bekleyenBosluk: 0 })
    expect(depo.gecisler.filter((g) => g.kaynak === 'POLL')).toHaveLength(62)
    // pencere imlecin (seri 2) zamanından 10 dk önce başlar
    expect(Date.parse(String(sonKosul!.startTime))).toBe(t(2).getTime() - 10 * 60_000 - (t(2).getTime() % 1000))
    // saat ölçüldü, 120 sn sapma → uyarı
    expect(Math.abs(oz.saatSapmaSn! - 120)).toBeLessThanOrEqual(2)
    expect(oz.uyarilar.join()).toMatch(/saati sapması/)
    expect(depo.cihazGuncellemeleri.some((d) => d.sonPollAt)).toBe(true)
  })

  it('saat 10 dk içinde ölçüldüyse tekrar ölçülmez; boş panelde tur sorunsuz biter', async () => {
    tc.saatKontrolAt = new Date(Date.now() - 60_000)
    const oz = await toplayiciTuru(depo, tc, E)
    expect(oz.saatSapmaSn).toBeNull()
    expect(oz.islem.alinan).toBe(0)
    expect(oz.imlec.imlec).toBeNull()
  })
})
