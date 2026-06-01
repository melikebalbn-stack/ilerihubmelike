/**
 * KALITE-7B — Şablon import script (xlsx).
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/import-quality-templates.ts \
 *     --dir /home/rokunet/import/kalite --dry-run
 *
 *   npx tsx --env-file=.env scripts/import-quality-templates.ts \
 *     --dir /home/rokunet/import/kalite --commit [--update]
 *
 * Dry-run DB'ye yazmaz; CSV raporu üretir. Commit modu transaction'lı
 * idempotent upsert (formNo='' + drawingNo + revision ile unique).
 */
import 'dotenv/config'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as XLSX from 'xlsx'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../src/generated/prisma'

// ════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════

type Severity = 'info' | 'warn' | 'error'

interface Warning {
  severity: Severity
  message: string
  row?: number
}

interface ParsedChar {
  orderIndex: number
  department: string | null
  inspectionTool: string | null
  sampleFreq: string | null
  critical: boolean
  charName: string
  nominal: number | null
  maxValue: number | null
  minValue: number | null
  hasNumericRange: boolean
  datum1: string | null
  datum2: string | null
  datum3: string | null
  /** ham hücreler (debug için) */
  rawRow?: string[]
}

interface FileResult {
  filename: string
  filePath: string
  fileNameHints: FileNameHints
  sheetSelected: string | null
  sheetSelectionReason: string
  /** Aday plan sayfalarının meta tablosu (debug için) */
  sheetCandidates: Array<{
    name: string
    drawingNo: string | null
    revision: string | null
    matched: boolean
  }>
  sheetList: string[]
  meta:
    | {
        partName: string
        drawingNo: string
        revision: string
        department: string | null
      }
    | null
  drawingNoFlags: {
    hasSlash: boolean
    adjacentRightValues: string[] // debug: drawingNo etiketinin sağında dolu hücreler
  }
  format: 'maks-min' | 'tolerans' | 'unknown'
  numericCount: number
  visualCount: number
  characteristics: ParsedChar[]
  /** İki satırlık aynı orderIndex tespit edildi mi (ham excel orderIndex'i) */
  hasDuplicateExcelOrder: boolean
  warnings: Warning[]
  status: 'parsed' | 'skipped' | 'failed'
  /** dry-run sonucu: oluşturulacak / zaten var / atlanacak */
  action: 'will_create' | 'already_exists' | 'skip' | 'unknown'
}

// ════════════════════════════════════════════════════════════
// UTILS
// ════════════════════════════════════════════════════════════

function cell(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function normalizeLabel(s: string): string {
  return cell(s)
    .toLocaleLowerCase('tr-TR')
    .replace(/[:\s]+/g, ' ')
    .replace(/[ıİ]/g, 'i')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[şŞ]/g, 's')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c')
    .trim()
}

function parseDecimal(s: string): number | null {
  const raw = cell(s)
  if (raw === '' || raw === '-' || raw === '—') return null
  // Excel error cells
  if (/^#[A-Z]/i.test(raw)) return null
  const cleaned = raw.replace(/Ø/gi, '').replace(',', '.').trim()
  const v = parseFloat(cleaned)
  return Number.isFinite(v) ? v : null
}

interface FileNameHints {
  /** Dosya adından çıkarılan kod listesi (örn ["10010003","10020003"]) */
  codes: string[]
  /** Dosya adından çıkarılan rev harfleri (örn ["F"] veya ["F","F"]) */
  revisions: string[]
  /** Tek rev var mı (codes hepsi aynı rev'e bağlanır mı) */
  singleRev: string | null
  /** Operasyon (örn "Kesme", "1.Büküm"); parantez içeriği son token */
  operation: string | null
}

/**
 * Dosya adı → { kodlar, revler, operasyon }.
 *
 * Desteklenen formatlar:
 *   - "F18.8511  10010003-10020003_F (Kesme).xlsx"     → 2 kod, 1 rev
 *   - "F18.8511  10010003_F - 10020003_F (1.Büküm).xlsx" → 2 kod, 2 rev (genelde aynı)
 *   - "F18.8511  10010003_F (...)" → 1 kod, 1 rev
 */
function parseFileNameHints(filename: string): FileNameHints {
  const stem = filename.replace(/\.xlsx$/i, '')

  // Operasyon: en son (...) içeriği
  const opMatch = stem.match(/\(([^)]+)\)\s*$/)
  const operation = opMatch ? opMatch[1].trim() : null

  // Operasyon ve form prefix'i kaldır
  const withoutOp = stem.replace(/\([^)]+\)\s*$/, '').trim()
  const withoutForm = withoutOp.replace(/^F\d+\.\d+\s+/i, '').trim()

  const codes = Array.from(withoutForm.matchAll(/(\d{4,})/g)).map((m) => m[1])
  const revisions = Array.from(withoutForm.matchAll(/_([A-Z])\b/g)).map(
    (m) => m[1],
  )

  // Tek rev tespiti: revisions listesinde uniqueSet === 1 ise tek rev
  const uniqueRevs = Array.from(new Set(revisions))
  const singleRev = uniqueRevs.length === 1 ? uniqueRevs[0] : null

  return { codes, revisions, singleRev, operation }
}

/** Etiket cell'i belli row aralığında ara. */
function findCellByLabel(
  aoa: string[][],
  labels: string[],
  maxRow: number = 12,
): { row: number; col: number } | null {
  const targets = labels.map(normalizeLabel)
  for (let r = 0; r < Math.min(aoa.length, maxRow); r++) {
    for (let c = 0; c < (aoa[r]?.length ?? 0); c++) {
      const v = normalizeLabel(aoa[r][c])
      if (!v) continue
      for (const t of targets) {
        if (v === t || v.startsWith(t + ' ') || v.startsWith(t + ':')) {
          return { row: r, col: c }
        }
      }
    }
  }
  return null
}

/** Etiket altında veya sağında ilk DOLU hücreyi al (dikey öncelikli, form layout). */
function readValueNear(
  aoa: string[][],
  pos: { row: number; col: number },
): string {
  // Dikey arama: altta max 3 hücre (form değer satırı genelde etiketin BİR ALT'ında)
  for (let dr = 1; dr <= 3; dr++) {
    const v = cell(aoa[pos.row + dr]?.[pos.col])
    if (v) return v
  }
  // Yatay arama: sağda max 6 hücre
  const row = aoa[pos.row] ?? []
  for (let dc = 1; dc <= 6; dc++) {
    const v = cell(row[pos.col + dc])
    if (v) return v
  }
  return ''
}

/** Etiket altındaki/sağındaki KOMŞU değer hücrelerini sırasıyla döndür (debug için). */
function inspectAdjacentValues(
  aoa: string[][],
  pos: { row: number; col: number },
): { downRight: string[]; right: string[] } {
  const downRight: string[] = []
  for (let dr = 1; dr <= 3; dr++) {
    const v = cell(aoa[pos.row + dr]?.[pos.col])
    if (v) downRight.push(v)
  }
  const right: string[] = []
  const row = aoa[pos.row] ?? []
  for (let dc = 1; dc <= 6; dc++) {
    const v = cell(row[pos.col + dc])
    if (v) right.push(v)
  }
  return { downRight, right }
}

/** "ÖLÇÜM NO" başlık satırını bul (header row 1). */
function findHeaderRow(aoa: string[][], startFrom = 3): number | null {
  for (let r = startFrom; r < Math.min(aoa.length, 30); r++) {
    for (let c = 0; c < (aoa[r]?.length ?? 0); c++) {
      const v = normalizeLabel(aoa[r][c])
      if (v === 'olcum no' || v === 'olcum numarasi') return r
    }
  }
  return null
}

interface ColumnMap {
  orderIndex: number
  department: number
  inspectionTool: number
  sampleFreq: number
  critical: number | null
  datum1: number | null
  datum2: number | null
  datum3: number | null
  charName: number
  nominal: number
  maxValue: number | null
  minValue: number | null
  plusTol: number | null
  minusTol: number | null
}

/** Header satırı (row r) + alt başlık (row r+1) üzerinden kolon haritası kur. */
function buildColumnMap(aoa: string[][], headerRow: number): {
  map: ColumnMap | null
  format: 'maks-min' | 'tolerans' | 'unknown'
} {
  const top = (aoa[headerRow] ?? []).map((c) => normalizeLabel(c))
  const sub = (aoa[headerRow + 1] ?? []).map((c) => normalizeLabel(c))

  const find = (labels: string[], rows: string[][] = [top, sub]): number | null => {
    const targets = labels.map((s) => normalizeLabel(s))
    for (const row of rows) {
      for (let i = 0; i < row.length; i++) {
        if (!row[i]) continue
        for (const t of targets) {
          if (row[i] === t || row[i].includes(t)) return i
        }
      }
    }
    return null
  }

  const orderIndex = find(['olcum no', 'olcum numarasi'])
  const department = find(['bolum'])
  const inspectionTool = find(['muayene araci'])
  const sampleFreq = find(['numune adet', 'numune adet siklik', 'numune adet/siklik'])
  const critical = find(['kritik', 'karakter']) // KRITIK kolonu veya KARAKTER (top-row başlık)

  // Karakter Özellikleri alt-kolonları
  const nominal = find(['nominal'])
  const maxValue = find(['maksimum', 'maks'])
  const minValue = find(['minimum', 'min'])
  const plusTol = find(['(+) tolerans', '+ tolerans', '+tolerans', 'pozitif tolerans'])
  const minusTol = find(['(-) tolerans', '- tolerans', '-tolerans', 'negatif tolerans'])

  const datum1 = find(['datum 1', 'datum1'])
  const datum2 = find(['datum 2', 'datum2'])
  const datum3 = find(['datum 3', 'datum3'])

  // Format tespit
  let format: 'maks-min' | 'tolerans' | 'unknown' = 'unknown'
  if (maxValue !== null && minValue !== null) format = 'maks-min'
  else if (plusTol !== null && minusTol !== null) format = 'tolerans'

  // charName kolonu = "KARAKTER" alt başlığı VEYA "NOMİNAL" kolonunun karakteristik adı için
  // Bu sheet'te row 7 col 6 KRITIK, col 7 NOMİNAL, sub row 8 col 6 KARAKTER, col 7 NOMİNAL
  // → charName ile nominal aslında AYNI kolon (col 7); charName MET[İN olarak Excel'de orjinali korur
  // çünkü "90.2" string, sayısal char için onun kendisi, görsel char için "ÇAPAK KONTROLÜ" gibi metin.
  const charName = nominal !== null ? nominal : -1

  if (
    orderIndex === null ||
    department === null ||
    inspectionTool === null ||
    sampleFreq === null ||
    nominal === null ||
    charName === -1 ||
    format === 'unknown'
  ) {
    return { map: null, format }
  }

  return {
    map: {
      orderIndex,
      department,
      inspectionTool,
      sampleFreq,
      critical,
      datum1,
      datum2,
      datum3,
      charName,
      nominal,
      maxValue,
      minValue,
      plusTol,
      minusTol,
    },
    format,
  }
}

/** Veri satırlarını parse et. */
function parseRows(
  aoa: string[][],
  startRow: number,
  cols: ColumnMap,
  format: 'maks-min' | 'tolerans',
): { chars: ParsedChar[]; warnings: Warning[]; hasDuplicateExcelOrder: boolean; skippedEmptyRowCount: number } {
  const chars: ParsedChar[] = []
  const warnings: Warning[] = []
  const seenExcelOrders = new Set<string>()
  let hasDuplicateExcelOrder = false
  let skippedEmptyRowCount = 0

  for (let r = startRow; r < aoa.length; r++) {
    const row = aoa[r] ?? []
    const rowText = row.map(cell).join('|').trim()
    if (rowText.replace(/\|/g, '') === '') continue // tamamen boş

    // STOP koşulu: "KONTROL SONUCU" veya benzeri
    const rowNorm = normalizeLabel(row.join(' '))
    if (
      rowNorm.includes('kontrol sonucu') ||
      rowNorm.includes('genel sonuc') ||
      rowNorm.includes('imza') ||
      rowNorm.includes('onaylayan')
    ) {
      break
    }

    const orderIndexCell = cell(row[cols.orderIndex])
    const charNameCell = cell(row[cols.charName])
    if (!orderIndexCell && !charNameCell) continue // tamamen boş
    if (!charNameCell) {
      // orderIndex dolu ama charName boş — şablon placeholder, sessizce atla
      skippedEmptyRowCount++
      continue
    }

    // Excel orderIndex duplicate (K2/WPH gibi çift satır) tespiti
    if (orderIndexCell) {
      if (seenExcelOrders.has(orderIndexCell)) {
        hasDuplicateExcelOrder = true
      } else {
        seenExcelOrders.add(orderIndexCell)
      }
    }

    // Parser her satırı ayrı char olarak ekler; orderIndex KANONİK ardışık.
    const orderIndex = chars.length + 1
    const department = cell(row[cols.department]) || null
    const inspectionTool = cell(row[cols.inspectionTool]) || null
    const sampleFreq = cell(row[cols.sampleFreq]) || null
    // KALITE-7B kural: "*" sampling dipnot referansı, KRİTİK DEĞİL → daima false
    const critical = false
    const datum1 = cols.datum1 !== null ? cell(row[cols.datum1]) || null : null
    const datum2 = cols.datum2 !== null ? cell(row[cols.datum2]) || null : null
    const datum3 = cols.datum3 !== null ? cell(row[cols.datum3]) || null : null

    // Sayısal mı görsel mi?
    const nominalNum = parseDecimal(charNameCell)
    if (nominalNum !== null) {
      // Sayısal
      let maxVal: number | null = null
      let minVal: number | null = null
      if (format === 'maks-min') {
        const maxCell = cell(row[cols.maxValue!])
        const minCell = cell(row[cols.minValue!])
        maxVal = parseDecimal(maxCell)
        minVal = parseDecimal(minCell)
        if (maxCell && maxVal === null) {
          warnings.push({
            severity: 'warn',
            message: `Satır ${r + 1}: MAKSİMUM parse fail '${maxCell}'`,
            row: r,
          })
        }
        if (minCell && minVal === null) {
          warnings.push({
            severity: 'warn',
            message: `Satır ${r + 1}: MİNİMUM parse fail '${minCell}'`,
            row: r,
          })
        }
      } else {
        // tolerans modu: max = nominal + plusTol, min = nominal - minusTol
        const plusCell = cell(row[cols.plusTol!])
        const minusCell = cell(row[cols.minusTol!])
        const plus = parseDecimal(plusCell) ?? 0
        const minus = parseDecimal(minusCell) ?? 0
        maxVal = nominalNum + plus
        minVal = nominalNum - minus
        if (plusCell && parseDecimal(plusCell) === null) {
          warnings.push({
            severity: 'warn',
            message: `Satır ${r + 1}: (+) TOL parse fail '${plusCell}'`,
            row: r,
          })
        }
        if (minusCell && parseDecimal(minusCell) === null) {
          warnings.push({
            severity: 'warn',
            message: `Satır ${r + 1}: (-) TOL parse fail '${minusCell}'`,
            row: r,
          })
        }
      }

      chars.push({
        orderIndex,
        department,
        inspectionTool,
        sampleFreq,
        critical,
        charName: charNameCell, // ham metin korunur (Ø20,5 vb)
        nominal: nominalNum,
        maxValue: maxVal,
        minValue: minVal,
        hasNumericRange: true,
        datum1,
        datum2,
        datum3,
      })
    } else {
      // Görsel
      chars.push({
        orderIndex,
        department,
        inspectionTool,
        sampleFreq,
        critical,
        charName: charNameCell,
        nominal: null,
        maxValue: null,
        minValue: null,
        hasNumericRange: false,
        datum1,
        datum2,
        datum3,
      })
    }
  }

  return { chars, warnings, hasDuplicateExcelOrder, skippedEmptyRowCount }
}

// ════════════════════════════════════════════════════════════
// SHEET SELECTION — dosya-adı-içerik eşleşmesi
// ════════════════════════════════════════════════════════════

/** Bir sheet'in meta'sını (RESİM NO + REVİZYON) oku. */
function readSheetMeta(
  sh: XLSX.WorkSheet,
): { drawingNo: string | null; revision: string | null } {
  const aoa: string[][] = XLSX.utils
    .sheet_to_json(sh, { header: 1, raw: false, defval: '' })
    .map((r) => (Array.isArray(r) ? (r as unknown[]).map(cell) : []))

  const drawingLabel = findCellByLabel(aoa, ['resim no'])
  const revisionLabel = findCellByLabel(aoa, ['revizyon'])

  return {
    drawingNo: drawingLabel ? readValueNear(aoa, drawingLabel) || null : null,
    revision: revisionLabel ? readValueNear(aoa, revisionLabel) || null : null,
  }
}

/** Bir aday sayfanın meta'sı dosya adı kod/rev'iyle eşleşiyor mu. */
function metaMatchesFileName(
  meta: { drawingNo: string | null; revision: string | null },
  hints: FileNameHints,
): boolean {
  if (!meta.drawingNo || !meta.revision) return false

  // Rev karşılaştır (basit eşitlik, varsa)
  if (hints.singleRev && meta.revision.trim().toUpperCase() !== hints.singleRev.toUpperCase()) {
    return false
  }
  // Hints.codes ile meta.drawingNo'yu karşılaştır.
  // meta.drawingNo "10010003/10020003" gibi olabilir; "/" ile böl.
  const metaCodes = meta.drawingNo
    .split(/[\/,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => /^\d{4,}$/.test(s))
  if (metaCodes.length === 0) return false

  // En az bir hint kodu meta kodlarıyla eşleşmeli (overlap)
  return metaCodes.some((mc) => hints.codes.includes(mc))
}

/**
 * Şablon sayfasını seç.
 *   - override (--sheet veya --map) varsa direkt onu kullan
 *   - Tek sayfa → onu kullan
 *   - Plan adayı sheet'leri filtrele (adı "plan" içeren, sayısal ve "2026" hariç)
 *   - Aday sayfaların META'sını dosya adı hints'iyle karşılaştır
 *   - Tek eşleşme → seç; 0 veya >1 → işaretle
 */
function selectSheet(
  wb: XLSX.WorkBook,
  hints: FileNameHints,
  override?: string,
): {
  name: string | null
  reason: string
  candidates: Array<{
    name: string
    drawingNo: string | null
    revision: string | null
    matched: boolean
  }>
} {
  const sheetNames = wb.SheetNames

  if (override) {
    // trim-match desteği
    const direct = sheetNames.find((s) => s === override)
    const trimm = sheetNames.find((s) => s.trim() === override.trim())
    const target = direct ?? trimm
    if (target) {
      return { name: target, reason: `override "${override}"`, candidates: [] }
    }
    return {
      name: null,
      reason: `override "${override}" sayfa listede yok — adaylar: ${sheetNames.map((s) => `"${s}"`).join(', ')}`,
      candidates: [],
    }
  }

  if (sheetNames.length === 0) {
    return { name: null, reason: 'sayfa yok', candidates: [] }
  }
  if (sheetNames.length === 1) {
    return { name: sheetNames[0], reason: 'tek sayfa', candidates: [] }
  }

  // Plan adayları
  const planCandidates = sheetNames.filter((name) => {
    const trimmed = name.trim()
    if (/^\d+$/.test(trimmed)) return false // 1, 2, 3, ...
    if (trimmed === '2026') return false
    const norm = trimmed.toLocaleUpperCase('tr-TR').replace(/\s+/g, '')
    return norm.includes('PLAN')
  })

  if (planCandidates.length === 0) {
    return {
      name: null,
      reason: `plan sayfası yok (${sheetNames.length} sayfa: ${sheetNames.map((s) => `"${s}"`).join(', ')})`,
      candidates: [],
    }
  }

  // Her aday için meta oku + dosya adı ile eşleştir
  const candidates = planCandidates.map((name) => {
    const meta = readSheetMeta(wb.Sheets[name])
    const matched = metaMatchesFileName(meta, hints)
    return { name, drawingNo: meta.drawingNo, revision: meta.revision, matched }
  })

  const matched = candidates.filter((c) => c.matched)

  if (matched.length === 1) {
    return {
      name: matched[0].name,
      reason: `dosya adı meta eşleşti → "${matched[0].name}" (drawingNo=${matched[0].drawingNo}, rev=${matched[0].revision})`,
      candidates,
    }
  }

  if (matched.length === 0) {
    return {
      name: null,
      reason: `hiçbir plan sayfası dosya adıyla uyuşmuyor — kod=${hints.codes.join(',')} rev=${hints.singleRev ?? '?'}`,
      candidates,
    }
  }

  return {
    name: null,
    reason: `${matched.length} plan sayfası dosya adıyla eşleşti, manuel seçim gerek: ${matched.map((c) => `"${c.name}"`).join(', ')}`,
    candidates,
  }
}

function loadFileSheetMap(csvPath: string | null): Map<string, string> {
  const m = new Map<string, string>()
  if (!csvPath) return m
  if (!fs.existsSync(csvPath)) {
    console.warn(`⚠ --map dosyası bulunamadı: ${csvPath}`)
    return m
  }
  const content = fs.readFileSync(csvPath, 'utf-8')
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const idx = line.indexOf(',')
    if (idx < 0) continue
    const filename = line.slice(0, idx).trim()
    const sheet = line.slice(idx + 1).trim().replace(/^"|"$/g, '')
    if (filename && sheet) m.set(filename, sheet)
  }
  return m
}

// ════════════════════════════════════════════════════════════
// FILE-LEVEL PARSER
// ════════════════════════════════════════════════════════════

function parseFile(filePath: string, sheetOverride?: string): FileResult {
  const filename = path.basename(filePath)
  const warnings: Warning[] = []
  const hints = parseFileNameHints(filename)
  const result: FileResult = {
    filename,
    filePath,
    fileNameHints: hints,
    sheetSelected: null,
    sheetSelectionReason: '',
    sheetCandidates: [],
    sheetList: [],
    meta: null,
    drawingNoFlags: { hasSlash: false, adjacentRightValues: [] },
    format: 'unknown',
    numericCount: 0,
    visualCount: 0,
    characteristics: [],
    hasDuplicateExcelOrder: false,
    warnings,
    status: 'failed',
    action: 'unknown',
  }

  let wb: XLSX.WorkBook
  try {
    wb = XLSX.readFile(filePath, { cellDates: false })
  } catch (e) {
    warnings.push({ severity: 'error', message: `Excel okunamadı: ${(e as Error).message}` })
    return result
  }

  result.sheetList = wb.SheetNames
  if (wb.SheetNames.length === 0) {
    warnings.push({ severity: 'error', message: 'Excel boş — sayfa yok' })
    return result
  }

  // Sayfa seçimi — DOSYA ADI ↔ İÇERİK eşleşmesi
  const sel = selectSheet(wb, hints, sheetOverride)
  result.sheetSelectionReason = sel.reason
  result.sheetCandidates = sel.candidates
  if (!sel.name) {
    warnings.push({
      severity: 'warn',
      message: `Sayfa seçilemedi: ${sel.reason}`,
    })
    result.status = 'skipped'
    result.action = 'skip'
    return result
  }
  result.sheetSelected = sel.name
  const sh = wb.Sheets[sel.name]
  const aoa: string[][] = XLSX.utils
    .sheet_to_json(sh, { header: 1, raw: false, defval: '' })
    .map((r) => (Array.isArray(r) ? (r as unknown[]).map(cell) : []))

  // Meta etiketleri
  const partLabel = findCellByLabel(aoa, ['parca adi'])
  const drawingLabel = findCellByLabel(aoa, ['resim no'])
  const revisionLabel = findCellByLabel(aoa, ['revizyon'])
  const departmentLabel = findCellByLabel(aoa, ['bolum'])

  if (!drawingLabel || !revisionLabel) {
    warnings.push({
      severity: 'error',
      message: `Meta etiket bulunamadı: ${!drawingLabel ? 'RESİM NO ' : ''}${!revisionLabel ? 'REVİZYON' : ''}`,
    })
    return result
  }

  const partName = partLabel ? readValueNear(aoa, partLabel) : ''
  const drawingNo = readValueNear(aoa, drawingLabel)
  const revision = readValueNear(aoa, revisionLabel)
  const department = departmentLabel ? readValueNear(aoa, departmentLabel) : ''

  if (!drawingNo || !revision) {
    warnings.push({
      severity: 'error',
      message: `Meta değer eksik: ${!drawingNo ? 'RESİM NO ' : ''}${!revision ? 'REVİZYON' : ''}`,
    })
    return result
  }

  // drawingNo doğrulama — slash içeriyor mu (tek hücreden mi, yan-yana hücre mi)
  const adj = inspectAdjacentValues(aoa, drawingLabel)
  result.drawingNoFlags = {
    hasSlash: drawingNo.includes('/'),
    adjacentRightValues: adj.right,
  }
  if (result.drawingNoFlags.hasSlash) {
    warnings.push({
      severity: 'warn',
      message: `drawingNo slash içeriyor ("${drawingNo}") — tek hücreden birleşik. Şu an drawingNo birleşik tutuluyor (tek şablon).`,
    })
  }

  result.meta = {
    partName: partName || '(boş)',
    drawingNo,
    revision,
    department: department || null,
  }

  // Dosya adı vs içerik uyumu (artık sheet-selection content-match yaptığı için
  // bu noktada eşleşmenin gelmesi beklenir; yine de yedek doğrulama)
  if (hints.codes.length > 0) {
    const metaCodes = drawingNo
      .split(/[\/,;\s]+/)
      .map((s) => s.trim())
      .filter((s) => /^\d{4,}$/.test(s))
    const overlap = metaCodes.some((mc) => hints.codes.includes(mc))
    const revOk =
      !hints.singleRev || revision.trim().toUpperCase() === hints.singleRev.toUpperCase()
    if (!overlap || !revOk) {
      warnings.push({
        severity: 'warn',
        message: `Dosya adı ↔ içerik uyuşmuyor (dosya kodlar=[${hints.codes.join(',')}] rev=${hints.singleRev ?? '?'}, içerik drawingNo=${drawingNo} rev=${revision})`,
      })
    }
  } else {
    warnings.push({
      severity: 'warn',
      message: 'Dosya adından kod çıkarılamadı (regex match yok)',
    })
  }
  if (!hints.operation) {
    warnings.push({
      severity: 'warn',
      message: 'Dosya adından operasyon (parantez) çıkarılamadı',
    })
  }

  // Header / column map
  const headerRow = findHeaderRow(aoa)
  if (headerRow === null) {
    warnings.push({ severity: 'error', message: 'Tablo başlık satırı ("ÖLÇÜM NO") bulunamadı' })
    return result
  }

  const { map, format } = buildColumnMap(aoa, headerRow)
  result.format = format
  if (!map || format === 'unknown') {
    warnings.push({
      severity: 'error',
      message: `Kolon haritası eksik (format=${format}). Header row ${headerRow + 1}`,
    })
    return result
  }

  // Veri satırları (header'ın 2 alt satırından başla)
  const dataStart = headerRow + 2
  const parsed = parseRows(aoa, dataStart, map, format)
  warnings.push(...parsed.warnings)
  result.characteristics = parsed.chars
  result.numericCount = parsed.chars.filter((c) => c.hasNumericRange).length
  result.visualCount = parsed.chars.filter((c) => !c.hasNumericRange).length
  result.hasDuplicateExcelOrder = parsed.hasDuplicateExcelOrder
  if (result.hasDuplicateExcelOrder) {
    warnings.push({
      severity: 'info',
      message: `Excel'de aynı ÖLÇÜM NO'su olan satırlar var (K2/WPH gibi). Parser her satırı AYRI karakter kabul etti, orderIndex kanonik ardışık.`,
    })
  }
  if (parsed.skippedEmptyRowCount > 0) {
    warnings.push({
      severity: 'info',
      message: `${parsed.skippedEmptyRowCount} boş şablon placeholder satırı sessizce atlandı (orderIndex dolu, karakter boş).`,
    })
  }
  result.status = parsed.chars.length > 0 ? 'parsed' : 'failed'
  if (parsed.chars.length === 0) {
    warnings.push({ severity: 'error', message: 'Hiç karakter satırı bulunamadı' })
  }

  return result
}

// ════════════════════════════════════════════════════════════
// DB CHECK (dry-run için: zaten var mı)
// ════════════════════════════════════════════════════════════

async function checkExistence(
  prisma: PrismaClient,
  drawingNo: string,
  revision: string,
  operation: string = '',
): Promise<boolean> {
  const existing = await prisma.measurementTemplate.findUnique({
    where: {
      formNo_drawingNo_revision_operation: {
        formNo: '',
        drawingNo,
        revision,
        operation,
      },
    },
  })
  return !!existing
}

// ════════════════════════════════════════════════════════════
// CSV REPORT
// ════════════════════════════════════════════════════════════

function csvEscape(s: string): string {
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function writeReport(results: FileResult[], outPath: string): void {
  const lines: string[] = []
  lines.push(
    [
      'filename',
      'status',
      'action',
      'sheet',
      'sheetReason',
      'fileNameCodes',
      'fileNameRev',
      'fileNameOperation',
      'partName',
      'drawingNo',
      'drawingHasSlash',
      'revision',
      'department',
      'format',
      'numericCount',
      'visualCount',
      'totalChars',
      'hasDuplicateExcelOrder',
      'warningCount',
      'warnings',
    ]
      .map(csvEscape)
      .join(','),
  )
  for (const r of results) {
    const wList = r.warnings
      .map((w) => `[${w.severity}] ${w.message}`)
      .join(' | ')
    lines.push(
      [
        r.filename,
        r.status,
        r.action,
        r.sheetSelected ?? '',
        r.sheetSelectionReason,
        r.fileNameHints.codes.join('/'),
        r.fileNameHints.singleRev ?? '',
        r.fileNameHints.operation ?? '',
        r.meta?.partName ?? '',
        r.meta?.drawingNo ?? '',
        r.drawingNoFlags.hasSlash ? 'yes' : 'no',
        r.meta?.revision ?? '',
        r.meta?.department ?? '',
        r.format,
        String(r.numericCount),
        String(r.visualCount),
        String(r.characteristics.length),
        r.hasDuplicateExcelOrder ? 'yes' : 'no',
        String(r.warnings.length),
        wList,
      ]
        .map(csvEscape)
        .join(','),
    )
  }
  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8')
}

// ════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════

interface CliArgs {
  dir: string
  dryRun: boolean
  commit: boolean
  update: boolean
  sheet: string | undefined
  map: string | null
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    dir: '/home/rokunet/import/kalite',
    dryRun: false,
    commit: false,
    update: false,
    sheet: undefined,
    map: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dir') args.dir = argv[++i]
    else if (a === '--dry-run') args.dryRun = true
    else if (a === '--commit') args.commit = true
    else if (a === '--update') args.update = true
    else if (a === '--sheet') args.sheet = argv[++i]
    else if (a === '--map') args.map = argv[++i]
  }
  if (!args.dryRun && !args.commit) {
    args.dryRun = true // default safe
  }
  if (args.dryRun && args.commit) {
    throw new Error('--dry-run ve --commit aynı anda kullanılamaz')
  }
  return args
}

async function main() {
  const argv = process.argv.slice(2)
  const args = parseArgs(argv)

  console.log(`══════════════════════════════════════════════`)
  console.log(`KALITE-7B Şablon Import`)
  console.log(`Dizin     : ${args.dir}`)
  console.log(`Mod       : ${args.dryRun ? 'DRY-RUN' : 'COMMIT'}${args.update ? ' (update)' : ''}`)
  if (args.sheet) console.log(`--sheet   : "${args.sheet}" (global override)`)
  if (args.map) console.log(`--map     : ${args.map}`)
  console.log(`══════════════════════════════════════════════`)

  const fileSheetMap = loadFileSheetMap(args.map)
  if (fileSheetMap.size > 0) {
    console.log(`Map girdileri: ${fileSheetMap.size}`)
  }

  if (!fs.existsSync(args.dir)) {
    console.error(`Dizin bulunamadı: ${args.dir}`)
    process.exit(1)
  }

  const files = fs
    .readdirSync(args.dir)
    .filter((f) => f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~$'))
    .sort()
  console.log(`Bulunan xlsx: ${files.length}`)

  if (files.length === 0) {
    console.log('Dosya yok — çıkış')
    return
  }

  // Prisma (sadece dry-run'da existence check için; commit modunda upsert)
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  const results: FileResult[] = []

  try {
    for (const fname of files) {
      const fp = path.join(args.dir, fname)
      const override = fileSheetMap.get(fname) ?? args.sheet
      const r = parseFile(fp, override)

      // Existence check (parse başarılıysa)
      if (r.meta && r.status === 'parsed') {
        try {
          const exists = await checkExistence(
            prisma,
            r.meta.drawingNo,
            r.meta.revision,
            r.fileNameHints.operation ?? '',
          )
          if (exists) {
            r.action = 'already_exists'
            r.warnings.push({
              severity: 'info',
              message: `DB'de aynı (drawingNo=${r.meta.drawingNo}, rev=${r.meta.revision}) zaten mevcut`,
            })
          } else {
            r.action = 'will_create'
          }
        } catch (e) {
          r.warnings.push({
            severity: 'error',
            message: `DB lookup fail: ${(e as Error).message}`,
          })
        }
      }

      results.push(r)

      // Konsol özeti dosya başına
      const tag =
        r.status === 'parsed'
          ? '✅'
          : r.status === 'skipped'
            ? '⏭'
            : '❌'
      console.log(``)
      console.log(`${tag} ${fname}`)
      console.log(
        `   dosya: kodlar=[${r.fileNameHints.codes.join(',')}] rev=${r.fileNameHints.singleRev ?? '?'} operasyon=${r.fileNameHints.operation ?? '—'}`,
      )
      console.log(`   sheet=${r.sheetSelected ?? '—'}  (${r.sheetList.length} sayfa)  reason: ${r.sheetSelectionReason}`)
      if (r.sheetCandidates.length > 0) {
        for (const c of r.sheetCandidates) {
          const mark = c.matched ? '✓' : '✗'
          console.log(
            `      ${mark} "${c.name}" → drawingNo=${c.drawingNo ?? '—'} rev=${c.revision ?? '—'}`,
          )
        }
      }
      if (r.meta) {
        console.log(
          `   meta: parça="${r.meta.partName}"  resim=${r.meta.drawingNo}  rev=${r.meta.revision}  bölüm=${r.meta.department ?? '—'}`,
        )
        if (r.drawingNoFlags.hasSlash) {
          console.log(`   drawingNo SLASH: tek hücreden birleşik`)
        }
      }
      console.log(
        `   format=${r.format}  sayısal=${r.numericCount}  görsel=${r.visualCount}  toplam=${r.characteristics.length}  aksiyon=${r.action}`,
      )
      if (r.hasDuplicateExcelOrder) {
        console.log(`   çift-satır: K2/WPH (aynı Excel ÖLÇÜM NO'su, farklı bölüm) — her satır AYRI char`)
      }
      if (r.warnings.length > 0) {
        for (const w of r.warnings) {
          const sev =
            w.severity === 'error' ? '🚨' : w.severity === 'warn' ? '⚠ ' : 'ℹ '
          console.log(`   ${sev} ${w.message}`)
        }
      }
    }

    // CSV rapor
    const csvPath = path.join(
      args.dir,
      `_import-report-${new Date()
        .toISOString()
        .slice(0, 16)
        .replace(/[:T]/g, '-')}.csv`,
    )
    writeReport(results, csvPath)
    console.log(``)
    console.log(`📄 CSV rapor: ${csvPath}`)

    // Toplam özet
    const total = results.length
    const parsed = results.filter((r) => r.status === 'parsed').length
    const skipped = results.filter((r) => r.status === 'skipped').length
    const failed = results.filter((r) => r.status === 'failed').length
    const willCreate = results.filter((r) => r.action === 'will_create').length
    const alreadyExists = results.filter(
      (r) => r.action === 'already_exists',
    ).length
    console.log(``)
    console.log(`──────────── ÖZET ────────────`)
    console.log(`Toplam dosya     : ${total}`)
    console.log(`Parse başarılı   : ${parsed}`)
    console.log(`Atlandı          : ${skipped}`)
    console.log(`Hata             : ${failed}`)
    console.log(`Oluşturulacak    : ${willCreate}`)
    console.log(`Zaten var        : ${alreadyExists}`)
    console.log(`──────────────────────────────`)

    if (args.commit) {
      console.log(``)
      console.log(`⚠ COMMIT modu henüz implement değil — ayrı turda eklenecek`)
      console.log(`  Şu an dry-run sonuçlandı.`)
    }
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((e) => {
  console.error('İmport script fail:', e)
  process.exit(1)
})
