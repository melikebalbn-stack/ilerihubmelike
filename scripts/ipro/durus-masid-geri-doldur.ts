/**
 * durus-masid-geri-doldur.ts — MAS duruş aynasını masId modeline geçirir (geçmiş için).
 *
 * Son --gun N (varsayılan 30) gün için:
 *  1. masId'siz IPRO kaynak=MAS duruşları tezgah + başlangıç (±1 dk) ile MAS ProductionDowntime.Id'ye bağlar,
 *     bitiş/sebebi MAS'takiyle düzeltir (ör. 'simdi' ile geç kapanmış UD 11:30 → 11:01).
 *  2. MAS'ta olup IPRO'da olmayan duruşları (ör. dizinin ortasındaki Kalıp bağlama) oluşturur.
 *  3. MAS'ta kapanmış ama IPRO'da açık kalanları MAS bitişiyle kapatır.
 *  4. Süresi 0 kapalı duruşları yazmaz.
 *  5. MAS'la eşleşmeyen masId'siz IPRO kayıtlarını YALNIZ RAPORLAR (silmez).
 *  6. Değişen duruşların değdiği KAPALI işlerde OEE'yi yeniden hesaplar.
 * Plan canlı aynayla aynı saf fonksiyondan gelir (src/lib/entegrasyon/mas/durus-ayna.ts).
 *
 * VARSAYILAN DRY-RUN. Yazma: --apply (+ dev dışı --prod-onay). İdempotent.
 * --apply'da yazmadan ÖNCE dated yedek tablolar: ipro_durus_yedek_masid_YYYYMMDD / ipro_oee_yedek_masid_YYYYMMDD.
 * MAS SALT OKUMA (inline mssql).
 *
 *   npx tsx scripts/ipro/durus-masid-geri-doldur.ts [--gun 30]
 *   DATABASE_URL=<prod> npx tsx scripts/ipro/durus-masid-geri-doldur.ts --apply --prod-onay
 */
import sql from 'mssql'
import { createPrisma, banner, summary } from './_lib'
import { oeeKaydiHesaplaVeYaz } from '../../src/lib/ipro/oee-hesap'
import { masTarih } from '../../src/lib/mas/tarih'
import { durusAynaPlani, type MasDurusGirdi } from '../../src/lib/entegrasyon/mas/durus-ayna'

const APPLY = process.argv.includes('--apply')
const GUN = (() => {
  const i = process.argv.indexOf('--gun')
  const n = i >= 0 ? Number(process.argv[i + 1]) : 30
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 30
})()

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

function bugunEtiket(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '')
}

async function main() {
  banner(`IPRO DURUŞ masId GERİ DOLDUR (son ${GUN} gün)`, !APPLY)
  const { prisma, disconnect } = createPrisma()
  const pool = await masBaglan()
  try {
    // MAS: son GUN günde başlayan + hâlâ açık (son GUN gün içinde başlamış) duruşlar.
    const mr = await pool.request().input('gun', sql.Int, GUN).query<MasDurusGirdi>(
      `SELECT pdt.Id AS id, wc.Code AS tezgahKod, pdt.StartDateTime AS baslangic, pdt.EndDateTime AS bitis, ` +
        `d.Code AS sebepKod, d.Name AS sebepAd ` +
        `FROM Production.ProductionDowntime pdt ` +
        `JOIN Loss.Downtime d ON d.Id = pdt.DowntimeId ` +
        `JOIN Organization.WorkCenter wc ON wc.Id = pdt.WorkCenterId ` +
        `WHERE pdt.Active = 1 AND pdt.StartDateTime >= DATEADD(DAY, -@gun, SYSDATETIME())`,
    )
    const mas: MasDurusGirdi[] = mr.recordset.map((r) => ({
      ...r,
      tezgahKod: r.tezgahKod ? String(r.tezgahKod).trim() : null,
      sebepKod: r.sebepKod ? String(r.sebepKod).trim() : null,
      baslangic: masTarih(r.baslangic),
      bitis: masTarih(r.bitis),
    }))
    const pencereBas = new Date(Date.now() - GUN * 86400_000 - 60_000)

    const [tezgahlar, sebepler, ipro] = await Promise.all([
      prisma.iproTezgah.findMany({ select: { id: true, kod: true } }),
      prisma.iproDurusSebebi.findMany({ select: { id: true, kod: true } }),
      prisma.iproMachineDowntime.findMany({
        where: { kaynak: 'MAS', OR: [{ baslangic: { gte: pencereBas } }, { bitis: null }, { masId: { in: mas.map((m) => m.id) } }] },
        select: { id: true, masId: true, tezgahId: true, baslangic: true, bitis: true, durusSebebiId: true },
      }),
    ])
    const tezgahByKod = new Map(tezgahlar.map((t) => [t.kod, t.id]))
    const plan = durusAynaPlani({ mas, ipro, tezgahByKod, sebepByKod: new Map(sebepler.map((s) => [s.kod, s.id])) })

    // Raporlar
    const iproById = new Map(ipro.map((r) => [r.id, r]))
    const kodByTezgah = new Map(tezgahlar.map((t) => [t.id, t.kod]))
    const dk = (a: Date, b: Date | null) => ((b ?? new Date()).getTime() - a.getTime()) / 60000
    const baglanan = plan.guncelle.filter((g) => g.data.masId != null)
    const bitisDuzelen = plan.guncelle.filter((g) => g.data.bitis !== undefined)
    const eklenenDk = plan.olustur.reduce((s, o) => s + dk(o.baslangic, o.bitis), 0)
    const bagliIds = new Set(baglanan.map((g) => g.id))
    const eslesmeyenKapali = ipro.filter((r) => r.masId == null && r.bitis !== null && !bagliIds.has(r.id))
    const eslesmeyenDk = eslesmeyenKapali.reduce((s, r) => s + dk(r.baslangic, r.bitis), 0)

    const tezgahOzet = new Map<string, { eklenen: number; dk: number }>()
    for (const o of plan.olustur) {
      const k = kodByTezgah.get(o.tezgahId) ?? o.tezgahId
      const c = tezgahOzet.get(k) ?? { eklenen: 0, dk: 0 }
      c.eklenen++; c.dk += dk(o.baslangic, o.bitis)
      tezgahOzet.set(k, c)
    }
    console.log('\n== EKLENECEK duruş (tezgah bazında, ilk 20) ==')
    for (const [k, v] of [...tezgahOzet].sort((a, b) => b[1].dk - a[1].dk).slice(0, 20)) console.log(`  ${k} | adet=${v.eklenen} dk=${Math.round(v.dk)}`)
    if (plan.eslesmeyenSebepler.length) console.log(`\n⚠️ IPRO'da karşılığı olmayan MAS sebepleri: ${plan.eslesmeyenSebepler.join(', ')}`)
    if (eslesmeyenKapali.length) {
      console.log(`\n== MAS'la EŞLEŞMEYEN masId'siz kapalı IPRO kaydı (silinmez, rapor) — ilk 20 ==`)
      for (const r of eslesmeyenKapali.slice(0, 20)) console.log(`  ${kodByTezgah.get(r.tezgahId)} | ${r.baslangic.toISOString()} → ${r.bitis?.toISOString()}`)
    }

    // Etkilenen aralıklar → KAPALI işler (OEE yeniden)
    const degen: { tezgahId: string; bas: Date; bit: Date }[] = []
    for (const g of plan.guncelle) {
      const e = iproById.get(g.id)!
      degen.push({ tezgahId: e.tezgahId, bas: e.baslangic, bit: e.bitis ?? new Date() })
      degen.push({ tezgahId: e.tezgahId, bas: g.data.baslangic ?? e.baslangic, bit: (g.data.bitis === undefined ? e.bitis : g.data.bitis) ?? new Date() })
    }
    for (const o of plan.olustur) degen.push({ tezgahId: o.tezgahId, bas: o.baslangic, bit: o.bitis ?? new Date() })
    const etkilenenLog = new Set<string>()
    const oeeIds = new Set<string>()
    if (degen.length) {
      const loglar = await prisma.iproProductionLog.findMany({
        where: { durum: 'KAPALI', tezgahId: { in: [...new Set(degen.map((d) => d.tezgahId))] }, baslatildiAt: { not: null }, bitirildiAt: { gte: pencereBas } },
        select: { id: true, tezgahId: true, baslatildiAt: true, bitirildiAt: true },
      })
      const hedef: string[] = []
      for (const l of loglar) {
        const lb = l.baslatildiAt!.getTime(), le = l.bitirildiAt!.getTime()
        if (degen.some((d) => d.tezgahId === l.tezgahId && d.bas.getTime() < le && lb < d.bit.getTime())) hedef.push(l.id)
      }
      if (hedef.length) {
        const oeeVar = await prisma.iproOeeKaydi.findMany({ where: { productionLogId: { in: hedef } }, select: { id: true, productionLogId: true } })
        for (const o of oeeVar) { etkilenenLog.add(o.productionLogId); oeeIds.add(o.id) }
      }
    }

    let olusan = 0, guncellenen = 0, oeeYeniden = 0, hata = 0, yDurus = 0, yOee = 0
    if (APPLY) {
      const etiket = bugunEtiket()
      async function yedekle(tablo: string, kaynak: string, ids: string[]): Promise<number> {
        const temiz = ids.filter((x) => /^[A-Za-z0-9_-]+$/.test(x))
        const varMi = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
          `SELECT count(*)::bigint c FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`, tablo)
        if (Number(varMi[0].c) > 0) {
          const n = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*)::bigint c FROM "${tablo}"`)
          console.log(`  ℹ️ ${tablo} zaten var (${n[0].c} satır) — yeniden yedeklenmedi (idempotent)`)
          return Number(n[0].c)
        }
        const liste = temiz.length ? temiz.map((x) => `'${x}'`).join(',') : `''`
        await prisma.$executeRawUnsafe(`CREATE TABLE "${tablo}" AS SELECT * FROM "${kaynak}" WHERE id IN (${liste})`)
        const n = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*)::bigint c FROM "${tablo}"`)
        console.log(`  ✅ ${tablo}: ${n[0].c} satır yedeklendi`)
        return Number(n[0].c)
      }
      console.log('\n== YEDEK (yazmadan önce) ==')
      yDurus = await yedekle(`ipro_durus_yedek_masid_${etiket}`, 'ipro_machine_downtime', ipro.map((r) => r.id))
      yOee = await yedekle(`ipro_oee_yedek_masid_${etiket}`, 'ipro_oee_kaydi', [...oeeIds])

      for (const g of plan.guncelle) {
        try { await prisma.iproMachineDowntime.update({ where: { id: g.id }, data: g.data }); guncellenen++ } catch (e) { hata++; console.warn(`  ⚠️ güncelle ${g.id}: ${(e as Error).message.slice(0, 120)}`) }
      }
      for (const o of plan.olustur) {
        try {
          if (o.bitis === null) {
            await prisma.iproMachineDowntime.updateMany({ where: { tezgahId: o.tezgahId, kaynak: { in: ['OTO', 'TAKVIM'] }, bitis: null }, data: { bitis: o.baslangic } })
          }
          await prisma.iproMachineDowntime.create({ data: { ...o, kaynak: 'MAS' } })
          olusan++
        } catch (e) { hata++; console.warn(`  ⚠️ oluştur mas:${o.masId}: ${(e as Error).message.slice(0, 120)}`) }
      }
      for (const logId of etkilenenLog) {
        try { await oeeKaydiHesaplaVeYaz(prisma, logId); oeeYeniden++ } catch { /* atla */ }
      }
    }

    summary([
      ['MAS duruş (pencere)', mas.length],
      ['IPRO kaynak=MAS (pencere)', ipro.length],
      ['masId bağlanacak (eski kayıt)', baglanan.length],
      ['bitişi düzelecek / kapanacak', bitisDuzelen.length],
      ['eklenecek duruş', plan.olustur.length],
      ['eklenecek dk', Math.round(eklenenDk)],
      ['atlanan: süre 0', plan.atlanan.filter((a) => a.sebep === 'sifir_sure').length],
      ['atlanan: tezgah yok', plan.atlanan.filter((a) => a.sebep === 'tezgah_yok').length],
      ['atlanan: başlangıç yok', plan.atlanan.filter((a) => a.sebep === 'baslangic_yok').length],
      ["eşleşmeyen masId'siz kapalı (rapor)", eslesmeyenKapali.length],
      ["eşleşmeyen masId'siz kapalı dk", Math.round(eslesmeyenDk)],
      ["eşleşmeyen masId'siz AÇIK (rapor)", plan.eskiAcikEslesmeyen.length],
      ['etkilenen KAPALI OEE kaydı', etkilenenLog.size],
      ...(APPLY ? ([['yedek: duruş', yDurus], ['yedek: OEE', yOee], ['güncellenen', guncellenen], ['oluşturulan', olusan], ['hata', hata], ['OEE yeniden hesap', oeeYeniden]] as [string, number][]) : []),
    ])
    if (!APPLY) console.log('\nℹ️ DRY-RUN — yazma yok. Yazmak için: --apply (prod: --apply --prod-onay)')
    await pool.close(); await disconnect()
  } catch (e) {
    await pool.close().catch(() => {}); await disconnect()
    throw e
  }
}

main().catch((e) => { console.error('\n⛔ DUR:', e instanceof Error ? e.message : e); process.exitCode = 1 })
