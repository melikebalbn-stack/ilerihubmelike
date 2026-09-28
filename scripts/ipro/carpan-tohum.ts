/**
 * carpan-tohum.ts — IproSayacCarpani'yi MAS son 180 gün VW_AllProductionDetail'den tohumlar.
 *
 * Kural:
 *  - Parça+op TEK çarpanlıysa            → TEZGAHSIZ (genel) satır, baskinPay=100.
 *  - Tezgaha göre BASKIN çarpan değişiyor → TEZGAH başına satır (o tezgahın baskın çarpanı+payı).
 *  - Çok çarpanlı ama baskın tezgaha göre değişmiyor → genel satır (genel baskın çarpan+pay).
 *  - Baskın pay < %80 → dogrulanacak=true.
 * MANUEL satırlara DOKUNMAZ. İdempotent (kaynak='MAS' satırları upsert; MANUEL atlanır).
 *
 * VARSAYILAN DRY-RUN. Yazma: --apply (+ dev dışı --prod-onay). MAS SALT OKUMA (inline mssql).
 *   npx tsx scripts/ipro/carpan-tohum.ts
 *   DATABASE_URL=<prod> npx tsx scripts/ipro/carpan-tohum.ts --apply --prod-onay
 */
import sql from 'mssql'
import { createPrisma, banner, summary, isEntry } from './_lib'

const APPLY = process.argv.includes('--apply')
const GUN = 180
const BASKIN_ESIK = 80

async function masBaglan(): Promise<sql.ConnectionPool> {
  const cfg: sql.config = {
    server: process.env.MAS_HOST!, port: Number(process.env.MAS_PORT || 1433), database: process.env.MAS_DB!,
    user: process.env.MAS_USER!, password: process.env.MAS_PASS!,
    options: { encrypt: process.env.MAS_ENCRYPT === 'true' || process.env.MAS_ENCRYPT === '1', trustServerCertificate: true, enableArithAbort: true },
    connectionTimeout: 15000, requestTimeout: 180000,
  }
  if (!cfg.server) throw new Error('DUR: MAS_HOST yok')
  return new sql.ConnectionPool(cfg).connect()
}

interface Row { MaterialCode: string; OperationCode: string; WorkCenterCode: string; CounterMultiplier: number; n: number; wo: number }
interface Hedef { parcaNo: string; operasyonNo: string; tezgahKod: string | null; carpan: number; baskinPay: number; isSayisi: number; dogrulanacak: boolean }

/** Bir (parça,op) için satırlardan hedef IproSayacCarpani satır(lar)ını türetir. */
export function hedefleriTuret(rows: Row[]): Hedef[] {
  const parcaNo = rows[0].MaterialCode, operasyonNo = rows[0].OperationCode
  const carpanlar = new Set(rows.map((r) => Math.round(r.CounterMultiplier)))
  const toplamWo = rows.reduce((s, r) => s + r.wo, 0)

  // TEK çarpan → genel satır
  if (carpanlar.size === 1) {
    return [{ parcaNo, operasyonNo, tezgahKod: null, carpan: [...carpanlar][0], baskinPay: 100, isSayisi: toplamWo, dogrulanacak: false }]
  }

  // Tezgah bazında baskın çarpan
  const byTz = new Map<string, Row[]>()
  for (const r of rows) { const a = byTz.get(r.WorkCenterCode) ?? []; a.push(r); byTz.set(r.WorkCenterCode, a) }
  const tzBaskin = new Map<string, { carpan: number; pay: number; wo: number }>()
  for (const [tz, rs] of byTz) {
    const tzToplamN = rs.reduce((s, r) => s + r.n, 0)
    const enSik = [...rs].sort((a, b) => b.n - a.n)[0]
    tzBaskin.set(tz, { carpan: Math.round(enSik.CounterMultiplier), pay: (enSik.n / tzToplamN) * 100, wo: rs.reduce((s, r) => s + r.wo, 0) })
  }
  const farkliBaskin = new Set([...tzBaskin.values()].map((x) => x.carpan))

  // Tezgaha göre baskın DEĞİŞİYOR → tezgah başına satır
  if (farkliBaskin.size >= 2) {
    return [...tzBaskin.entries()].map(([tz, x]) => ({
      parcaNo, operasyonNo, tezgahKod: tz, carpan: x.carpan, baskinPay: Math.round(x.pay * 10) / 10,
      isSayisi: x.wo, dogrulanacak: x.pay < BASKIN_ESIK,
    }))
  }

  // Çok çarpanlı ama baskın tezgaha göre aynı → genel satır (genel baskın)
  const nByCarpan = new Map<number, number>()
  for (const r of rows) { const c = Math.round(r.CounterMultiplier); nByCarpan.set(c, (nByCarpan.get(c) ?? 0) + r.n) }
  const toplamN = [...nByCarpan.values()].reduce((s, v) => s + v, 0)
  const [carpan, enN] = [...nByCarpan.entries()].sort((a, b) => b[1] - a[1])[0]
  const pay = (enN / toplamN) * 100
  return [{ parcaNo, operasyonNo, tezgahKod: null, carpan, baskinPay: Math.round(pay * 10) / 10, isSayisi: toplamWo, dogrulanacak: pay < BASKIN_ESIK }]
}

async function main() {
  banner('IPRO SAYAÇ ÇARPANI TOHUM (MAS 180g)', !APPLY)
  const { prisma, disconnect } = createPrisma()
  const pool = await masBaglan()
  try {
    const r = await pool.request().query<Row>(
      `SELECT MaterialCode, OperationCode, WorkCenterCode, CounterMultiplier, COUNT(*) n, COUNT(DISTINCT WorkOrderId) wo
       FROM Production.VW_AllProductionDetail
       WHERE ProductionMasterStartDateTime >= DATEADD(DAY,-${GUN},SYSDATETIME())
         AND MaterialCode IS NOT NULL AND OperationCode IS NOT NULL AND CounterMultiplier IS NOT NULL AND WorkCenterCode IS NOT NULL
       GROUP BY MaterialCode, OperationCode, WorkCenterCode, CounterMultiplier`)
    // (parça,op) grupla
    const gruplar = new Map<string, Row[]>()
    for (const row of r.recordset) { const k = `${row.MaterialCode}\u0001${row.OperationCode}`; const a = gruplar.get(k) ?? []; a.push(row); gruplar.set(k, a) }

    const hedefler: Hedef[] = []
    for (const rows of gruplar.values()) hedefler.push(...hedefleriTuret(rows))

    const tezgahsiz = hedefler.filter((h) => h.tezgahKod == null)
    const tezgahli = hedefler.filter((h) => h.tezgahKod != null)
    const dogrulanacaklar = hedefler.filter((h) => h.dogrulanacak)

    let yazilan = 0, guncellenen = 0, manuelAtlanan = 0
    if (APPLY) {
      for (const h of hedefler) {
        const mevcut = await prisma.iproSayacCarpani.findFirst({
          where: { parcaNo: h.parcaNo, operasyonNo: h.operasyonNo, tezgahKod: h.tezgahKod },
          select: { id: true, kaynak: true },
        })
        if (mevcut?.kaynak === 'MANUEL') { manuelAtlanan++; continue }
        if (mevcut) {
          await prisma.iproSayacCarpani.update({ where: { id: mevcut.id }, data: { carpan: h.carpan, baskinPay: h.baskinPay, isSayisi: h.isSayisi, dogrulanacak: h.dogrulanacak, kaynak: 'MAS' } })
          guncellenen++
        } else {
          await prisma.iproSayacCarpani.create({ data: { parcaNo: h.parcaNo, operasyonNo: h.operasyonNo, tezgahKod: h.tezgahKod, carpan: h.carpan, baskinPay: h.baskinPay, isSayisi: h.isSayisi, dogrulanacak: h.dogrulanacak, kaynak: 'MAS' } })
          yazilan++
        }
      }
    }

    console.log('\n== DOĞRULANACAK (baskın pay < %80) ==')
    for (const h of dogrulanacaklar.sort((a, b) => a.baskinPay - b.baskinPay)) {
      console.log(`  ${h.parcaNo} · op ${h.operasyonNo} · ${h.tezgahKod ?? '(genel)'} · çarpan=${h.carpan} · pay=${h.baskinPay}% · iş=${h.isSayisi}`)
    }

    summary([
      ['parça+op grubu', gruplar.size],
      ['hedef satır (toplam)', hedefler.length],
      ['tezgahsız (genel)', tezgahsiz.length],
      ['tezgahlı', tezgahli.length],
      ['doğrulanacak', dogrulanacaklar.length],
      ...(APPLY ? ([['CREATE', yazilan], ['UPDATE', guncellenen], ['MANUEL atlandı', manuelAtlanan]] as [string, number][]) : []),
    ])
    if (!APPLY) console.log('\nℹ️ DRY-RUN — yazma yok. Yazmak için: --apply (prod: --apply --prod-onay)')
    await pool.close(); await disconnect()
  } catch (e) {
    await pool.close().catch(() => {}); await disconnect()
    throw e
  }
}

// Yalnız DOĞRUDAN çalıştırılınca koş (import edildiğinde — ör. test — main tetiklenmez, MAS'a bağlanmaz).
if (isEntry('carpan-tohum')) {
  main().catch((e) => { console.error('\n⛔ DUR:', e instanceof Error ? e.message : e); process.exitCode = 1 })
}
