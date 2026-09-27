/**
 * ifs-partno-geri-doldur.ts — MAS kaynaklı IPRO loglarında ifsPartNo (parça kodu) geri doldurur.
 * Kaynak: MAS Planning.WorkOrder.MaterialId → Inventory.Material.Code (WorkOrderNo = IPRO ifsOrderNo).
 * (MAS 41632/41632 WorkOrder'da Material.Code çözüyor → IFS ShopOrds fallback pratikte gereksiz.)
 *
 * VARSAYILAN DRY-RUN. Yazma: --apply (+ dev dışı --prod-onay). İdempotent (yalnız değişeni yazar).
 *   npx tsx scripts/ipro/ifs-partno-geri-doldur.ts
 *   DATABASE_URL=<prod> npx tsx scripts/ipro/ifs-partno-geri-doldur.ts --apply --prod-onay
 */
import sql from 'mssql'
import { createPrisma, banner, summary } from './_lib'

const APPLY = process.argv.includes('--apply')

async function masBaglan(): Promise<sql.ConnectionPool> {
  const cfg: sql.config = {
    server: process.env.MAS_HOST!, port: Number(process.env.MAS_PORT || 1433), database: process.env.MAS_DB!,
    user: process.env.MAS_USER!, password: process.env.MAS_PASS!,
    options: { encrypt: process.env.MAS_ENCRYPT === 'true' || process.env.MAS_ENCRYPT === '1', trustServerCertificate: true, enableArithAbort: true },
    connectionTimeout: 15000, requestTimeout: 120000,
  }
  if (!cfg.server) throw new Error('DUR: MAS_HOST yok')
  return new sql.ConnectionPool(cfg).connect()
}

/** WorkOrderNo → parça kodu (Material.Code). Batch 500. */
async function partByOrderNo(pool: sql.ConnectionPool, orderNos: string[]): Promise<Map<string, string>> {
  const m = new Map<string, string>()
  for (let i = 0; i < orderNos.length; i += 500) {
    const dilim = orderNos.slice(i, i + 500)
    const rq = pool.request()
    const ps = dilim.map((no, j) => { rq.input(`o${j}`, sql.NVarChar, no); return `@o${j}` })
    const r = await rq.query<{ no: string; part: string | null }>(
      `SELECT wo.WorkOrderNo no, mt.Code part FROM Planning.WorkOrder wo
       JOIN Inventory.Material mt ON mt.Id = wo.MaterialId
       WHERE wo.WorkOrderNo IN (${ps.join(',')})`)
    for (const x of r.recordset) if (x.no && x.part && !m.has(x.no)) m.set(x.no, x.part)
  }
  return m
}

async function main() {
  banner('IPRO ifsPartNo GERİ DOLDURMA', !APPLY)
  const { prisma, disconnect } = createPrisma()
  const pool = await masBaglan()
  try {
    const loglar = await prisma.iproProductionLog.findMany({
      where: { kaynak: 'MAS', ifsOrderNo: { not: null } },
      select: { id: true, ifsOrderNo: true, ifsPartNo: true },
    })
    const orderNos = [...new Set(loglar.map((l) => l.ifsOrderNo!).filter(Boolean))]
    const partMap = await partByOrderNo(pool, orderNos)

    let doldurulacak = 0, cozulemeyen = 0, yazilan = 0
    const cozulemeyenSet = new Set<string>()
    for (const l of loglar) {
      const part = l.ifsOrderNo ? partMap.get(l.ifsOrderNo) : undefined
      if (!part) { if (l.ifsOrderNo) cozulemeyenSet.add(l.ifsOrderNo); cozulemeyen++; continue }
      if (l.ifsPartNo === part) continue // zaten doğru
      doldurulacak++
      if (APPLY) { await prisma.iproProductionLog.update({ where: { id: l.id }, data: { ifsPartNo: part } }); yazilan++ }
    }

    summary([
      ['MAS kaynaklı log (ifsOrderNo dolu)', loglar.length],
      ['distinct iş emri', orderNos.length],
      ['MAS part çözülen iş emri', partMap.size],
      ['doldurulacak/değişecek log', doldurulacak],
      ['çözülemeyen log (part yok)', cozulemeyen],
      ['çözülemeyen distinct iş emri', cozulemeyenSet.size],
      ...(APPLY ? ([['yazılan', yazilan]] as [string, number][]) : []),
    ])
    if (!APPLY) console.log('\nℹ️ DRY-RUN — yazma yok. Yazmak için: --apply (prod: --apply --prod-onay)')
    await pool.close(); await disconnect()
  } catch (e) {
    await pool.close().catch(() => {}); await disconnect()
    throw e
  }
}

main().catch((e) => { console.error('\n⛔ DUR:', e instanceof Error ? e.message : e); process.exitCode = 1 })
