/**
 * IPRO PLC Poller — BAĞIMSIZ Node process (Next.js request lifecycle DIŞINDA).
 * Blue-green swap web'i restart eder; poller ayrı yaşar, sayaç deltası kaybolmaz.
 *
 * Ne yapar:  IproPlcPin'den aktif pinleri okur → her PLC'ye kalıcı bağlanır →
 *            5 sn'de bir iki blok (sayaç + duruş) okur → tezgah bazında delta/toplama
 *            + duruş geçişi hesaplar → bellekte tutar → /health + /status ile sunar.
 * Ne YAPMAZ: DB'ye YAZMAZ (IproProductionLog/Downtime yok — üretim henüz iş emrine bağlı değil).
 *
 * PLC gerçekleri (canlı doğrulandı): S7comm port 102, veri M alanında,
 * sayaç DWORD big-endian, duruş = ilgili byte'ın 0. biti.
 *
 * Çalıştırma: npx tsx scripts/ipro/plc-poller/index.ts   (veya PM2 — bkz ecosystem.config.cjs)
 */
import 'dotenv/config'
import http from 'http'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../../../src/generated/prisma'
import { PlcConnection } from './plc'
import { sayacIsle, blokGecersizMi, durusGecis, aggregateTezgah, taze, type PinOzet } from './hesap'

// ── config (env'den; hardcode yok) ──
const POLL_INTERVAL_MS = Number(process.env.IPRO_POLLER_INTERVAL_MS ?? 5_000)
const HTTP_PORT = Number(process.env.IPRO_POLLER_PORT ?? 3_020)
const DEBUG = process.env.IPRO_POLLER_DEBUG === '1'
/**
 * Bayatlık eşiği (ms). Bir tezgahın son okuması bundan eskiyse `/status`'te YER ALMAZ
 * → is-basla 503 döner → iş açılmaz (fail-safe).
 * Varsayılan 20000: döngü 5 sn + okuma timeout 4 sn ≈ kaçan tur 9 sn; 20 sn İKİ kaçan
 * turu tolere eder, gereksiz 503 üretmez.
 */
const BAYATLIK_MS = Number(process.env.IPRO_POLLER_BAYATLIK_MS ?? 20_000)
/**
 * Yalnız belirtilen PLC(ler) ile çalış — virgülle ayrılmış kod listesi (ör. "PANO-3").
 * Aşamalı açılım (önce PANO-3, sonra 3 PLC) ve saha debug'ı için. Boşsa TÜM aktif PLC'ler.
 * Prod veriye DOKUNULMAZ (IproPlc.aktif=false yapmak YASAK) — filtre yalnız bellekte.
 */
const ONLY_PLC = (process.env.IPRO_POLLER_ONLY_PLC ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

// ── log (token/secret ASLA loglanmaz) ──
const now = () => new Date().toISOString()
const log = (m: string) => console.log(`[${now()}] ${m}`)
const dbg = (m: string) => { if (DEBUG) console.log(`[${now()}] [debug] ${m}`) }

// ── prisma (yalnız OKUMA) ──
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

// ── bellek durumu ──
interface PinState {
  kod: number
  sayacAdresi: number
  durusAdresi: number
  tezgahKod: string | null
  prevSayac?: number
  curSayac: number
  lastDelta: number
  durusBit: boolean
  /** Bir önceki turun duruş biti — geçiş tespiti için (ilk turda undefined). */
  prevDurusBit?: boolean
}
interface PlcGroup {
  conn: PlcConnection
  pins: PinState[]
  sayacStart: number
  sayacSize: number
  durusStart: number
  durusSize: number
  // ── Telemetri (/health) + hayalet üretim savunması ──
  /** Toplam başarısız/geçersiz okuma (TCP hatası + blok-geneli sıfır). */
  okumaHatasiToplam: number
  sonHataZamani: string | null
  /** İlk bağlantıdan SONRAKİ yeniden bağlanma sayısı. */
  yenidenBaglanmaSayisi: number
  /** Katman 1'in kaç kez devreye girdiği. */
  baselineTazelemeSayisi: number
  /** Katman 1 bayrağı: bir sonraki başarılı okuma delta üretmesin. */
  baselineTazeleGerek: boolean
  /** İlk bağlantı yapıldı mı (ilk connect'i "yeniden bağlanma" saymamak için). */
  ilkBaglantiYapildi: boolean
}
interface TezgahState {
  tezgahKod: string
  ad: string
  sayacToplam: number // anlık ham sayaç toplamı (tüm pinler)
  sonDelta: number // bu turdaki delta toplamı
  uretimBirikim: number // poller başından beri delta toplamı
  durusta: boolean
  sonOkuma: string | null
}

const plcGroups: PlcGroup[] = []
const tezgahState = new Map<string, TezgahState>()
let sonGlobalOkuma: string | null = null
let stopping = false

async function loadPins() {
  const pins = await prisma.iproPlcPin.findMany({
    where: {
      aktif: true,
      // ONLY_PLC doluysa yalnız o PLC'ler — DB'ye YAZMADAN (aktif=false yapmadan) filtre.
      plc: { aktif: true, ...(ONLY_PLC.length ? { kod: { in: ONLY_PLC } } : {}) },
    },
    include: { plc: true, tezgah: { select: { kod: true, ad: true } } },
  })
  if (ONLY_PLC.length) log(`⚙️ IPRO_POLLER_ONLY_PLC=${ONLY_PLC.join(',')} — yalnız bu PLC'ler okunacak`)
  const byPlc = new Map<string, typeof pins>()
  for (const p of pins) {
    const arr = byPlc.get(p.plcId) ?? []
    arr.push(p)
    byPlc.set(p.plcId, arr)
  }
  for (const group of byPlc.values()) {
    const plc = group[0].plc
    const pinStates: PinState[] = group.map((p) => ({
      kod: p.kod,
      sayacAdresi: p.sayacAdresi,
      durusAdresi: p.durusAdresi,
      tezgahKod: p.tezgah?.kod ?? null,
      curSayac: 0,
      lastDelta: 0,
      durusBit: false,
    }))
    const sAddrs = pinStates.map((p) => p.sayacAdresi)
    const dAddrs = pinStates.map((p) => p.durusAdresi)
    const sayacStart = Math.min(...sAddrs)
    const durusStart = Math.min(...dAddrs)
    plcGroups.push({
      conn: new PlcConnection(plc.kod, plc.ip, plc.rack, plc.slot, log),
      pins: pinStates,
      sayacStart,
      sayacSize: Math.max(...sAddrs) + 4 - sayacStart,
      durusStart,
      durusSize: Math.max(...dAddrs) + 1 - durusStart,
      okumaHatasiToplam: 0,
      sonHataZamani: null,
      yenidenBaglanmaSayisi: 0,
      baselineTazelemeSayisi: 0,
      baselineTazeleGerek: false,
      ilkBaglantiYapildi: false,
    })
    for (const p of group) {
      if (p.tezgah && !tezgahState.has(p.tezgah.kod)) {
        tezgahState.set(p.tezgah.kod, {
          tezgahKod: p.tezgah.kod,
          ad: p.tezgah.ad,
          sayacToplam: 0,
          sonDelta: 0,
          uretimBirikim: 0,
          durusta: false,
          sonOkuma: null,
        })
      }
    }
  }
  log(`${pins.length} aktif pin · ${plcGroups.length} PLC · ${tezgahState.size} tezgah yüklendi`)
}

async function pollPlc(g: PlcGroup) {
  const oncedenBagli = g.conn.connected
  if (!(await g.conn.ensureConnected())) return
  // KATMAN 1 — yeniden bağlanma: ilk başarılı okuma delta ÜRETMEMELİ.
  if (!oncedenBagli) {
    if (g.ilkBaglantiYapildi) {
      g.yenidenBaglanmaSayisi++
      g.baselineTazeleGerek = true
      log(`↻ ${g.conn.kod} yeniden bağlandı — baseline tazelenecek (delta üretilmeyecek)`)
    }
    g.ilkBaglantiYapildi = true
  }

  let sayacBuf: Buffer
  let durusBuf: Buffer
  try {
    // iki blok okuma (pin pin DEĞİL): sayaç bloğu + duruş bloğu
    sayacBuf = await g.conn.readMerker(g.sayacStart, g.sayacSize)
    durusBuf = await g.conn.readMerker(g.durusStart, g.durusSize)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    log(`⛔ ${g.conn.kod} okuma hatası: ${msg}`)
    g.conn.onReadError(msg)
    // KATMAN 1 — hatadan sonraki ilk başarılı okuma delta üretmemeli.
    g.okumaHatasiToplam++
    g.sonHataZamani = now()
    g.baselineTazeleGerek = true
    return
  }
  g.conn.markRead()

  // Tüm pinlerin ham değerlerini önce çöz — KATMAN 2 blok kararı bunu gerektirir.
  const okumalar = g.pins.map((pin) => ({
    pin,
    prev: pin.prevSayac,
    cur: sayacBuf.readUInt32BE(pin.sayacAdresi - g.sayacStart), // DWORD BE
  }))

  // KATMAN 2 — blok-geneli sıfır: önceden dolu TÜM sayaçlar aynı turda 0 ise okuma geçersiz.
  const blokGecersiz = blokGecersizMi(okumalar)
  if (blokGecersiz) {
    g.okumaHatasiToplam++
    g.sonHataZamani = now()
    log(
      `🚫 ${g.conn.kod} BLOK-GENELİ SIFIR — okuma GEÇERSİZ sayıldı (yarı-kopuk bağlantı imzası), ` +
        `prevSayac korundu, delta üretilmedi`,
    )
  }

  // KATMAN 1 bayrağı bu turda tüketiliyor mu (geçersiz okumada TÜKETİLMEZ).
  const baselineTazele = g.baselineTazeleGerek && !blokGecersiz
  if (baselineTazele) {
    g.baselineTazelemeSayisi++
    log(`↺ ${g.conn.kod} baseline tazelendi — bu tur delta üretilmedi (hata/reconnect sonrası)`)
  }

  for (const { pin, prev, cur } of okumalar) {
    const durus = (durusBuf.readUInt8(pin.durusAdresi - g.durusStart) & 0x01) === 1

    // ── SAYAÇ ── (saf karar: hesap.ts sayacIsle — üç katman orada birleşir)
    const { delta, yeniPrev, olay } = sayacIsle({ prev, cur, baselineTazele, blokGecersiz })
    if (olay === 'reset-kabul') log(`ℹ️ ${g.conn.kod} pin ${pin.kod} gerçek RESET (${prev} → ${cur}), delta=${delta}`)
    else if (olay === 'sifir-suphesi') log(`⚠️ ${g.conn.kod} pin ${pin.kod} SIFIR ŞÜPHESİ (${prev} → 0) — prevSayac korundu`)
    pin.prevSayac = yeniPrev
    // curSayac = son GÜVENİLİR değer. Geçersiz/şüpheli okumada ham `cur` (0) YAZILMAZ —
    // yoksa /status sayacToplam=0 sunar ve is-basla sıfır baseline alırdı (asıl kusur buydu).
    pin.curSayac = yeniPrev ?? 0
    pin.lastDelta = delta

    // ── DURUŞ GEÇİŞİ ── (ilk turda geçiş üretilmez)
    const gecis = durusGecis(pin.prevDurusBit, durus)
    if (gecis === 'basladi') log(`🔴 ${g.conn.kod} pin ${pin.kod} DURUŞ BAŞLADI`)
    else if (gecis === 'bitti') log(`🟢 ${g.conn.kod} pin ${pin.kod} DURUŞ BİTTİ`)
    pin.prevDurusBit = durus
    pin.durusBit = durus
  }

  // Katman 1 bayrağı yalnız GEÇERLİ bir okumada tüketilir; geçersiz okumada
  // bir sonraki tura devreder (aksi hâlde tazeleme boşa gider ve hayalet döner).
  if (baselineTazele) g.baselineTazeleGerek = false
}

function aggregate() {
  // Pin özetlerini topla + her tezgahın son okuma zamanını (kendi PLC'sinden) izle.
  const pinOzetler: PinOzet[] = []
  const okumaByTezgah = new Map<string, string>()
  for (const g of plcGroups) {
    const okuma = g.conn.lastReadAt ? new Date(g.conn.lastReadAt).toISOString() : null
    for (const pin of g.pins) {
      pinOzetler.push({
        tezgahKod: pin.tezgahKod,
        curSayac: pin.curSayac,
        lastDelta: pin.lastDelta,
        durusBit: pin.durusBit,
      })
      if (pin.tezgahKod && okuma) okumaByTezgah.set(pin.tezgahKod, okuma)
    }
  }

  // Saf toplama (hesap.ts) — bir tezgahın üretimi = TÜM pinlerinin deltaları toplamı.
  const toplam = aggregateTezgah(pinOzetler)
  for (const t of tezgahState.values()) {
    const x = toplam.get(t.tezgahKod)
    t.sayacToplam = x?.sayacToplam ?? 0
    t.sonDelta = x?.sonDelta ?? 0
    t.durusta = x?.durusta ?? false
    const okuma = okumaByTezgah.get(t.tezgahKod)
    if (okuma) t.sonOkuma = okuma
    t.uretimBirikim += t.sonDelta
  }
}

async function tick() {
  for (const g of plcGroups) for (const p of g.pins) p.lastDelta = 0 // okunmayan PLC deltayı tekrar saymasın
  await Promise.allSettled(plcGroups.map((g) => pollPlc(g))) // izole: biri düşse diğerleri devam
  aggregate()
  sonGlobalOkuma = now()
  const moved = [...tezgahState.values()].filter((t) => t.sonDelta > 0)
  if (moved.length) dbg(`Δ>0: ${moved.map((t) => `${t.tezgahKod}+${t.sonDelta}`).join(', ')}`)
}

function loop() {
  if (stopping) return
  tick()
    .catch((e) => log(`tick hata: ${e instanceof Error ? e.message : e}`))
    .finally(() => {
      if (!stopping) setTimeout(loop, POLL_INTERVAL_MS)
    })
}

// ── HTTP: /health + /status (iç ağ, auth yok) ──
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  const simdi = Date.now()
  if (req.url === '/health') {
    // /health HER ZAMAN ayakta — PLC hiç bağlanamasa bile teşhis uç noktası lazım.
    const tazeSayi = [...tezgahState.values()].filter((t) => taze(t.sonOkuma, simdi, BAYATLIK_MS)).length
    res.end(
      JSON.stringify(
        {
          ok: true,
          sonOkuma: sonGlobalOkuma,
          pollIntervalMs: POLL_INTERVAL_MS,
          bayatlikMs: BAYATLIK_MS,
          tezgah: { taze: tazeSayi, bayat: tezgahState.size - tazeSayi, toplam: tezgahState.size },
          plclar: plcGroups.map((g) => {
            const s = g.conn.status()
            return {
              ...s,
              sonOkumaYasiMs: s.lastReadAt ? simdi - Date.parse(s.lastReadAt) : null,
              // İzleme: "tek seferlik ağ olayı mı, bu PLC'ye özgü mü" sorusu logda
              // arama yapmadan cevaplanabilsin (22.07 hayalet üretim olayının dersi).
              okumaHatasiToplam: g.okumaHatasiToplam,
              sonHataZamani: g.sonHataZamani,
              yenidenBaglanmaSayisi: g.yenidenBaglanmaSayisi,
              baselineTazelemeSayisi: g.baselineTazelemeSayisi,
            }
          }),
        },
        null,
        2,
      ),
    )
  } else if (req.url === '/status') {
    // SÖZLEŞME: is-basla bu şekli okuyor ({tezgahKod, sayacToplam, ...}) — ŞEKİL DEĞİŞMEZ.
    // DEĞİŞEN: yalnız TAZE okumadan gelen tezgahlar listeye girer. Veri yoksa (soğuk
    // açılış) veya bayatsa (PLC koptu) tezgah listede YER ALMAZ → is-basla 503 → iş
    // açılmaz. Fail-safe: yanlış/bayat baseline ile prod kaydı oluşmaz.
    const list = [...tezgahState.values()]
      .filter((t) => taze(t.sonOkuma, simdi, BAYATLIK_MS))
      .sort((a, b) => a.tezgahKod.localeCompare(b.tezgahKod, 'tr'))
    res.end(JSON.stringify(list, null, 2))
  } else if (req.url === '/pins') {
    // Pin bazlı son-okuma snapshot'ı — sinyal takibi ekranı (Melike #14) için.
    // FİLTRELENMEZ: bayat pinler de sunulur (teşhis aracı burası), her pine `bayat`
    // bayrağı eklenir. /status'ten farkı bilinçli — orada fail-safe filtre var.
    const pins = plcGroups.flatMap((g) => {
      const sonOkuma = g.conn.lastReadAt ? new Date(g.conn.lastReadAt).toISOString() : null
      const bayat = !taze(sonOkuma, simdi, BAYATLIK_MS)
      return g.pins.map((p) => ({
        kod: p.kod,
        plc: g.conn.kod,
        tezgahKod: p.tezgahKod,
        curSayac: p.curSayac,
        lastDelta: p.lastDelta,
        durusBit: p.durusBit,
        sonOkuma,
        bayat,
      }))
    })
    pins.sort((a, b) => a.plc.localeCompare(b.plc, 'tr') || a.kod - b.kod)
    res.end(JSON.stringify({ sonOkuma: sonGlobalOkuma, pinSayisi: pins.length, pins }, null, 2))
  } else {
    res.statusCode = 404
    res.end(JSON.stringify({ error: 'bulunamadı', endpoints: ['/health', '/status', '/pins'] }))
  }
})

async function shutdown(sig: string) {
  if (stopping) return
  stopping = true
  log(`${sig} — kapanıyor`)
  server.close()
  for (const g of plcGroups) g.conn.disconnect()
  await prisma.$disconnect().catch(() => {})
  await pool.end().catch(() => {})
  process.exit(0)
}
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

async function main() {
  log(`IPRO PLC Poller başlıyor (interval=${POLL_INTERVAL_MS}ms, port=${HTTP_PORT})`)
  await loadPins()
  server.listen(HTTP_PORT, () => log(`HTTP dinliyor :${HTTP_PORT} → /health, /status, /pins`))
  loop()
}

main().catch((e) => {
  log(`ÖLÜMCÜL: ${e instanceof Error ? e.stack : e}`)
  process.exitCode = 1
})
