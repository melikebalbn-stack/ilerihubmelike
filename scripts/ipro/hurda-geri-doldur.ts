/**
 * hurda-geri-doldur.ts — Tüm MAS kaynaklı IPRO loglarına MAS hurdasını (Production.ProductionReject)
 * geri doldurur: IproHurdaKaydi upsert (idempotent masRejectId), log.qtyScrap = Σ adet (rework hariç),
 * KAPALI logların IproOeeKaydi.quality+oee'sini yeni formülle (iyi = uretimAdet − qtyScrap) yeniden hesaplar.
 *
 * VARSAYILAN DRY-RUN (yazma yok). Yazma: --apply (+ dev dışı hedefte --prod-onay). İdempotent.
 * MAS SALT OKUMA (inline mssql; mas/uretim server-only → import edilemez). Prisma DB guard: _lib.
 *
 *   npx tsx scripts/ipro/hurda-geri-doldur.ts                    # DRY-RUN (dev)
 *   DATABASE_URL=<prod> npx tsx scripts/ipro/hurda-geri-doldur.ts --apply --prod-onay   # prod yazma
 *   (MAS_* env gerekli — aktif slot .env'inden export)
 */
import sql from 'mssql'
import { createPrisma, banner, summary } from './_lib'
import { masTarih } from '../../src/lib/mas/tarih'
import { oeeKaydiHesaplaVeYaz, iyiAdetHesapla } from '../../src/lib/ipro/oee-hesap'

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

interface Reject { rejectId: number; masId: number; sebepKod: string | null; sebepAd: string | null; adet: number; zaman: Date | null; isRework: boolean }

async function rejectleriCek(pool: sql.ConnectionPool, masIds: number[]): Promise<Reject[]> {
  const out: Reject[] = []
  for (let i = 0; i < masIds.length; i += 500) {
    const dilim = masIds.slice(i, i + 500)
    const rq = pool.request()
    const params = dilim.map((id, j) => { rq.input(`id${j}`, sql.Int, id); return `@id${j}` })
    const res = await rq.query<Reject>(
      `SELECT r.Id AS rejectId, pd.ProductionMasterId AS masId, lr.Code AS sebepKod, lr.Name AS sebepAd,
              CAST(r.Amount AS float) AS adet, r.RecordDateTime AS zaman, r.IsRework AS isRework
       FROM Production.ProductionReject r
       JOIN Production.ProductionDetail pd ON pd.Id = r.ProductionDetailId
       LEFT JOIN Loss.Reject lr ON lr.Id = r.RejectId
       WHERE r.Active = 1 AND pd.ProductionMasterId IN (${params.join(',')})`)
    out.push(...res.recordset.map((r) => ({ ...r, zaman: masTarih(r.zaman) })))
  }
  return out
}

async function main() {
  banner('IPRO HURDA GERİ DOLDURMA', !APPLY)
  const { prisma, disconnect } = createPrisma()
  const pool = await masBaglan()
  try {
    const loglar = await prisma.iproProductionLog.findMany({
      where: { kaynak: 'MAS', masProductionMasterId: { not: null } },
      select: { id: true, masProductionMasterId: true, durum: true, uretimAdet: true, qtyScrap: true, qtyComplete: true },
    })
    const logByMas = new Map<number, (typeof loglar)[number]>()
    for (const l of loglar) if (l.masProductionMasterId != null) logByMas.set(l.masProductionMasterId, l)
    const masIds = [...logByMas.keys()]

    const rejectler = await rejectleriCek(pool, masIds)
    // Log bazında rework-hariç Σ hurda
    const scrapByLog = new Map<string, number>()
    for (const rj of rejectler) {
      const log = logByMas.get(rj.masId)
      if (!log || rj.isRework) continue
      scrapByLog.set(log.id, (scrapByLog.get(log.id) ?? 0) + Math.round(rj.adet))
    }

    // ── ÖNCE/SONRA quality (mevcut IproOeeKaydi'den) ──
    const oeeKayitlar = await prisma.iproOeeKaydi.findMany({ select: { productionLogId: true, uretilenAdet: true, quality: true } })
    let onceQ1 = 0, sonraQ1 = 0, hurdaliLog = 0
    for (const k of oeeKayitlar) {
      if (k.quality != null && k.quality > 1) onceQ1++
      const scrap = scrapByLog.get(k.productionLogId) ?? 0
      const uret = k.uretilenAdet
      const sonraQ = uret > 0 ? iyiAdetHesapla(uret, scrap) / uret : null
      if (sonraQ != null && sonraQ > 1) sonraQ1++
    }
    const toplamHurda = [...scrapByLog.values()].reduce((a, b) => a + b, 0)
    hurdaliLog = scrapByLog.size

    // ── APPLY: hurda upsert + qtyScrap + OEE yeniden hesap ──
    let hurdaYazilan = 0, logGuncellenen = 0, oeeYeniden = 0
    if (APPLY) {
      for (const rj of rejectler) {
        const log = logByMas.get(rj.masId)
        if (!log) continue
        await prisma.iproHurdaKaydi.upsert({
          where: { masRejectId: rj.rejectId },
          update: { adet: Math.round(rj.adet), sebepKod: rj.sebepKod, sebepAd: rj.sebepAd, isRework: !!rj.isRework, zaman: rj.zaman ?? new Date(), productionLogId: log.id },
          create: { productionLogId: log.id, masRejectId: rj.rejectId, sebepKod: rj.sebepKod, sebepAd: rj.sebepAd, adet: Math.round(rj.adet), isRework: !!rj.isRework, zaman: rj.zaman ?? new Date(), kaynak: 'MAS' },
        })
        hurdaYazilan++
      }
      // qtyScrap güncelle (etkilenen loglar) + KAPALI ise OEE yeniden hesapla
      for (const [logId, scrap] of scrapByLog) {
        await prisma.iproProductionLog.update({ where: { id: logId }, data: { qtyScrap: scrap } })
        logGuncellenen++
      }
      // Tüm MAS loglarının IproOeeKaydi'sini yeniden hesapla (quality formülü değişti; hurdasız da 1'e sabitlenir)
      for (const l of loglar) {
        if (l.durum !== 'KAPALI') continue
        try { await oeeKaydiHesaplaVeYaz(prisma, l.id); oeeYeniden++ } catch { /* atla */ }
      }
    }

    summary([
      ['MAS kaynaklı log', loglar.length],
      ['MAS reject satırı', rejectler.length],
      ['hurdalı log', hurdaliLog],
      ['toplam hurda adedi (rework hariç)', toplamHurda],
      ['quality>1 ÖNCE', onceQ1],
      ['quality>1 SONRA (beklenen 0)', sonraQ1],
      ...(APPLY ? ([['hurda upsert', hurdaYazilan], ['qtyScrap güncellenen log', logGuncellenen], ['OEE yeniden hesap', oeeYeniden]] as [string, number][]) : []),
    ])
    if (!APPLY) console.log('\nℹ️ DRY-RUN — yazma yok. Yazmak için: --apply (prod: --apply --prod-onay)')
    await pool.close(); await disconnect()
  } catch (e) {
    await pool.close().catch(() => {}); await disconnect()
    throw e
  }
}

main().catch((e) => { console.error('\n⛔ DUR:', e instanceof Error ? e.message : e); process.exitCode = 1 })
