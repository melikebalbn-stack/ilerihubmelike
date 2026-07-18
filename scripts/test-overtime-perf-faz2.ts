/**
 * Mesai Performans FAZ 2 — uçtan uca test (staging DB).
 * Proration + granularity + üretim ayracı + eksik-veri + hijyen + hurda + yetki.
 * İzole test formları Eylül/Ekim 2026'da kurulur (gerçek veri Haz-Tem), SONUNDA TEMİZLENİR.
 *
 * Kullanım: npx tsx --env-file=/home/rokunet/projects/ilerihub-staging/.env scripts/test-overtime-perf-faz2.ts
 */
import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'
import {
  getDailyPerformance, getWeeklyPerformance, getMonthlyPerformance,
  getMissingDataReport, getDataHygieneWarnings, getScrapMetrics,
} from '@/lib/overtime-performance'

dotenv.config()
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

let pass = 0, fail = 0
const approx = (a: number, b: number) => Math.abs(a - b) < 0.05
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${name}${detail ? ' — ' + detail : ''}`) }
  else { fail++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`) }
}
const U = (y: number, m0: number, d: number) => new Date(Date.UTC(y, m0, d))
const DAY_FORM = 'ZZ-TEST-FAZ2-DAY'
const WEEK_FORM = 'ZZ-TEST-FAZ2-WEEK'
const DEPT = 'MEKANİK MONTAJ' // uretimYapar=true (üretim) bölüm

async function cleanup() {
  const forms = await prisma.overtimeForm.findMany({ where: { formNo: { in: [DAY_FORM, WEEK_FORM] } }, select: { id: true } })
  const ids = forms.map((f) => f.id)
  if (ids.length) {
    await prisma.overtimePersonnel.deleteMany({ where: { overtimeFormId: { in: ids } } })
    await prisma.overtimeForm.deleteMany({ where: { id: { in: ids } } })
  }
}

async function main() {
  console.log(`DB: ${(process.env.DATABASE_URL || '').replace(/:\/\/[^@]+@/, '://***@')}\n`)

  // Gerçek personnel + createdBy (form create için zorunlu FK'ler)
  const personnel = await prisma.personnel.findFirst({ select: { id: true } })
  const creator = await prisma.user.findFirst({ select: { id: true } })
  if (!personnel || !creator) { console.log('❌ personnel/creator yok'); return }

  await cleanup() // önceki kalıntı varsa temizle (idempotent)

  // ── İZOLE TEST FORMLARI (Ağustos/Eylül/Ekim 2026 — gerçek veri yok) ──
  // A) Tek-gün: 2026-08-15 (Eylül aylık testini KİRLETMESİN diye Ağustos'ta), hedef 100 / gerç 90 (%90)
  await prisma.overtimeForm.create({
    data: {
      formNo: DAY_FORM, formTipi: 'MESAI', overtimeType: 'WEEKDAY_EXTRA', date: U(2026, 7, 15),
      vardiyaHaftaMi: false, periodStart: U(2026, 7, 15), periodEnd: U(2026, 7, 15),
      status: 'APPROVED', createdById: creator.id,
      personnel: { create: [{ personnelId: personnel.id, workDepartment: DEPT, hedefAdet: 100, gerceklesenAdet: 90 }] },
    },
  })
  // B) Vardiya-hafta AY SINIRI AŞAN: 2026-09-28(Pzt)→2026-10-02(Cum). Eylül 3 gün + Ekim 2 gün.
  //    hedef 100 / gerç 80 (%80)
  await prisma.overtimeForm.create({
    data: {
      formNo: WEEK_FORM, formTipi: 'VARDIYA', overtimeType: 'WEEKDAY_EXTRA', date: U(2026, 8, 28),
      vardiyaHaftaMi: true, periodStart: U(2026, 8, 28), periodEnd: U(2026, 9, 2),
      status: 'APPROVED', createdById: creator.id,
      personnel: { create: [{ personnelId: personnel.id, workDepartment: DEPT, hedefAdet: 100, gerceklesenAdet: 80 }] },
    },
  })

  const deptOf = (r: { bolumler: { ad: string; hedef: number; gerceklesen: number; yuzde: number }[] }) =>
    r.bolumler.find((b) => b.ad === DEPT)

  // 1) TEK-GÜN → prorate yok, tam değer
  const d1 = await getDailyPerformance(U(2026, 7, 15))
  const b1 = deptOf(d1)
  check('1. Tek-gün form → prorate YOK (hedef=100, gerç=90, %90)',
    !!b1 && approx(b1.hedef, 100) && approx(b1.gerceklesen, 90) && approx(b1.yuzde, 90),
    `hedef=${b1?.hedef} gerç=${b1?.gerceklesen} %${b1?.yuzde}`)

  // 2) VARDİYA-HAFTA HAFTALIK (tam örtüşme) → tam haftaya sayılır
  const w2 = await getWeeklyPerformance(U(2026, 8, 28), U(2026, 9, 4)) // Pzt..Pazar
  const b2 = deptOf(w2)
  check('2. Vardiya-hafta haftalık → TAM sayılır (hedef=100, gerç=80)',
    !!b2 && approx(b2.hedef, 100) && approx(b2.gerceklesen, 80), `hedef=${b2?.hedef} gerç=${b2?.gerceklesen}`)

  // 3) VARDİYA-HAFTA AYLIK, ay sınırı aşan → doğru bölünür, YÜZDE KORUNUR
  const m9 = await getMonthlyPerformance(2026, 9) // Eylül: 3/5
  const m10 = await getMonthlyPerformance(2026, 10) // Ekim: 2/5
  const b9 = deptOf(m9), b10 = deptOf(m10)
  check('3a. Eylül payı (3/5): hedef=60, gerç=48, %80',
    !!b9 && approx(b9.hedef, 60) && approx(b9.gerceklesen, 48) && approx(b9.yuzde, 80),
    `hedef=${b9?.hedef} gerç=${b9?.gerceklesen} %${b9?.yuzde}`)
  check('3b. Ekim payı (2/5): hedef=40, gerç=32, %80',
    !!b10 && approx(b10.hedef, 40) && approx(b10.gerceklesen, 32) && approx(b10.yuzde, 80),
    `hedef=${b10?.hedef} gerç=${b10?.gerceklesen} %${b10?.yuzde}`)
  check('3c. KORUNUM: Eylül+Ekim hedef=100, gerç=80 (tam form) + %80 İKİ ayda da aynı',
    !!b9 && !!b10 && approx(b9.hedef + b10.hedef, 100) && approx(b9.gerceklesen + b10.gerceklesen, 80) && approx(b9.yuzde, 80) && approx(b10.yuzde, 80))

  // 4) VARDİYA-HAFTA GÜNLÜK (hafta içi bir gün) → PRORATE EDİLMEZ, ayrı grupta
  const d4 = await getDailyPerformance(U(2026, 8, 29)) // Salı (hafta içi)
  check('4. Vardiya-hafta günlük görünümde toplama GİRMİYOR (genel.hedef=0)', approx(d4.genel.hedef, 0),
    `genel.hedef=${d4.genel.hedef}`)
  check('4b. Vardiya-hafta AYRI grupta raporlanıyor (vardiyaHaftaAyri, WEEK formu var)',
    !!d4.vardiyaHaftaAyri && d4.vardiyaHaftaAyri.formSayisi >= 1 && d4.vardiyaHaftaAyri.formlar.some((f) => f.formNo === WEEK_FORM))

  // 5) EKSİK-VERİ: üretim bölümlerini kapsar, Bakımhane DIŞLANIR (gerçek Haz-Tem verisi)
  const miss = await getMissingDataReport(U(2026, 5, 1), U(2026, 6, 31))
  check('5. Eksik-veri: BAKIMHANE DIŞLANMIŞ (üretim-dışı)', !miss.some((m) => m.bolum === 'BAKIMHANE'),
    `bölümler: ${miss.map((m) => m.bolum).join(', ')}`)
  check('5b. Eksik-veri: en az bir üretim bölümü eksik satır içeriyor', miss.length > 0 && miss[0].eksikSayisi > 0,
    `${miss.length} bölüm, ilk: ${miss[0]?.bolum}=${miss[0]?.eksikSayisi}`)

  // 6) HİJYEN: uretimYapar=false'a girilmiş hedefler (yalnız BAKIMHANE — Faz 1'de tek false)
  const hyg = await getDataHygieneWarnings(U(2026, 5, 1), U(2026, 6, 31))
  check('6. Hijyen: uretimYapar=false bölüme girilmiş hedefler yakalandı', hyg.length > 0, `${hyg.length} uyarı`)
  check('6b. Hijyen uyarılarının HEPSİ üretim-dışı bölümden (BAKIMHANE) + hedef dolu',
    hyg.every((h) => h.bolum === 'BAKIMHANE' && h.hedefAdet != null),
    `bölümler: ${[...new Set(hyg.map((h) => h.bolum))].join(', ')}`)

  // 7) HURDA: az veriyle hata vermeden çalışır
  const scrap = await getScrapMetrics(U(2026, 5, 1), U(2026, 6, 31))
  check('7. Hurda KPI hata vermeden çalışıyor (toplamHurda sayı, oran null-güvenli)',
    typeof scrap.toplamHurda === 'number' && scrap.toplamHurda >= 0 && (scrap.oran === null || typeof scrap.oran === 'number'),
    `toplamHurda=${scrap.toplamHurda}, oran=${scrap.oran}`)

  // 8) YETKİ: allowedDepts tüm fonksiyonlarda uygulanıyor
  const mAuth = await getMonthlyPerformance(2026, 9, ['YOK_BOLUM'])
  const missAuth = await getMissingDataReport(U(2026, 5, 1), U(2026, 6, 31), ['YOK_BOLUM'])
  const scrapAuth = await getScrapMetrics(U(2026, 5, 1), U(2026, 6, 31), ['YOK_BOLUM'])
  check('8. allowedDepts=[YOK] → aylık boş (genel.hedef=0)', approx(mAuth.genel.hedef, 0))
  check('8b. allowedDepts=[YOK] → eksik-veri boş + hurda boş',
    missAuth.length === 0 && scrapAuth.bolumler.length === 0,
    `miss=${missAuth.length} scrapBolum=${scrapAuth.bolumler.length}`)

  console.log(`\n── SONUÇ: ${pass} PASS, ${fail} FAIL ──`)
  if (fail > 0) process.exitCode = 1
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(async () => { await cleanup(); await prisma.$disconnect(); await pool.end() })
