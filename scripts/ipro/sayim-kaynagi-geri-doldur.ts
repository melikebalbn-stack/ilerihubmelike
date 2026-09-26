/**
 * sayim-kaynagi-geri-doldur.ts — MAS kaynaklı tüm IPRO loglarında sayım kaynağını MAS Amount'a taşır:
 *   uretimAdet = MAS Amount (nihai adet; sinyalli dahil), plcAdet = ham PLC Σdelta, masCarpan = CounterMultiplier.
 * Sonra IproOeeKaydi quality+performance+oee yeniden hesaplanır (hurda formülü AYNI: iyi = uretimAdet − qtyScrap).
 *
 * VARSAYILAN DRY-RUN. Yazma: --apply (+ dev dışı hedefte --prod-onay). İdempotent.
 * MAS SALT OKUMA (inline mssql). PLC Σdelta = ipro_sayac_okuma Σdelta (iş penceresi).
 *
 *   npx tsx scripts/ipro/sayim-kaynagi-geri-doldur.ts                                  # DRY-RUN (dev)
 *   DATABASE_URL=<prod> npx tsx scripts/ipro/sayim-kaynagi-geri-doldur.ts --apply --prod-onay
 */
import sql from 'mssql'
import { createPrisma, banner, summary } from './_lib'
import { uretimAdedi } from '../../src/lib/entegrasyon/mas/uretim-mapper'
import { oeeKaydiHesaplaVeYaz } from '../../src/lib/ipro/oee-hesap'

const APPLY = process.argv.includes('--apply')

async function masBaglan(): Promise<sql.ConnectionPool> {
  const cfg: sql.config = {
    server: process.env.MAS_HOST!, port: Number(process.env.MAS_PORT || 1433), database: process.env.MAS_DB!,
    user: process.env.MAS_USER!, password: process.env.MAS_PASS!,
    options: { encrypt: process.env.MAS_ENCRYPT === 'true' || process.env.MAS_ENCRYPT === '1', trustServerCertificate: true, enableArithAbort: true },
    connectionTimeout: 15000, requestTimeout: 120000,
  }
  if (!cfg.server) throw new Error('DUR: MAS_HOST yok (MAS env yüklenemedi)')
  return new sql.ConnectionPool(cfg).connect()
}

/** MAS master → { amount (Σ HAM uretimAdedi), carpan (max CounterMultiplier) } */
async function masOzet(pool: sql.ConnectionPool, ids: number[]): Promise<Map<number, { amount: number; carpan: number | null }>> {
  const m = new Map<number, { amount: number; carpan: number | null }>()
  for (let i = 0; i < ids.length; i += 500) {
    const dilim = ids.slice(i, i + 500)
    const rq = pool.request()
    const ps = dilim.map((id, j) => { rq.input(`id${j}`, sql.Int, id); return `@id${j}` })
    const r = await rq.query<{ mid: number; amount: number | null; reportedAmount: number | null; carpan: number | null }>(
      `SELECT pd.ProductionMasterId mid, CAST(pd.Amount AS float) amount, CAST(pd.ReportedAmount AS float) reportedAmount, CAST(pd.CounterMultiplier AS float) carpan
       FROM Production.ProductionDetail pd WHERE pd.Active=1 AND pd.ProductionMasterId IN (${ps.join(',')})`)
    // Detay satırlarını master başına topla (uretimAdedi HAM: Amount>0 ise Amount, değilse ReportedAmount)
    for (const x of r.recordset) {
      const adet = uretimAdedi({ amount: x.amount, reportedAmount: x.reportedAmount })
      const carpan = x.carpan != null ? Math.round(x.carpan) : null
      const cur = m.get(x.mid)
      if (!cur) m.set(x.mid, { amount: adet, carpan })
      else { cur.amount += adet; if (carpan != null && (cur.carpan == null || carpan > cur.carpan)) cur.carpan = carpan }
    }
  }
  return m
}

async function main() {
  banner('IPRO SAYIM KAYNAĞI GERİ DOLDURMA (MAS Amount)', !APPLY)
  const { prisma, disconnect } = createPrisma()
  const pool = await masBaglan()
  try {
    const loglar = await prisma.iproProductionLog.findMany({
      where: { kaynak: 'MAS', masProductionMasterId: { not: null } },
      select: { id: true, masProductionMasterId: true, durum: true, baslatildiAt: true, bitirildiAt: true, uretimAdet: true, qtyScrap: true, tezgah: { select: { kod: true, _count: { select: { plcPinler: true } } } } },
    })
    const masIds = [...new Set(loglar.map((l) => l.masProductionMasterId!))]
    const masbilgi = await masOzet(pool, masIds)

    let etkilenen = 0
    const ornekler: { kod: string; eski: number | null; yeni: number; plc: number | null; carpan: number | null; hurda: number }[] = []
    let apUretim = 0, apOee = 0

    for (const l of loglar) {
      const mi = masbilgi.get(l.masProductionMasterId!)
      if (!mi) continue
      const yeni = Math.round(mi.amount)
      // PLC Σdelta (sinyalli + iş penceresi varsa)
      let plc: number | null = null
      if (l.tezgah._count.plcPinler > 0 && l.baslatildiAt && l.bitirildiAt) {
        const agg = await prisma.iproSayacOkuma.aggregate({ where: { tezgahKod: l.tezgah.kod, ts: { gte: l.baslatildiAt, lte: l.bitirildiAt } }, _sum: { delta: true } })
        plc = agg._sum.delta ?? 0
      }
      if (l.uretimAdet !== yeni) etkilenen++ // plcAdet kolonu prod migration'dan sonra dolar (dry-run'da seçilmez)
      if (ornekler.length < 5 && l.qtyScrap > 0) ornekler.push({ kod: l.tezgah.kod, eski: l.uretimAdet, yeni, plc, carpan: mi.carpan, hurda: l.qtyScrap })

      if (APPLY) {
        await prisma.iproProductionLog.update({ where: { id: l.id }, data: { uretimAdet: yeni, plcAdet: plc, masCarpan: mi.carpan, hesapKaynagi: 'MAS' } })
        apUretim++
      }
    }
    if (APPLY) {
      for (const l of loglar) {
        if (l.durum !== 'KAPALI') continue
        try { await oeeKaydiHesaplaVeYaz(prisma, l.id); apOee++ } catch { /* atla */ }
      }
    }

    console.log('\n5 örnek (hurdalı): tezgah | uretimAdet eski→yeni | plcAdet | masCarpan | hurda')
    for (const o of ornekler) console.log(`  ${o.kod} | ${o.eski}→${o.yeni} | plc=${o.plc} | x${o.carpan} | hurda=${o.hurda}`)
    summary([
      ['MAS kaynaklı log', loglar.length],
      ['MAS master çözülen', masbilgi.size],
      ['değişecek log', etkilenen],
      ...(APPLY ? ([['uretimAdet güncellenen', apUretim], ['OEE yeniden hesap', apOee]] as [string, number][]) : []),
    ])
    if (!APPLY) console.log('\nℹ️ DRY-RUN — yazma yok. Yazmak için: --apply (prod: --apply --prod-onay)')
    await pool.close(); await disconnect()
  } catch (e) {
    await pool.close().catch(() => {}); await disconnect()
    throw e
  }
}

main().catch((e) => { console.error('\n⛔ DUR:', e instanceof Error ? e.message : e); process.exitCode = 1 })
