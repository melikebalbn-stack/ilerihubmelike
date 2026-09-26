/**
 * mola-tohum.ts — IPRO mola takvimini (IproMolaTanim) MAS'tan tohumlar. + IproDurusSebebi.planli senkronu.
 *
 * VARSAYILAN: DRY-RUN (yazma yok, yalnız rapor). Yazma yalnız --apply. İdempotent.
 * DB hedef guard: dev serbest; dev dışı YALNIZ --prod-onay (_guard.ts).
 *
 * Kaynak: Planning.DailyDowntimeCalendar (son 30 gün, Active=1) ⋈ Loss.Downtime (Planned=1)
 *         ⋈ Organization.WorkCenter ⋈ Organization.WorkCenterGroup (grup = bölüm).
 * Saat: MAS datetime duvar saatidir (İstanbul yerel). tedious useUTC:true → getUTCHours/getUTCMinutes
 *       ile HH:mm alınır (masTarih DÖNÜŞÜMÜ UYGULANMAZ — burada UTC an değil, duvar saati lazım).
 * Vardiya: ShiftDefinitionId 1 → VARDIYA-1, 3 → VARDIYA-2; diğerleri raporlanır, YAZILMAZ.
 * Gün maskesi: pencerenin başladığı VARDIYA gününün hafta günü (gece vardiyasında gece yarısı sonrası
 *       pencereler bir önceki güne — shift gününe — sayılır).
 * Kural: aynı pencere TÜM bölümlerde varsa tek satır bolum=null; yoksa bölüm bazlı satırlar.
 *        30 günde 3'ten az görülen pencereler AYRI tabloda listelenir, YAZILMAZ.
 *
 * Çalıştırma:
 *   npx tsx --env-file=.env scripts/ipro/mola-tohum.ts             # DRY-RUN (dev)
 *   npx tsx --env-file=.env scripts/ipro/mola-tohum.ts --apply     # YAZMA (dev)
 *   (prod: --env-file ile MAS + DATABASE_URL prod, ayrıca --apply --prod-onay)
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local', override: true }) // MAS_* prod'da .env.local'da
import sql from 'mssql'
import { createPrisma, banner, summary, parseDryRun, type Prisma } from './_lib'

const APPLY = process.argv.includes('--apply')
const GUN_ADI = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'] // getUTCDay index
const VARDIYA_ESLEME: Record<number, string> = { 1: 'VARDIYA-1', 3: 'VARDIYA-2' }
const SHIFT_BAS_DK: Record<string, number> = {} // vardiya kod → başlangıç dakikası (gece taşma hesabı)

/** getUTCDay (Paz=0..Cmt=6) → bit maskesi Pzt=1..Paz=64. */
function gunBiti(jsGun: number): number {
  return jsGun === 0 ? 64 : 1 << (jsGun - 1)
}
function maskeMetni(m: number): string {
  const out: string[] = []
  for (let i = 0; i < 7; i++) if (m & (1 << i)) out.push(['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'][i])
  return out.join(',') || '—'
}
function hhmm(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

async function masBaglan(): Promise<sql.ConnectionPool> {
  const cfg: sql.config = {
    server: process.env.MAS_HOST!,
    port: Number(process.env.MAS_PORT || 1433),
    database: process.env.MAS_DB!,
    user: process.env.MAS_USER!,
    password: process.env.MAS_PASS!,
    options: {
      encrypt: process.env.MAS_ENCRYPT === 'true' || process.env.MAS_ENCRYPT === '1',
      trustServerCertificate: true,
      enableArithAbort: true,
    },
    connectionTimeout: 15000,
    requestTimeout: 120000,
  }
  if (!cfg.server) throw new Error('DUR: MAS_HOST yok — MAS env (.env.local) yüklenemedi')
  return new sql.ConnectionPool(cfg).connect()
}

interface HamSatir {
  shiftId: number
  downtimeId: number
  downtimeCode: string
  bolum: string | null
  start: Date
  end: Date
}
interface Pencere {
  vardiya: string
  bolum: string | null // null = tüm bölümler
  downtimeId: number
  downtimeCode: string
  hhmm: string
  sureDk: number
  gunMaskesi: number
  gunler: Set<string> // 'YYYY-MM-DD' shift günleri (kaç gün görüldü)
  tezgahlar: Set<string> // ayırt: WorkCenterGroup değil, kaç DISTINCT bölüm/pencere — burada bölüm sayısı
}

async function main(prisma: Prisma, dryRun: boolean) {
  banner('IPRO MOLA TAKVİMİ TOHUM (+planli senkron)', dryRun)
  const pool = await masBaglan()
  try {
    // ── (2) planli senkronu: Loss.Downtime.Planned → IproDurusSebebi.planli (kod eşleşmesi) ──
    const lossRes = await pool.request().query<{ Code: string; Planned: boolean }>(
      `SELECT Code, Planned FROM Loss.Downtime`,
    )
    const plannedByCode = new Map<string, boolean>()
    for (const r of lossRes.recordset) if (r.Code != null) plannedByCode.set(String(r.Code).trim(), !!r.Planned)
    const sebepler = await prisma.iproDurusSebebi.findMany({ select: { id: true, kod: true, planli: true } })
    let planliDegisen = 0
    const planliDetay: string[] = []
    for (const s of sebepler) {
      const hedef = plannedByCode.get(s.kod)
      if (hedef === undefined) continue // MAS'ta karşılığı yok — dokunma
      if (hedef !== s.planli) {
        planliDegisen++
        if (planliDetay.length < 20) planliDetay.push(`${s.kod}: ${s.planli} → ${hedef}`)
        if (APPLY && !dryRun) await prisma.iproDurusSebebi.update({ where: { id: s.id }, data: { planli: hedef } })
      }
    }
    console.log(`\n[planli senkron] MAS'ta karşılığı olan sebep: ${sebepler.filter((s) => plannedByCode.has(s.kod)).length}, değişen: ${planliDegisen}${APPLY && !dryRun ? ' (YAZILDI)' : ' (dry-run)'}`)
    if (planliDetay.length) console.log('   ' + planliDetay.join(' | '))

    // Vardiya başlangıç dakikalarını yükle (gece taşma hesabı için).
    const vardiyalar = await prisma.iproVardiya.findMany({ select: { kod: true, baslangicSaat: true } })
    for (const v of vardiyalar) {
      const [h, m] = v.baslangicSaat.split(':').map(Number)
      SHIFT_BAS_DK[v.kod] = h * 60 + m
    }

    // ── (3) DailyDowntimeCalendar son 30 gün, planlı ──
    const ddc = await pool.request().query<HamSatir>(
      `SELECT dc.ShiftDefinitionId AS shiftId, dc.DowntimeId AS downtimeId, d.Code AS downtimeCode,
              wcg.Code AS bolum, dc.Start AS start, dc.[End] AS [end]
       FROM Planning.DailyDowntimeCalendar dc
       JOIN Loss.Downtime d ON d.Id = dc.DowntimeId
       JOIN Organization.WorkCenter wc ON wc.Id = dc.WorkCenterId
       LEFT JOIN Organization.WorkCenterGroup wcg ON wcg.Id = wc.WorkCenterGroupId
       WHERE dc.Active = 1 AND d.Planned = 1
         AND dc.Start >= DATEADD(day, -30, GETDATE()) AND dc.Start < GETDATE()`,
    )
    console.log(`\n[calendar] planlı DDC satırı (30g): ${ddc.recordset.length}`)

    // Vardiya eşlemesi + gruplama.
    const bilinmeyenShift = new Set<number>()
    const eslesmeyenSebep = new Set<string>()
    const sebepIdByKod = new Map(sebepler.map((s) => [s.kod, s.id]))
    const pencereler = new Map<string, Pencere>()
    const tumBolumler = new Set<string>()

    for (const r of ddc.recordset) {
      const vardiya = VARDIYA_ESLEME[r.shiftId]
      if (!vardiya) { bilinmeyenShift.add(r.shiftId); continue }
      const bolum = r.bolum ? String(r.bolum).trim() : null
      if (bolum) tumBolumler.add(bolum)
      const start = new Date(r.start)
      const end = new Date(r.end)
      const zaman = hhmm(start)
      const sureDk = Math.round((end.getTime() - start.getTime()) / 60000)
      if (sureDk <= 0 || sureDk > 240) continue // bozuk/aşırı süre — ele

      // Shift günü: gece vardiyasında pencere HH:mm shift başlangıcından küçükse önceki gün.
      const wMin = start.getUTCHours() * 60 + start.getUTCMinutes()
      const shiftBasDk = SHIFT_BAS_DK[vardiya] ?? 0
      const geceTasti = vardiya === 'VARDIYA-2' && wMin < shiftBasDk
      const shiftGun = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()) - (geceTasti ? 86400000 : 0))
      const gunKey = shiftGun.toISOString().slice(0, 10)
      const bit = gunBiti(shiftGun.getUTCDay())

      const key = `${vardiya}|${bolum ?? '∅'}|${r.downtimeId}|${zaman}|${sureDk}`
      let p = pencereler.get(key)
      if (!p) {
        p = { vardiya, bolum, downtimeId: r.downtimeId, downtimeCode: String(r.downtimeCode).trim(), hhmm: zaman, sureDk, gunMaskesi: 0, gunler: new Set(), tezgahlar: new Set() }
        pencereler.set(key, p)
      }
      p.gunMaskesi |= bit
      p.gunler.add(gunKey)
      p.tezgahlar.add(bolum ?? '∅')
    }

    // ── Bölüm-bağımsız birleştirme: aynı (vardiya, downtime, hhmm, sureDk, gunMaskesi) TÜM bölümlerde
    //    varsa → tek satır bolum=null. tumBolumler = 30g planlı veride görülen bölümler evreni. ──
    const bolumsuzKey = (p: Pencere) => `${p.vardiya}|${p.downtimeId}|${p.hhmm}|${p.sureDk}|${p.gunMaskesi}`
    const bolumKumeleri = new Map<string, Set<string>>()
    for (const p of pencereler.values()) {
      if (p.bolum === null) continue
      const k = bolumsuzKey(p)
      if (!bolumKumeleri.has(k)) bolumKumeleri.set(k, new Set())
      bolumKumeleri.get(k)!.add(p.bolum)
    }
    const nihai: Pencere[] = []
    const birlestirilenKeys = new Set<string>()
    for (const [k, bolumSet] of bolumKumeleri) {
      if (tumBolumler.size > 0 && bolumSet.size === tumBolumler.size) {
        // tüm bölümlerde var → tek null-bölüm satırı (gün/tezgah birleştir)
        const parcalar = [...pencereler.values()].filter((p) => p.bolum !== null && bolumsuzKey(p) === k)
        const gunler = new Set<string>()
        for (const pp of parcalar) for (const g of pp.gunler) gunler.add(g)
        const ilk = parcalar[0]
        nihai.push({ ...ilk, bolum: null, gunler, tezgahlar: new Set(bolumSet) })
        birlestirilenKeys.add(k)
      }
    }
    for (const p of pencereler.values()) {
      if (p.bolum === null) { nihai.push(p); continue } // zaten MAS'ta null gelen (nadir)
      if (birlestirilenKeys.has(bolumsuzKey(p))) continue // birleştirildi
      nihai.push(p)
    }

    // sebep FK eşlemesi + <3 gün ayrımı
    const yazilacak: (Pencere & { sebepId: string })[] = []
    const azGorulen: Pencere[] = []
    for (const p of nihai) {
      const sebepId = sebepIdByKod.get(p.downtimeCode)
      if (!sebepId) { eslesmeyenSebep.add(`${p.downtimeCode} (downtimeId ${p.downtimeId})`); continue }
      if (p.gunler.size < 3) { azGorulen.push(p); continue }
      yazilacak.push({ ...p, sebepId })
    }

    // ── Dry-run TABLO ──
    console.log('\n══ YAZILACAK PENCERELER (≥3 gün) ══')
    console.log('vardiya   | bölüm        | sebep                    | başl. | dk | gün maskesi          | gün | bölüm#')
    console.log('─'.repeat(110))
    for (const p of yazilacak.sort((a, b) => a.vardiya.localeCompare(b.vardiya) || (a.bolum ?? '').localeCompare(b.bolum ?? '') || a.hhmm.localeCompare(b.hhmm))) {
      console.log(
        `${p.vardiya.padEnd(9)} | ${(p.bolum ?? 'TÜMÜ').padEnd(12)} | ${(p.downtimeCode + ' ').padEnd(24)} | ${p.hhmm} | ${String(p.sureDk).padStart(2)} | ${maskeMetni(p.gunMaskesi).padEnd(20)} | ${String(p.gunler.size).padStart(3)} | ${p.tezgahlar.size}`,
      )
    }
    console.log(`\n(toplam yazılacak: ${yazilacak.length})`)

    if (azGorulen.length) {
      console.log('\n══ 30 GÜNDE <3 GÜN GÖRÜLEN — YAZILMAZ ══')
      for (const p of azGorulen.sort((a, b) => b.gunler.size - a.gunler.size)) {
        console.log(`   ${p.vardiya} | ${p.bolum ?? 'TÜMÜ'} | ${p.downtimeCode} | ${p.hhmm} | ${p.sureDk}dk | ${maskeMetni(p.gunMaskesi)} | gün=${p.gunler.size}`)
      }
    }
    if (bilinmeyenShift.size) console.log(`\n⚠️ eşlenmeyen ShiftDefinitionId (YAZILMADI): ${[...bilinmeyenShift].join(', ')}`)
    if (eslesmeyenSebep.size) {
      console.log(`\n⚠️ IPRO sebebi bulunmayan MAS duruş kodları (YAZILMADI):`)
      for (const s of eslesmeyenSebep) console.log('   - ' + s)
    }

    // ── (--apply) YAZMA: idempotent upsert (null bölümde findFirst+create/update) ──
    let acilan = 0, guncellenen = 0
    if (APPLY && !dryRun) {
      for (const p of yazilacak) {
        const vardiyaRow = await prisma.iproVardiya.findUnique({ where: { kod: p.vardiya }, select: { id: true } })
        if (!vardiyaRow) { console.warn(`   ⚠️ vardiya yok: ${p.vardiya}`); continue }
        const data = {
          vardiyaId: vardiyaRow.id, bolum: p.bolum, sebepId: p.sebepId, baslangic: p.hhmm,
          sureDk: p.sureDk, gunMaskesi: p.gunMaskesi, aktif: true, masDowntimeId: p.downtimeId,
        }
        const mevcut = await prisma.iproMolaTanim.findFirst({
          where: { vardiyaId: vardiyaRow.id, bolum: p.bolum, sebepId: p.sebepId, baslangic: p.hhmm, gunMaskesi: p.gunMaskesi },
          select: { id: true },
        })
        if (mevcut) {
          await prisma.iproMolaTanim.update({ where: { id: mevcut.id }, data: { sureDk: p.sureDk, aktif: true, masDowntimeId: p.downtimeId } })
          guncellenen++
        } else {
          await prisma.iproMolaTanim.create({ data })
          acilan++
        }
      }
    }

    summary([
      ['DDC planlı satır (30g)', ddc.recordset.length],
      ['planli senkron değişen', planliDegisen],
      ['aday pencere (gruplu)', pencereler.size],
      ['yazılacak (≥3 gün)', yazilacak.length],
      ['<3 gün (atlandı)', azGorulen.length],
      ['eşlenmeyen sebep', eslesmeyenSebep.size],
      ['bilinmeyen shift', bilinmeyenShift.size],
      ...(APPLY && !dryRun ? ([['YENİ yazıldı', acilan], ['güncellendi', guncellenen]] as [string, number][]) : []),
    ])
    if (!APPLY) console.log('\nℹ️ DRY-RUN — hiçbir şey yazılmadı. Yazmak için: --apply (prod: --apply --prod-onay)')
  } finally {
    await pool.close()
  }
}

// runCli --dry-run bayrağına bakar; biz APPLY yoksa dry-run kabul ederiz (varsayılan güvenli).
const dryRun = !APPLY || parseDryRun()
const { prisma, disconnect } = createPrisma()
main(prisma, dryRun)
  .catch((e) => { console.error('\n⛔ DUR:', e instanceof Error ? e.message : e); process.exitCode = 1 })
  .finally(() => disconnect())
