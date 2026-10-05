/**
 * uretim-gecmis-aktar.ts — MAS'ta IPRO aynası başlamadan ÖNCE yapılmış üretimleri IPRO'ya bir kerelik aktarır.
 *
 * Sorun: tezgah detayındaki "iş emri toplamı" IPRO'daki logların Σ qtyComplete'i. MAS aynası yalnız
 * başladığı andan sonraki üretimleri yazdı; aynı iş emrine daha önce (ör. 12.08 CN01) yapılan üretim
 * IPRO'da yok → MAS 332, IPRO 143 (M002262469/20).
 *
 * Kapsam (hedef iş emirleri): IPRO'da kaynak=MAS ve (AÇIK VEYA son --gun N günde kapanmış) logu olan
 * iş emirleri. Tek iş emri için: --is-emri M002262469.
 * Her hedef iş emri için MAS'taki KAPALI ProductionMaster'lar okunur; IPRO'da karşılığı yoksa:
 *  - kapalı oturum (girisAt=MAS başlangıç, cikisAt=MAS bitiş) + KAPALI log (kaynak=MAS, hesapKaynagi=MAS_GECMIS) açılır.
 *  - IFS'e YAZILMAZ: ifsCompleteYazildi=true, ifsScrapYazildi=true, ifsYazildi=true (geçmiş üretim IFS'e
 *    zaten kendi yolundan gitti; cron tekrar raporlamasın).
 *  - OEE kaydı HESAPLANMAZ (geçmiş duruşlar aynalanmadı → kullanılabilirlik yanlış çıkar).
 * Varsayılan YALNIZ ayna başlangıcından (ilk kaynak=MAS log) önce biten üretimler; sonrası "ayna boşluğu" olarak
 * raporlanır (--ayna-sonrasi-dahil ile o da aktarılır).
 * Atlananlar: adet 0, tezgah eşleşmeyen, operatör eşleşmeyen, aynı tezgahta aynı iş emri için zaman
 * olarak çakışan IPRO logu olan (kiosk/terminal ile girilmiş olabilir — çift sayım olmasın).
 *
 * VARSAYILAN DRY-RUN. Yazma: --apply (+ dev dışı --prod-onay). İdempotent (ipro_prodlog_mas_uq).
 * Geri alma: aktarılan loglar hesapKaynagi='MAS_GECMIS' ile işaretli; oturumları yalnız bu loglara bağlı.
 * MAS SALT OKUMA (inline mssql).
 *
 *   npx tsx scripts/ipro/uretim-gecmis-aktar.ts [--gun 30] [--is-emri M002262469]
 *   DATABASE_URL=<prod> npx tsx scripts/ipro/uretim-gecmis-aktar.ts --apply --prod-onay
 */
import sql from 'mssql'
import { createPrisma, banner, summary } from './_lib'
import { masTarih } from '../../src/lib/mas/tarih'
import { saniyeToCevrim } from '../../src/lib/ipro/cevrim-util'
import { isEmirineGrupla, employeeNoToSicilNo, type MasUretimGirdi } from '../../src/lib/entegrasyon/mas/uretim-mapper'

const APPLY = process.argv.includes('--apply')
const arg = (ad: string) => {
  const i = process.argv.indexOf(ad)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const GUN = (() => {
  const n = Number(arg('--gun') ?? 30)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 30
})()
const TEK_IS_EMRI = arg('--is-emri')?.trim() || null
const ISARET = 'MAS_GECMIS' // hesapKaynagi işareti (geri alma: WHERE "hesapKaynagi"='MAS_GECMIS')

type MasSatir = {
  masId: number
  masDetayId: number | null
  startDateTime: Date | null
  endDateTime: Date | null
  tezgahKod: string | null
  workOrderNo: string | null
  operasyonNo: string | null
  description: string | null
  partNo: string | null
  planlananAdet: number | null
  deliveryDateTime: Date | null
  amount: number | null
  reportedAmount: number | null
  cycleTime: number | null
  counterMultiplier: number | null
  isFinished: boolean | null
}

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

/** IN listesi 500'lük dilimlerle (parametreli). */
async function dilimli<T>(pool: sql.ConnectionPool, degerler: (string | number)[], tip: 'str' | 'int', sorgu: (inList: string) => string): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < degerler.length; i += 500) {
    const rq = pool.request()
    const params = degerler.slice(i, i + 500).map((v, j) => {
      rq.input(`p${j}`, tip === 'int' ? sql.Int : sql.NVarChar(64), v)
      return `@p${j}`
    })
    const r = await rq.query<T>(sorgu(params.join(',')))
    out.push(...r.recordset)
  }
  return out
}

async function main() {
  banner(`IPRO ÜRETİM GEÇMİŞ AKTARIMI (${TEK_IS_EMRI ?? `açık + son ${GUN} gün iş emirleri`})`, !APPLY)
  const { prisma, disconnect } = createPrisma()
  const pool = await masBaglan()
  try {
    // 1) Hedef iş emirleri
    let hedef: string[]
    if (TEK_IS_EMRI) hedef = [TEK_IS_EMRI]
    else {
      const sinir = new Date(Date.now() - GUN * 86400_000)
      const rows = await prisma.iproProductionLog.findMany({
        where: { kaynak: 'MAS', ifsOrderNo: { not: null }, OR: [{ durum: 'ACIK' }, { bitirildiAt: { gte: sinir } }] },
        select: { ifsOrderNo: true },
        distinct: ['ifsOrderNo'],
      })
      hedef = rows.map((r) => r.ifsOrderNo!).filter(Boolean)
    }
    const hedefSet = new Set(hedef)

    // Ayna başlangıcı: ilk kaynak=MAS log. Varsayılan YALNIZ bundan önce biten MAS üretimleri aktarılır;
    // sonrasındaki eksikler ayna boşluğudur (operatör/tezgah eşleşmedi, açık iş çakışması…) → yalnız raporlanır.
    // Hepsini aktarmak için: --ayna-sonrasi-dahil
    const ilkMas = await prisma.iproProductionLog.findFirst({ where: { kaynak: 'MAS', baslatildiAt: { not: null } }, orderBy: { baslatildiAt: 'asc' }, select: { baslatildiAt: true } })
    const aynaBas = ilkMas?.baslatildiAt ?? new Date()
    const SONRASI_DAHIL = process.argv.includes('--ayna-sonrasi-dahil')

    // 2) MAS: hedef iş emirlerinin KAPALI üretimleri (açıklar canlı aynanın işi)
    const masHam = await dilimli<MasSatir>(pool, hedef, 'str', (inList) =>
      `SELECT pm.Id AS masId, pd.Id AS masDetayId, pm.StartDateTime AS startDateTime, pm.EndDateTime AS endDateTime, ` +
      `wc.Code AS tezgahKod, wo.WorkOrderNo AS workOrderNo, o.Code AS operasyonNo, wo.Description AS description, ` +
      `mt.Code AS partNo, wo.Amount AS planlananAdet, wo.DeliveryDateTime AS deliveryDateTime, pd.Amount AS amount, ` +
      `pd.ReportedAmount AS reportedAmount, COALESCE(pd.CycleTime, wo.CycleTime) AS cycleTime, ` +
      `pd.CounterMultiplier AS counterMultiplier, pd.IsFinished AS isFinished ` +
      `FROM Production.ProductionMaster pm ` +
      `JOIN Organization.WorkCenter wc ON wc.Id = pm.WorkCenterId ` +
      `JOIN Production.ProductionDetail pd ON pd.ProductionMasterId = pm.Id AND pd.Active = 1 ` +
      `JOIN Planning.WorkOrder wo ON wo.Id = pd.WorkOrderId ` +
      `LEFT JOIN Inventory.Material mt ON mt.Id = wo.MaterialId ` +
      `LEFT JOIN Phase.Operation o ON o.Id = wo.OperationId ` +
      `WHERE pm.Active = 1 AND pm.EndDateTime IS NOT NULL AND wo.WorkOrderNo IN (${inList})`,
    )
    const masSatir = masHam.map((r) => ({
      ...r,
      tezgahKod: r.tezgahKod ? String(r.tezgahKod).trim() : null,
      workOrderNo: r.workOrderNo ? String(r.workOrderNo).trim() : null,
      startDateTime: masTarih(r.startDateTime),
      endDateTime: masTarih(r.endDateTime),
      deliveryDateTime: masTarih(r.deliveryDateTime),
    }))
    const satirByMas = new Map<number, typeof masSatir>()
    for (const r of masSatir) satirByMas.set(r.masId, [...(satirByMas.get(r.masId) ?? []), r])
    const masIds = [...satirByMas.keys()]

    // 3) Operatörler (ProductionUser — en erken başlayan)
    const opHam = masIds.length
      ? await dilimli<{ masId: number; employeeNo: string | null; bas: Date | null }>(pool, masIds, 'int', (inList) =>
          `SELECT pu.ProductionMasterId AS masId, u.EmployeeNo AS employeeNo, pu.StartDateTime AS bas ` +
          `FROM Production.ProductionUser pu JOIN Auth.[User] u ON u.Id = pu.UserId ` +
          `WHERE pu.Active = 1 AND pu.ProductionMasterId IN (${inList})`,
        )
      : []
    const opByMas = new Map<number, string>()
    for (const o of [...opHam].sort((a, b) => (a.bas?.getTime() ?? 0) - (b.bas?.getTime() ?? 0)))
      if (o.employeeNo && !opByMas.has(o.masId)) opByMas.set(o.masId, String(o.employeeNo))

    // 4) IPRO referansları
    const [tezgahlar, personeller, mevcutMas, mevcutIsEmri] = await Promise.all([
      prisma.iproTezgah.findMany({ select: { id: true, kod: true } }),
      prisma.personnel.findMany({ select: { id: true, sicilNo: true } }),
      prisma.iproProductionLog.findMany({ where: { masProductionMasterId: { in: masIds } }, select: { masProductionMasterId: true, ifsOrderNo: true } }),
      prisma.iproProductionLog.findMany({
        where: { ifsOrderNo: { in: hedef } },
        select: { tezgahId: true, ifsOrderNo: true, baslatildiAt: true, bitirildiAt: true },
      }),
    ])
    const tezgahByKod = new Map(tezgahlar.map((t) => [t.kod, t.id]))
    const personBySicil = new Map(personeller.map((p) => [p.sicilNo, p.id]))
    const mevcutAnahtar = new Set(mevcutMas.map((m) => `${m.masProductionMasterId}|${m.ifsOrderNo}`))

    // 5) Plan
    type Aday = {
      masId: number; tezgahId: string; tezgahKod: string; personnelId: string; ifsOrderNo: string; ifsOperationNo: number | null
      bas: Date; bit: Date; adet: number; meta: (typeof masSatir)[number]; carpan: number | null; tamamlandi: boolean
    }
    const adaylar: Aday[] = []
    const atlanan: { sebep: string; detay: string }[] = []
    let zatenVar = 0
    const aynaBoslugu: { etiket: string; tezgahKod: string; bas: Date; bit: Date; adet: number }[] = []
    for (const [masId, satirlar] of satirByMas) {
      const girdiler: MasUretimGirdi[] = satirlar.map((s) => ({
        masId, tezgahKod: s.tezgahKod, employeeNo: opByMas.get(masId) ?? null, workOrderNo: s.workOrderNo,
        operasyonNo: s.operasyonNo, amount: s.amount, reportedAmount: s.reportedAmount,
      }))
      for (const g of isEmirineGrupla(girdiler)) {
        if (!g.workOrderNo || !hedefSet.has(g.workOrderNo)) continue
        const etiket = `${g.workOrderNo} mas=${masId} ${g.tezgahKod ?? '—'}`
        if (mevcutAnahtar.has(`${masId}|${g.workOrderNo}`)) { zatenVar++; continue }
        const meta = satirlar.find((s) => s.workOrderNo === g.workOrderNo) ?? satirlar[0]
        const adet = Math.round(g.adet)
        if (adet <= 0) { atlanan.push({ sebep: 'adet_0', detay: etiket }); continue }
        if (!meta.startDateTime || !meta.endDateTime) { atlanan.push({ sebep: 'tarih_yok', detay: etiket }); continue }
        const tezgahId = g.tezgahKod ? tezgahByKod.get(g.tezgahKod) : undefined
        if (!tezgahId) { atlanan.push({ sebep: 'tezgah_yok', detay: etiket }); continue }
        const sicil = employeeNoToSicilNo(g.employeeNo)
        const personnelId = sicil ? personBySicil.get(sicil) : undefined
        if (!personnelId) { atlanan.push({ sebep: 'operator_yok', detay: `${etiket} emp=${g.employeeNo ?? '—'}` }); continue }
        const bas = meta.startDateTime, bit = meta.endDateTime
        const cakisan = mevcutIsEmri.some((l) => l.tezgahId === tezgahId && l.ifsOrderNo === g.workOrderNo && l.baslatildiAt
          && l.baslatildiAt.getTime() < bit.getTime() && bas.getTime() < (l.bitirildiAt ?? new Date()).getTime())
        if (cakisan) { atlanan.push({ sebep: 'cakisan_ipro_logu', detay: etiket }); continue }
        if (!SONRASI_DAHIL && bit.getTime() > aynaBas.getTime()) {
          aynaBoslugu.push({ etiket, tezgahKod: g.tezgahKod!, bas, bit, adet })
          continue
        }
        adaylar.push({
          masId, tezgahId, tezgahKod: g.tezgahKod!, personnelId, ifsOrderNo: g.workOrderNo,
          ifsOperationNo: g.operasyonNo ? Number(g.operasyonNo) : null, bas, bit, adet, meta,
          carpan: meta.counterMultiplier != null ? Math.round(meta.counterMultiplier) : null,
          tamamlandi: satirlar.some((s) => !!s.isFinished),
        })
      }
    }

    // 6) Rapor
    console.log(`\nayna başlangıcı (ilk kaynak=MAS log): ${aynaBas.toISOString()}`)
    if (aynaBoslugu.length) {
      const gun = new Map<string, { kayit: number; adet: number }>()
      for (const b of aynaBoslugu) { const k = b.bit.toISOString().slice(0, 10); const c = gun.get(k) ?? { kayit: 0, adet: 0 }; c.kayit++; c.adet += b.adet; gun.set(k, c) }
      console.log('\n== AYNA SONRASI EKSİK (aktarılmaz, rapor) — gün bazında ==')
      for (const [k, v] of [...gun].sort()) console.log(`  ${k} | kayıt=${v.kayit} adet=${v.adet}`)
      console.log('  örnek (ilk 15):')
      for (const b of aynaBoslugu.slice(0, 15)) console.log(`  ${b.etiket} | ${b.bas.toISOString()} → ${b.bit.toISOString()} | adet=${b.adet}`)
    }
    const isEmriOzet = new Map<string, { kayit: number; adet: number }>()
    for (const a of adaylar) {
      const k = `${a.ifsOrderNo}/${a.ifsOperationNo ?? '—'}`
      const c = isEmriOzet.get(k) ?? { kayit: 0, adet: 0 }
      c.kayit++; c.adet += a.adet
      isEmriOzet.set(k, c)
    }
    console.log('\n== AKTARILACAK (iş emri/op bazında, adet azalan, ilk 30) ==')
    console.log('  iş emri/op | kayıt | adet')
    for (const [k, v] of [...isEmriOzet].sort((a, b) => b[1].adet - a[1].adet).slice(0, 30)) console.log(`  ${k} | ${v.kayit} | ${v.adet}`)
    const ay = new Map<string, number>()
    for (const a of adaylar) { const k = a.bas.toISOString().slice(0, 7); ay.set(k, (ay.get(k) ?? 0) + a.adet) }
    console.log('\n== AKTARILACAK adet — ay bazında ==')
    for (const [k, v] of [...ay].sort()) console.log(`  ${k} | ${v}`)
    const sebepSay = new Map<string, number>()
    for (const x of atlanan) sebepSay.set(x.sebep, (sebepSay.get(x.sebep) ?? 0) + 1)
    if (atlanan.length) {
      console.log('\n== ATLANAN (ilk 20) ==')
      for (const x of atlanan.slice(0, 20)) console.log(`  ${x.sebep} | ${x.detay}`)
    }

    // 7) Yaz
    let olusan = 0, hata = 0
    if (APPLY) {
      for (const a of adaylar) {
        try {
          const cevrim = saniyeToCevrim(a.meta.cycleTime ?? null)
          await prisma.$transaction(async (tx) => {
            const ses = await tx.iproOperatorSession.create({
              data: { tezgahId: a.tezgahId, personnelId: a.personnelId, authMethod: 'LIST', girisAt: a.bas, cikisAt: a.bit },
              select: { id: true },
            })
            await tx.iproProductionLog.create({
              data: {
                tezgahId: a.tezgahId, sessionId: ses.id, personnelId: a.personnelId, kaynak: 'MAS',
                masProductionMasterId: a.masId, masProductionDetayId: a.meta.masDetayId ?? null,
                ifsOrderNo: a.ifsOrderNo, ifsOperationNo: a.ifsOperationNo, durum: 'KAPALI',
                baslatildiAt: a.bas, bitirildiAt: a.bit, tamamlandi: a.tamamlandi,
                ifsPartNo: a.meta.partNo ?? null, ifsPartDescription: a.meta.description ?? null,
                ifsQtyDue: a.meta.planlananAdet != null ? Math.round(a.meta.planlananAdet) : null,
                ifsDueDate: a.meta.deliveryDateTime ?? null,
                ifsMachRunFactor: cevrim?.faktor ?? null, ifsRunTimeCode: cevrim?.kod ?? null,
                qtyComplete: a.adet, uretimAdet: a.adet, qtyScrap: 0, masCarpan: a.carpan, hesapKaynagi: ISARET,
                ifsCompleteYazildi: true, ifsScrapYazildi: true, ifsYazildi: true,
              },
            })
          })
          olusan++
        } catch (e) {
          hata++
          console.warn(`  ⚠️ ${a.ifsOrderNo} mas=${a.masId}: ${(e as Error).message.slice(0, 160)}`)
        }
      }
    }

    summary([
      ['hedef iş emri', hedef.length],
      ['MAS kapalı üretim (hedef iş emirleri)', masIds.length],
      ['IPRO\'da zaten var', zatenVar],
      ['aktarılacak kayıt', adaylar.length],
      ['aktarılacak adet', adaylar.reduce((s, a) => s + a.adet, 0)],
      ['ayna sonrası eksik kayıt (aktarılmaz)', aynaBoslugu.length],
      ['ayna sonrası eksik adet (aktarılmaz)', aynaBoslugu.reduce((s, a) => s + a.adet, 0)],
      ...[...sebepSay].map(([k, v]) => [`atlanan: ${k}`, v] as [string, number]),
      ...(APPLY ? ([['oluşturulan', olusan], ['hata', hata]] as [string, number][]) : []),
    ])
    if (!APPLY) console.log('\nℹ️ DRY-RUN — yazma yok. Yazmak için: --apply (prod: --apply --prod-onay)')
    await pool.close(); await disconnect()
  } catch (e) {
    await pool.close().catch(() => {}); await disconnect()
    throw e
  }
}

main().catch((e) => { console.error('\n⛔ DUR:', e instanceof Error ? e.message : e); process.exitCode = 1 })
