/**
 * durus-ayna-temizle.ts — MAS aynasında "başlangıç uydurulmuş" (phantom) duruş kayıtlarını temizler.
 * PHANTOM = IPRO kaynak=MAS duruş, baslangic'i o sebep kodunun GERÇEK MAS StartDateTime kümesinde YOK
 * (±1 dk) → '?? simdi' bug'ıyla ayna-koşu anı yazılmış; gerçek MAS duruşuna karşılık gelmiyor.
 * (Gerçek aynalanan duruşun baslangic'i = masTarih(StartDateTime) → kümede VARDIR, korunur.)
 * Silinen duruşların iş penceresine değdiği KAPALI IproOeeKaydi'leri yeniden hesaplanır (durusSaniye düzelir).
 *
 * VARSAYILAN DRY-RUN. Yazma: --apply (+ dev dışı --prod-onay). İdempotent.
 * --apply'da silmeden ÖNCE dated yedek tablolar (ipro_durus_yedek_YYYYMMDD / ipro_oee_yedek_YYYYMMDD).
 * MAS SALT OKUMA (inline mssql).
 *
 *   npx tsx scripts/ipro/durus-ayna-temizle.ts
 *   DATABASE_URL=<prod> npx tsx scripts/ipro/durus-ayna-temizle.ts --apply --prod-onay
 */
import sql from 'mssql'
import { createPrisma, banner, summary } from './_lib'
import { oeeKaydiHesaplaVeYaz } from '../../src/lib/ipro/oee-hesap'
import { masTarih } from '../../src/lib/mas/tarih'

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

async function main() {
  banner('IPRO DURUŞ AYNA TEMİZLE (phantom başlangıç)', !APPLY)
  const { prisma, disconnect } = createPrisma()
  const pool = await masBaglan()
  try {
    // MAS: her Loss.Downtime.Code için TÜM ProductionDowntime.StartDateTime'lar (dakika çözünürlüklü küme).
    // TZ'siz (İstanbul yerel) → masTarih() ile gerçek instant'a çevir (IPRO baslangic böyle yazıldı).
    // Kök-sebep dedektörü: gerçek aynalanan duruşun baslangic'i = masTarih(StartDateTime) → MAS kümesinde VARDIR;
    // '?? simdi' bug'ıyla uydurulmuş başlangıç (ayna-koşu anı) MAS kümesinde YOKTUR. MAS kodu aktifleşince de
    // çalışır (eski +2g heuristiği MAS-BD güncellenince bozulmuştu: 179 gerçek phantom'u kaçırıyordu).
    const mr = await pool.request().query<{ code: string; s: Date }>(
      `SELECT d.Code code, pd.StartDateTime s FROM Production.ProductionDowntime pd JOIN Loss.Downtime d ON d.Id=pd.DowntimeId`)
    const masDkByKod = new Map<string, Set<number>>()
    for (const r of mr.recordset) {
      const inst = r.s ? masTarih(new Date(r.s)) : null
      if (!inst) continue
      const kod = String(r.code).trim()
      let set = masDkByKod.get(kod)
      if (!set) { set = new Set<number>(); masDkByKod.set(kod, set) }
      set.add(Math.round(inst.getTime() / 60000))
    }

    // IPRO kaynak=MAS duruşlar + sebep erpKodu (MAS Code eşleşmesi)
    const duruslar = await prisma.iproMachineDowntime.findMany({
      where: { kaynak: 'MAS' },
      select: { id: true, tezgahId: true, baslangic: true, bitis: true, durusSebebi: { select: { ad: true, erpKodu: true } } },
    })
    type Ph = { id: string; tezgahId: string; baslangic: Date; bitis: Date | null; ad: string }
    const phantom: Ph[] = []
    const sebepOzet = new Map<string, { adet: number; dk: number; acik: number }>()
    const simdi = Date.now()
    for (const d of duruslar) {
      const kod = d.durusSebebi?.erpKodu ?? null
      const set = kod ? masDkByKod.get(kod) : undefined
      const k0 = Math.round(d.baslangic.getTime() / 60000)
      // phantom = baslangic MAS StartDateTime kümesinde YOK (±1 dk tolerans) → uydurulmuş 'simdi' başlangıç.
      // kod yok / MAS'ta o kod hiç yok → küme yok → zaten karşılıksız.
      const eslesti = !!set && (set.has(k0) || set.has(k0 - 1) || set.has(k0 + 1))
      if (eslesti) continue
      phantom.push({ id: d.id, tezgahId: d.tezgahId, baslangic: d.baslangic, bitis: d.bitis, ad: d.durusSebebi?.ad ?? '(sebepsiz)' })
      const dk = ((d.bitis ? d.bitis.getTime() : simdi) - d.baslangic.getTime()) / 60000
      const k = `${kod ?? '?'} ${d.durusSebebi?.ad ?? ''}`.trim()
      const cur = sebepOzet.get(k) ?? { adet: 0, dk: 0, acik: 0 }
      cur.adet++; cur.dk += dk; if (!d.bitis) cur.acik++
      sebepOzet.set(k, cur)
    }

    // Etkilenen OEE: phantom duruşun tezgah+zaman penceresine değen KAPALI iş VE mevcut IproOeeKaydi olanlar.
    // (OEE kaydı olmayan işe recompute YENİ kayıt uydurmasın → yalnız var olanı yeniden hesapla.)
    const phantomIds = new Set(phantom.map((p) => p.id))
    const etkilenenLog = new Set<string>()
    const oeeIds = new Set<string>() // yedeklenecek IproOeeKaydi satır id'leri (id sütunu → kolon-ad riski yok)
    if (phantom.length) {
      const tezgahlar = [...new Set(phantom.map((p) => p.tezgahId))]
      const loglar = await prisma.iproProductionLog.findMany({
        where: { durum: 'KAPALI', tezgahId: { in: tezgahlar }, baslatildiAt: { not: null }, bitirildiAt: { not: null } },
        select: { id: true, tezgahId: true, baslatildiAt: true, bitirildiAt: true },
      })
      const degen = new Set<string>()
      for (const l of loglar) {
        const lb = l.baslatildiAt!.getTime(), le = l.bitirildiAt!.getTime()
        for (const p of phantom) {
          if (p.tezgahId !== l.tezgahId) continue
          const pb = p.baslangic.getTime(), pe = (p.bitis ?? new Date(simdi)).getTime()
          if (pb < le && lb < pe) { degen.add(l.id); break }
        }
      }
      if (degen.size) {
        const oeeVar = await prisma.iproOeeKaydi.findMany({ where: { productionLogId: { in: [...degen] } }, select: { id: true, productionLogId: true } })
        for (const o of oeeVar) { etkilenenLog.add(o.productionLogId); oeeIds.add(o.id) }
      }
    }

    console.log('\n== SİLİNECEK phantom duruş (sebep bazında) ==')
    let tA = 0, tD = 0
    for (const [k, v] of [...sebepOzet.entries()].sort((a, b) => b[1].dk - a[1].dk)) { console.log(`  ${k} | adet=${v.adet} dk=${Math.round(v.dk)} açık=${v.acik}`); tA += v.adet; tD += v.dk }

    // YEDEK — silmeden ÖNCE dated tablolara phantom duruş + etkilenen OEE'nin MEVCUT hali. Tablo zaten
    // varsa yeniden yazmaz (idempotent: ikinci --apply koşusu iyi yedeği boş/eksikle EZMEZ). id sütunuyla
    // yedeklenir (kolon-ad haritalama riski yok). DB-içi yedek → KVKK dosya sızıntısı yok.
    let yDurus = 0, yOee = 0
    async function yedekle(tablo: string, kaynak: string, ids: string[]): Promise<number> {
      const temiz = ids.filter((x) => /^[A-Za-z0-9_-]+$/.test(x)) // cuid — SQL enjeksiyon güvenli
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
      console.log(`  ✅ ${tablo}: ${n[0].c} satır yedeklendi (kaynak ${kaynak})`)
      return Number(n[0].c)
    }

    let silinen = 0, oeeYeniden = 0
    if (APPLY) {
      console.log('\n== YEDEK (silmeden önce) ==')
      yDurus = await yedekle('ipro_durus_yedek_20260928', 'ipro_machine_downtime', [...phantomIds])
      yOee = await yedekle('ipro_oee_yedek_20260928', 'ipro_oee_kaydi', [...oeeIds])
      const idList = [...phantomIds]
      for (let i = 0; i < idList.length; i += 500) {
        const r = await prisma.iproMachineDowntime.deleteMany({ where: { id: { in: idList.slice(i, i + 500) } } })
        silinen += r.count
      }
      for (const logId of etkilenenLog) {
        try { await oeeKaydiHesaplaVeYaz(prisma, logId); oeeYeniden++ } catch { /* atla */ }
      }
    }

    summary([
      ['IPRO kaynak=MAS duruş (toplam)', duruslar.length],
      ['phantom (silinecek)', tA],
      ['phantom dk', Math.round(tD)],
      ['etkilenen KAPALI OEE kaydı', etkilenenLog.size],
      ...(APPLY ? ([['yedek: duruş satırı', yDurus], ['yedek: OEE satırı', yOee], ['SİLİNDİ', silinen], ['OEE yeniden hesap', oeeYeniden]] as [string, number][]) : []),
    ])
    if (!APPLY) console.log('\nℹ️ DRY-RUN — silme yok. Silmek için: --apply (prod: --apply --prod-onay)')
    await pool.close(); await disconnect()
  } catch (e) {
    await pool.close().catch(() => {}); await disconnect()
    throw e
  }
}

main().catch((e) => { console.error('\n⛔ DUR:', e instanceof Error ? e.message : e); process.exitCode = 1 })
