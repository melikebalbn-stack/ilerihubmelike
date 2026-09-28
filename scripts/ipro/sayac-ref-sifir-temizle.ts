/**
 * sayac-ref-sifir-temizle.ts — poller "ref 0/yok" hatasıyla ipro_sayac_okuma'ya yazılmış SAHTE
 * delta kayıtlarını temizler. (Hata: kalıcı sonDeger yok/0 iken gapKarar(cur,0)=cur → sahte üretim;
 * fix 0a533078b sonrası commit'te. Bu script YALNIZ o hatadan önce yazılmış kayıtları siler.)
 *
 * Kaynak: poller out log'daki "GAP KURTARMA (ref 0 → N)" satırları (pin + zaman + delta). Pin→tezgah
 * eşlenir (eşlemesiz pin ipro_sayac_okuma'ya YAZILMAZ, atlanır). Eşleşen (tezgahKod, delta, zaman±TOL)
 * ipro_sayac_okuma satırı phantom kabul edilir. Etkilenen KAPALI iş OEE'si yeniden hesaplanır.
 *
 * VARSAYILAN DRY-RUN. Yazma: --apply (+ dev dışı --prod-onay). Silmeden ÖNCE yedek tablo.
 *   npx tsx scripts/ipro/sayac-ref-sifir-temizle.ts --log ~/.pm2/logs/ilerihub-ipro-poller-out.log
 *   DATABASE_URL=<prod> npx tsx scripts/ipro/sayac-ref-sifir-temizle.ts --apply --prod-onay
 */
import * as fs from 'fs'
import { createPrisma, banner, summary } from './_lib'
import { oeeKaydiHesaplaVeYaz } from '../../src/lib/ipro/oee-hesap'

const APPLY = process.argv.includes('--apply')
const logArg = process.argv.indexOf('--log')
const LOG = logArg >= 0 ? process.argv[logArg + 1] : `${process.env.HOME}/.pm2/logs/ilerihub-ipro-poller-out.log`
const TOL_MS = 20_000 // log zamanı ↔ ipro_sayac_okuma.ts eşleşme penceresi
const YEDEK = 'ipro_sayac_okuma_yedek_ref0_20260928'

interface Olay { ts: number; pinKod: number; delta: number }

/** Log'dan "... pin N GAP KURTARMA (ref 0 → D)" satırlarını ayrıştır (SAF, test edilebilir). */
export function refSifirOlaylari(satirlar: string[]): Olay[] {
  const re = /^\[([0-9T:.-]+Z)\].*pin (\d+) GAP KURTARMA \(ref 0 → (\d+)\)/
  const out: Olay[] = []
  for (const s of satirlar) {
    const m = re.exec(s)
    if (m) out.push({ ts: Date.parse(m[1]), pinKod: Number(m[2]), delta: Number(m[3]) })
  }
  return out
}

async function main() {
  banner('IPRO SAYAÇ ref=0 SAHTE ÜRETİM TEMİZLE', !APPLY)
  const { prisma, disconnect } = createPrisma()
  try {
    if (!fs.existsSync(LOG)) throw new Error(`DUR: log yok: ${LOG}`)
    const olaylar = refSifirOlaylari(fs.readFileSync(LOG, 'utf8').split('\n'))
    console.log(`log'da ref=0 gap-kurtarma olayı: ${olaylar.length}`)

    // pin → tezgahKod (eşlemesiz pin ipro_sayac_okuma'ya yazılmaz → atlanır)
    const pinKodlar = [...new Set(olaylar.map((o) => o.pinKod))]
    const pinler = await prisma.iproPlcPin.findMany({ where: { kod: { in: pinKodlar } }, select: { kod: true, tezgah: { select: { kod: true } } } })
    const pinTezgah = new Map(pinler.map((p) => [p.kod, p.tezgah?.kod ?? null]))
    const eslesen = olaylar.filter((o) => pinTezgah.get(o.pinKod))
    console.log(`eşlemeli pin olayı (tezgahlı): ${eslesen.length} / ${olaylar.length} (eşlemesiz atlandı)`)

    // Her olay için ipro_sayac_okuma satırı bul: tezgahKod + delta + ts±TOL, en yakın, 1:1.
    const kullanilan = new Set<bigint>()
    type Bulgu = { id: bigint; tezgahKod: string; delta: number; ts: Date }
    const bulgular: Bulgu[] = []
    for (const o of eslesen) {
      const tz = pinTezgah.get(o.pinKod)!
      const aday = await prisma.iproSayacOkuma.findMany({
        where: { tezgahKod: tz, delta: o.delta, ts: { gte: new Date(o.ts - TOL_MS), lte: new Date(o.ts + TOL_MS) } },
        select: { id: true, ts: true },
      })
      // en yakın, henüz kullanılmamış
      const sirali = aday.filter((r) => !kullanilan.has(r.id)).sort((a, b) => Math.abs(a.ts.getTime() - o.ts) - Math.abs(b.ts.getTime() - o.ts))
      if (sirali[0]) { kullanilan.add(sirali[0].id); bulgular.push({ id: sirali[0].id, tezgahKod: tz, delta: o.delta, ts: sirali[0].ts }) }
    }

    // sebep bazında (tezgah) özet
    const byTz = new Map<string, { adet: number; dk: number }>()
    for (const b of bulgular) { const c = byTz.get(b.tezgahKod) ?? { adet: 0, dk: 0 }; c.adet++; c.dk += b.delta; byTz.set(b.tezgahKod, c) }

    console.log('\n== SİLİNECEK phantom ipro_sayac_okuma satırları (tezgah · zaman · delta) ==')
    for (const b of bulgular.sort((a, b) => a.tezgahKod.localeCompare(b.tezgahKod) || a.ts.getTime() - b.ts.getTime())) {
      console.log(`  ${b.tezgahKod} · ${b.ts.toISOString()} · Δ=${b.delta}`)
    }

    // Etkilenen KAPALI iş OEE (satır ts'i iş penceresinde) — yalnız mevcut OEE kaydı olanlar
    const etkilenenLog = new Set<string>()
    if (bulgular.length) {
      const tezgahKodlar = [...new Set(bulgular.map((b) => b.tezgahKod))]
      const loglar = await prisma.iproProductionLog.findMany({
        where: { durum: 'KAPALI', tezgah: { kod: { in: tezgahKodlar } }, baslatildiAt: { not: null }, bitirildiAt: { not: null } },
        select: { id: true, baslatildiAt: true, bitirildiAt: true, tezgah: { select: { kod: true } } },
      })
      const degen = new Set<string>()
      for (const l of loglar) {
        const lb = l.baslatildiAt!.getTime(), le = l.bitirildiAt!.getTime()
        if (bulgular.some((b) => b.tezgahKod === l.tezgah?.kod && b.ts.getTime() >= lb && b.ts.getTime() <= le)) degen.add(l.id)
      }
      if (degen.size) {
        const oeeVar = await prisma.iproOeeKaydi.findMany({ where: { productionLogId: { in: [...degen] } }, select: { productionLogId: true } })
        for (const o of oeeVar) etkilenenLog.add(o.productionLogId)
      }
    }

    let silinen = 0, oeeYeniden = 0, yedeklenen = 0
    if (APPLY && bulgular.length) {
      const ids = bulgular.map((b) => b.id)
      // YEDEK (silmeden önce) — tablo yoksa oluştur (idempotent).
      const varMi = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*)::bigint c FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`, YEDEK)
      if (Number(varMi[0].c) === 0) {
        const liste = ids.map((x) => x.toString()).join(',')
        await prisma.$executeRawUnsafe(`CREATE TABLE "${YEDEK}" AS SELECT * FROM ipro_sayac_okuma WHERE id IN (${liste})`)
      }
      const yn = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*)::bigint c FROM "${YEDEK}"`)
      yedeklenen = Number(yn[0].c)
      for (let i = 0; i < ids.length; i += 500) {
        const r = await prisma.iproSayacOkuma.deleteMany({ where: { id: { in: ids.slice(i, i + 500) } } })
        silinen += r.count
      }
      for (const logId of etkilenenLog) { try { await oeeKaydiHesaplaVeYaz(prisma, logId); oeeYeniden++ } catch { /* atla */ } }
    }

    console.log('\n== tezgah bazında ==')
    for (const [tz, v] of [...byTz.entries()].sort((a, b) => b[1].adet - a[1].adet)) console.log(`  ${tz}: ${v.adet} satır, Σdelta=${v.dk}`)
    summary([
      ['ref=0 olay (log)', olaylar.length],
      ['eşlemeli (tezgahlı) olay', eslesen.length],
      ['eşleşen phantom satır', bulgular.length],
      ['etkilenen KAPALI OEE', etkilenenLog.size],
      ...(APPLY ? ([['yedeklenen', yedeklenen], ['SİLİNDİ', silinen], ['OEE yeniden', oeeYeniden]] as [string, number][]) : []),
    ])
    if (!APPLY) console.log('\nℹ️ DRY-RUN — silme yok. Silmek için: --apply (prod: --apply --prod-onay)')
    await disconnect()
  } catch (e) { await disconnect(); throw e }
}

import { isEntry } from './_lib'
if (isEntry('sayac-ref-sifir-temizle')) {
  main().catch((e) => { console.error('\n⛔ DUR:', e instanceof Error ? e.message : e); process.exitCode = 1 })
}
