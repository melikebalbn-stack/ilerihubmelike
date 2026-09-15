/**
 * scripts/kpi-ik-import.ts
 * ILERIHub — İK (İnsan Varlıkları) KPI verilerini Excel'den
 * (YENİ KPI 15.10.2024.xlsx) okuyup KPIDefinition / KPIMeasurement /
 * KPIAction tablolarına yazar.
 *
 * Kullanım:
 *   npx tsx --env-file=.env.local scripts/kpi-ik-import.ts dry
 *   npx tsx --env-file=.env.local scripts/kpi-ik-import.ts all
 */

import * as XLSX from 'xlsx'
import { prisma } from '../src/lib/prisma'

const EXCEL_PATH = process.env.KPI_EXCEL_PATH || './YENI_KPI_ik.xlsx'
const DEPARTMAN_SHEET = 'İNSAN-VARLIKLARI (2026)'
const AKSIYON_SHEETS = ['Aksiyon', 'Aksiyon (2025)', 'Aksiyon (2026)']
const DEPARTMAN_ADI_EXCEL = /nsan\s*varl/i

// Pilot İK departmanının gerçek OrgUnit id'si (level: 3, Müdürlük seviyesi)
const ORG_UNIT_ID_IK = 'cmrzg1kr600037jpe4ge6rxe0' // İnsan Varlıkları Müdürlüğü

const KPI_DIRECTION: Record<string, 'higher_is_better' | 'lower_is_better'> = {
  'Fazla Mesai': 'lower_is_better',
  'Çalışan Başına Öneri': 'higher_is_better',
  'İç Müşteri Memnuniyeti': 'higher_is_better',
  'İnsan kaynağı Talep Karşılama Süresi (Hafta)': 'lower_is_better',
  'Kaza Sıklığı': 'lower_is_better',
  'Beyaz Yaka Kişi Başı Eğitim Saati (Yıllık) 30 Saat Aylık Hedef 30/12': 'higher_is_better',
  'Mavi Yaka Kişi Başı Eğitim Saati (Yıllık) 25 Saat Aylık Hedef 25/12': 'higher_is_better',
  'Personel Devamsızlık Oranı': 'lower_is_better',
  'Personel Devir Oranı (Yıllık) %25 AYLIK HEDEF 25/12': 'lower_is_better',
}

const AY_ADI_NO: Record<string, number> = {
  OCAK: 1, ŞUBAT: 2, MART: 3, NİSAN: 4, MAYIS: 5, HAZİRAN: 6,
  TEMMUZ: 7, AĞUSTOS: 8, EYLÜL: 9, EKİM: 10, KASIM: 11, ARALIK: 12,
}

interface KpiTanimi {
  name: string
  unit: string | null
  direction: 'higher_is_better' | 'lower_is_better' | 'unknown'
}

interface KpiOlcum {
  kpiName: string
  year: number
  month: number
  target: number | null
  actual: number | null
}

interface KpiOrtalama {
  kpiName: string
  year: number
  average: number
}

interface KpiAksiyon {
  kpiName: string
  no: number | null
  reason: string | null
  action: string | null
  responsible: string | null
  startDate: Date | null
  endDate: Date | null
  completionPercent: number | null
}

function excelSerialToDate(v: unknown): Date | null {
  if (v instanceof Date) return v
  if (typeof v === 'number') {
    const epoch = new Date(Date.UTC(1899, 11, 30))
    return new Date(epoch.getTime() + v * 86400000)
  }
  return null
}

function hucre(ws: XLSX.WorkSheet, kolon: string, satir: number): unknown {
  const c = ws[`${kolon}${satir}`]
  return c ? c.v : undefined
}

function parseDepartmanSheet(wb: XLSX.WorkBook): { tanimlar: KpiTanimi[]; olcumler: KpiOlcum[]; ortalamalar: KpiOrtalama[] } {
  const ws = wb.Sheets[DEPARTMAN_SHEET]
  if (!ws) throw new Error(`Sheet bulunamadı: ${DEPARTMAN_SHEET}`)
  const ref = ws['!ref']
  if (!ref) throw new Error('Sheet boş görünüyor (!ref yok)')
  const range = XLSX.utils.decode_range(ref)
  const sonSatir = range.e.r + 1

  const ayKolon: Record<string, string> = {}
  const yilOrtKolon: Record<number, string> = {}
  for (let ci = range.s.c; ci <= range.e.c; ci++) {
    const kolonHarfi = XLSX.utils.encode_col(ci)
    const h = hucre(ws, kolonHarfi, 1)
    if (typeof h === 'string' && AY_ADI_NO[h.trim().toUpperCase()]) {
      ayKolon[h.trim().toUpperCase()] = kolonHarfi
    }
    if (typeof h === 'string') {
      const m = h.trim().match(/^(\d{4})\s*Ort\.?$/i)
      if (m) yilOrtKolon[Number(m[1])] = kolonHarfi
    }
  }

  const tanimlar: KpiTanimi[] = []
  const olcumler: KpiOlcum[] = []
  const ortalamalar: KpiOrtalama[] = []
  let currentKpi: string | null = null
  let currentYear: number | null = null
  const gorulenGercek = new Set<string>()

  for (let r = 2; r <= sonSatir; r++) {
    const kpiCell = hucre(ws, 'B', r)
    const yilCell = hucre(ws, 'C', r)
    const tipCell = hucre(ws, 'D', r)

    if (typeof kpiCell === 'string' && kpiCell.trim() && kpiCell.trim() !== 'KPI') {
      currentKpi = kpiCell.trim()
      currentYear = null
      tanimlar.push({ name: currentKpi, unit: null, direction: KPI_DIRECTION[currentKpi] ?? 'unknown' })
      // Yıllık ortalamalar (2020 Ort... vb.) sadece KPI'nın ilk satırında dolu gelir
      for (const [yil, kolonHarfi] of Object.entries(yilOrtKolon)) {
        const deger = hucre(ws, kolonHarfi, r)
        if (typeof deger === 'number') {
          ortalamalar.push({ kpiName: currentKpi, year: Number(yil), average: deger })
        }
      }
    }
    if (typeof yilCell === 'number') currentYear = yilCell
    if (!currentKpi || !currentYear || typeof tipCell !== 'string') continue
    if (tipCell !== 'Hedef' && tipCell !== 'Gerçekleşen') continue

    const key = `${currentKpi}|${currentYear}`
    if (tipCell === 'Gerçekleşen') {
      if (gorulenGercek.has(key)) continue
      gorulenGercek.add(key)
    }

    for (const [ayAdi, ayNo] of Object.entries(AY_ADI_NO)) {
      const kolonHarfi = ayKolon[ayAdi]
      if (!kolonHarfi) continue
      const deger = hucre(ws, kolonHarfi, r)
      if (typeof deger !== 'number') continue

      let mevcut = olcumler.find(o => o.kpiName === currentKpi && o.year === currentYear && o.month === ayNo)
      if (!mevcut) {
        mevcut = { kpiName: currentKpi, year: currentYear, month: ayNo, target: null, actual: null }
        olcumler.push(mevcut)
      }
      if (tipCell === 'Hedef') mevcut.target = deger
      else mevcut.actual = deger
    }
  }
  return { tanimlar, olcumler, ortalamalar }
}

/** İK OrgUnit'inin altındaki tüm pozisyonları (recursive) bulur — Aksiyon'daki
 *  "Sorumlu" ismini bu departmanın ALTINDAKİ kişilerle eşleştirmek için. */
async function ikAltOrgUnitIdleri(): Promise<string[]> {
  const sonuc: string[] = [ORG_UNIT_ID_IK]
  let seviye = [ORG_UNIT_ID_IK]
  while (seviye.length > 0) {
    const cocuklar = await prisma.orgUnit.findMany({
      where: { parentId: { in: seviye } },
      select: { id: true },
    })
    if (cocuklar.length === 0) break
    seviye = cocuklar.map(c => c.id)
    sonuc.push(...seviye)
  }
  return sonuc
}

function isimNormalize(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/İ/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

function parseAksiyonSheets(wb: XLSX.WorkBook): KpiAksiyon[] {
  const sonuc: KpiAksiyon[] = []
  for (const sheetName of AKSIYON_SHEETS) {
    const ws = wb.Sheets[sheetName]
    if (!ws) continue
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })
    for (let r = 4; r < rows.length; r++) {
      const row = (rows[r] || []) as unknown[]
      const departman = row[0]
      if (typeof departman !== 'string' || !DEPARTMAN_ADI_EXCEL.test(departman)) continue
      const kpiName = row[1]
      if (typeof kpiName !== 'string' || !kpiName.trim()) continue
      sonuc.push({
        kpiName: kpiName.trim(),
        no: typeof row[2] === 'number' ? row[2] : null,
        reason: typeof row[3] === 'string' ? row[3].trim() : null,
        action: typeof row[4] === 'string' ? row[4].trim() : null,
        responsible: typeof row[5] === 'string' ? row[5].trim() : null,
        startDate: excelSerialToDate(row[6]),
        endDate: excelSerialToDate(row[7]),
        completionPercent: typeof row[8] === 'number' ? row[8] : null,
      })
    }
  }
  return sonuc
}

async function main() {
  const mode = (process.argv[2] || 'dry').toLowerCase()
  console.log(`Excel   : ${EXCEL_PATH}`)
  console.log(`Sheet   : ${DEPARTMAN_SHEET}`)
  console.log(`OrgUnit : İnsan Varlıkları Müdürlüğü (${ORG_UNIT_ID_IK})`)
  console.log(`Mod     : ${mode}  (dry | all)\n`)

  const wb = XLSX.readFile(EXCEL_PATH)
  const { tanimlar, olcumler, ortalamalar } = parseDepartmanSheet(wb)
  const aksiyonlar = parseAksiyonSheets(wb)

  console.log(`Bulunan KPI tanımı            : ${tanimlar.length}`)
  console.log(`Bulunan ölçüm (yıl+ay) satırı : ${olcumler.length}`)
  console.log(`Bulunan yıllık ortalama       : ${ortalamalar.length}`)
  console.log(`Bulunan aksiyon               : ${aksiyonlar.length}`)

  if (mode === 'dry') {
    console.log('\nDRY-RUN tamam — hiçbir şey DB\'ye yazılmadı.')
    return
  }

  if (mode === 'all') {
    // Aksiyon "Sorumlu" ismini organizasyon şemasından (İK'nın ALTINDAKİ pozisyonlar) eşleştir
    const altOrgUnitIds = await ikAltOrgUnitIdleri()
    const calisanlar = await prisma.orgEmployee.findMany({
      where: { orgUnitId: { in: altOrgUnitIds } },
      select: { id: true, displayName: true },
    })
    const calisanIndex = new Map(calisanlar.map(c => [isimNormalize(c.displayName), c.id]))
    function sorumluIdBul(ad: string | null): string | null {
      if (!ad) return null
      return calisanIndex.get(isimNormalize(ad)) ?? null
    }

    let toplamOlcum = 0
    let toplamAksiyon = 0
    let toplamEslesen = 0
    for (const t of tanimlar) {
      const kpi = await prisma.kPIDefinition.upsert({
        where: { orgUnitId_name: { orgUnitId: ORG_UNIT_ID_IK, name: t.name } },
        update: {},
        create: {
          orgUnitId: ORG_UNIT_ID_IK,
          name: t.name,
          unit: t.unit,
          direction: t.direction,
          frequency: 'monthly',
        },
      })
      const kpiOlcumler = olcumler.filter(o => o.kpiName === t.name)
      for (const o of kpiOlcumler) {
        await prisma.kPIMeasurement.upsert({
          where: { kpiId_year_month: { kpiId: kpi.id, year: o.year, month: o.month } },
          update: { target: o.target, actual: o.actual },
          create: { kpiId: kpi.id, year: o.year, month: o.month, target: o.target, actual: o.actual },
        })
        toplamOlcum++
      }

      const kpiOrtalamalar = ortalamalar.filter(o => o.kpiName === t.name)
      for (const o of kpiOrtalamalar) {
        await prisma.kPIYearlyBaseline.upsert({
          where: { kpiId_year: { kpiId: kpi.id, year: o.year } },
          update: { average: o.average },
          create: { kpiId: kpi.id, year: o.year, average: o.average },
        })
      }

      // İdempotent: yeniden çalıştırılınca eski aksiyonları silip tazeden yaz
      await prisma.kPIAction.deleteMany({ where: { kpiId: kpi.id } })
      const kpiAksiyonlar = aksiyonlar.filter(a => a.kpiName === t.name)
      for (const a of kpiAksiyonlar) {
        const responsibleId = sorumluIdBul(a.responsible)
        if (responsibleId) toplamEslesen++
        await prisma.kPIAction.create({
          data: {
            kpiId: kpi.id,
            reason: a.reason,
            action: a.action,
            responsibleId,
            startDate: a.startDate,
            endDate: a.endDate,
            completionPercent: a.completionPercent != null ? Math.round(a.completionPercent * 100) : null,
            status: 'open',
          },
        })
        toplamAksiyon++
      }
      console.log(`  ✓ ${t.name} (${kpiOlcumler.length} ölçüm, ${kpiOrtalamalar.length} yıllık ort., ${kpiAksiyonlar.length} aksiyon)`)
    }
    console.log(`\nTAMAM — ${tanimlar.length} KPI, ${toplamOlcum} ölçüm, ${toplamAksiyon} aksiyon (${toplamEslesen} sorumlu eşleşti) yazıldı.`)
    return
  }
}

main()
  .catch(e => {
    console.error('HATA:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
