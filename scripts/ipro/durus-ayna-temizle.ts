/**
 * durus-ayna-temizle.ts — MAS aynasında "başlangıç uydurulmuş" (phantom) duruş kayıtlarını temizler.
 * PHANTOM = IPRO kaynak=MAS duruş, baslangic'i MAS'taki o sebep kodunun EN YENİ StartDateTime'ından
 * 2 günden fazla sonra (veya MAS'ta o kod hiç yok) → gerçek MAS duruşuna karşılık gelmiyor (simdi ile uydurulmuş).
 * Silinen duruşların iş penceresine değdiği KAPALI IproOeeKaydi'leri yeniden hesaplanır (durusSaniye düzelir).
 *
 * VARSAYILAN DRY-RUN. Yazma: --apply (+ dev dışı --prod-onay). İdempotent.
 * MAS SALT OKUMA (inline mssql). MARJ günü --marj ile (varsayılan 2).
 *
 *   npx tsx scripts/ipro/durus-ayna-temizle.ts
 *   DATABASE_URL=<prod> npx tsx scripts/ipro/durus-ayna-temizle.ts --apply --prod-onay
 */
import sql from 'mssql'
import { createPrisma, banner, summary } from './_lib'
import { oeeKaydiHesaplaVeYaz } from '../../src/lib/ipro/oee-hesap'
import { masTarih } from '../../src/lib/mas/tarih'

const APPLY = process.argv.includes('--apply')
const MARJ_GUN = 2

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
    // MAS: her Loss.Downtime.Code için en yeni ProductionDowntime.StartDateTime
    const mr = await pool.request().query<{ code: string; enYeni: Date | null }>(
      `SELECT d.Code code, MAX(pd.StartDateTime) enYeni FROM Production.ProductionDowntime pd JOIN Loss.Downtime d ON d.Id=pd.DowntimeId GROUP BY d.Code`)
    // MAS StartDateTime TZ'siz (İstanbul yerel) → masTarih() ile gerçek instant'a çevir (IPRO baslangic böyle yazıldı).
    const masEnYeni = new Map<string, number | null>()
    for (const r of mr.recordset) {
      const inst = r.enYeni ? masTarih(new Date(r.enYeni)) : null
      masEnYeni.set(String(r.code).trim(), inst ? inst.getTime() : null)
    }

    // IPRO kaynak=MAS duruşlar + sebep erpKodu (MAS Code eşleşmesi)
    const duruslar = await prisma.iproMachineDowntime.findMany({
      where: { kaynak: 'MAS' },
      select: { id: true, tezgahId: true, baslangic: true, bitis: true, durusSebebi: { select: { ad: true, erpKodu: true } } },
    })
    const marjMs = MARJ_GUN * 86400000
    type Ph = { id: string; tezgahId: string; baslangic: Date; bitis: Date | null; ad: string }
    const phantom: Ph[] = []
    const sebepOzet = new Map<string, { adet: number; dk: number; acik: number }>()
    const simdi = Date.now()
    for (const d of duruslar) {
      const kod = d.durusSebebi?.erpKodu ?? null
      const enYeni = kod ? masEnYeni.get(kod) : undefined
      // phantom: kod MAS'ta yok VEYA en-yeni null VEYA baslangic en-yeniden marj'dan fazla sonra
      const fab = !kod || enYeni === undefined || enYeni === null || d.baslangic.getTime() - enYeni > marjMs
      if (!fab) continue
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
        const oeeVar = await prisma.iproOeeKaydi.findMany({ where: { productionLogId: { in: [...degen] } }, select: { productionLogId: true } })
        for (const o of oeeVar) etkilenenLog.add(o.productionLogId)
      }
    }

    console.log('\n== SİLİNECEK phantom duruş (sebep bazında) ==')
    let tA = 0, tD = 0
    for (const [k, v] of [...sebepOzet.entries()].sort((a, b) => b[1].dk - a[1].dk)) { console.log(`  ${k} | adet=${v.adet} dk=${Math.round(v.dk)} açık=${v.acik}`); tA += v.adet; tD += v.dk }

    let silinen = 0, oeeYeniden = 0
    if (APPLY) {
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
      ...(APPLY ? ([['SİLİNDİ', silinen], ['OEE yeniden hesap', oeeYeniden]] as [string, number][]) : []),
    ])
    if (!APPLY) console.log('\nℹ️ DRY-RUN — silme yok. Silmek için: --apply (prod: --apply --prod-onay)')
    await pool.close(); await disconnect()
  } catch (e) {
    await pool.close().catch(() => {}); await disconnect()
    throw e
  }
}

main().catch((e) => { console.error('\n⛔ DUR:', e instanceof Error ? e.message : e); process.exitCode = 1 })
