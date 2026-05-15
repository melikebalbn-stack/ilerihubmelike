/**
 * Ayrılan personel toplu import (PR-LEAVERS-IMPORT-2026-05-15)
 *
 * Kaynak: data/İLERİHUB PERSONEL LİSTELERİ.xlsx → sheet "ÇIKAN PERSONEL"
 * 1368 satır (2012-2024 arası tarihsel ayrılan personel).
 *
 * Kullanım:
 *   npx tsx --env-file=.env prisma/scripts/import-leavers-2026-05-15.ts --dry-run
 *   npx tsx --env-file=.env prisma/scripts/import-leavers-2026-05-15.ts --apply
 *
 * Dedup:
 *   1. tcKimlikNo dolu ise: PersonnelSensitive.tcKimlikNo lookup (NOT unique, findFirst)
 *   2. Composite: Personnel.adSoyad + iseGirisTarihi + exitDate
 *   3. Hit → SKIP (audit için).
 *   4. Miss → CREATE.
 *
 * Audit:
 *   - SHA256 hash of source file
 *   - createdBy: "BULK_IMPORT_LEAVERS_2026-05-15"
 *   - exitRecordedById: ad_melih.dilben (DB'den lookup)
 *   - exitRecordedAt: import time
 */

import { PrismaClient } from "../../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as XLSX from "xlsx";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SOURCE_FILE = path.join(process.cwd(), "data", "İLERİHUB PERSONEL LİSTELERİ.xlsx");
const SOURCE_SHEET = "ÇIKAN PERSONEL";
const CREATED_BY = "BULK_IMPORT_LEAVERS_2026-05-15";
const ACTOR_EMAIL = "melih.dilben@ilerigroup.com";

// Manuel skip listesi (kolon kayması tespit edilen satırlar — İK manuel düzeltecek)
const SKIP_ROW_NUMBERS = new Set<number>([927, 1048]);

const OUTPUT_DIR = path.join(process.cwd(), "prisma", "scripts", "output");
const REPORT_FILE = path.join(OUTPUT_DIR, "leavers-import-2026-05-15-report.json");

// ════════════════════════════════════════════════════════════
// NORMALIZE HELPERS (mevcut import/route.ts'ten kopyalandı)
// ════════════════════════════════════════════════════════════

function stripTr(v: string): string {
  return v.toUpperCase().trim()
    .replace(/İ/g, "I").replace(/Ğ/g, "G").replace(/Ü/g, "U")
    .replace(/Ş/g, "S").replace(/Ö/g, "O").replace(/Ç/g, "C");
}

function normalizeGender(value: unknown): "MALE" | "FEMALE" | null {
  if (value === null || value === undefined || value === "") return null;
  const v = String(value).toUpperCase().trim();
  if (v === "ERKEK" || v === "BAY" || v === "E" || v === "MALE") return "MALE";
  if (v === "KADIN" || v === "BAYAN" || v === "K" || v === "FEMALE") return "FEMALE";
  return null;
}

function normalizeYaka(value: unknown): "MAVI" | "BEYAZ" | null {
  if (value === null || value === undefined || value === "") return null;
  const v = stripTr(String(value));
  if (v === "MAVI" || v.includes("MAVI")) return "MAVI";
  if (v === "BEYAZ" || v.includes("BEYAZ")) return "BEYAZ";
  return null;
}

function normalizeDirektEndirekt(value: unknown): "DIREKT" | "ENDIREKT" | null {
  if (value === null || value === undefined || value === "") return null;
  const v = stripTr(String(value));
  if (v.includes("ENDIREK") || v.includes("ENDIRECT") || v.includes("INDIRECT")) return "ENDIREKT";
  if (v.includes("DIREK") || v.includes("DIRECT")) return "DIREKT";
  return null;
}

function normalizeAsansorMekanik(value: unknown): "ASANSOR" | "MEKANIK" | "YOK" | null {
  if (value === null || value === undefined || value === "") return null;
  const v = stripTr(String(value));
  if (v.includes("ASANSOR") || v.includes("ELEVATOR")) return "ASANSOR";
  if (v.includes("MEKANIK") || v.includes("MECHANIC")) return "MEKANIK";
  if (v === "YOK" || v === "NONE") return "YOK";
  return null;
}

function normalizeBoolean(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  const v = String(value).toUpperCase().trim();
  return v === "EVET" || v === "TRUE" || v === "YES" || v === "1" || v === "VAR";
}

function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function normalizePhone(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).replace(/\s+/g, "").trim();
  return s === "" ? null : s;
}

function normalizeInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = parseInt(String(value).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Excel tarihi parse — Excel serial veya string olabilir.
 * Hata durumunda null döner (corrupt veri).
 */
function parseExcelDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;

  // Excel serial number (number)
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 1 || value > 100000) return null;
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) return null;
    // SSF parse: { y, m, d, H, M, S }
    const dt = new Date(Date.UTC(d.y, d.m - 1, d.d));
    if (isNaN(dt.getTime())) return null;
    if (dt.getUTCFullYear() < 1900 || dt.getUTCFullYear() > 2100) return null;
    return dt;
  }

  // String (DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD)
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;
    // Türkçe formatı: DD.MM.YYYY veya DD/MM/YYYY
    const tr = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/);
    if (tr) {
      const day = parseInt(tr[1], 10);
      const mon = parseInt(tr[2], 10);
      let yr = parseInt(tr[3], 10);
      if (yr < 100) yr += yr < 50 ? 2000 : 1900;
      if (day < 1 || day > 31 || mon < 1 || mon > 12 || yr < 1900 || yr > 2100) return null;
      const dt = new Date(Date.UTC(yr, mon - 1, day));
      return isNaN(dt.getTime()) ? null : dt;
    }
    // ISO
    const iso = new Date(s);
    if (!isNaN(iso.getTime()) && iso.getUTCFullYear() >= 1900 && iso.getUTCFullYear() <= 2100) return iso;
  }
  return null;
}

// ════════════════════════════════════════════════════════════
// EXCEL → ROW PARSE
// ════════════════════════════════════════════════════════════

interface ExcelRow {
  rowIdx: number; // Excel satır numarası (header sonrası 2-1369)
  no: number | null;
  sicilNo: string | null;
  sinif: string | null;
  cinsiyet: "MALE" | "FEMALE" | null;
  adSoyad: string | null;
  yakaRengi: "MAVI" | "BEYAZ" | null;
  direktEndirekt: "DIREKT" | "ENDIREKT" | null;
  asansorMekanik: "ASANSOR" | "MEKANIK" | "YOK" | null;
  sgkNo: string | null;
  tcKimlikNo: string | null;
  iseGirisTarihi: Date | null;
  denemeDegerlendirme: Date | null;
  altiAyDegerlendirme: Date | null;
  gorev: string | null;
  // gorevDetay (kolon O) — kullanıcı kararıyla ATLANIYOR
  bolum: string | null;
  birimSorumlusu: string | null;
  sorumlu2: string | null;
  sorumlu3: string | null;
  bolumMuduru: string | null;
  bankaSube: string | null;
  bankaHesapNo: string | null;
  telefon: string | null;
  dogumTarihi: Date | null;
  dogumTarihiRaw: unknown; // bozuk tespit için
  emekli: boolean;
  engelli: boolean;
  egitimYeri: string | null;
  egitimTipi: string | null;
  egitimAlani: string | null;
  mezuniyetYili: number | null;
  interKepMail: string | null;
  exitDate: Date | null;
  // ÇALIŞMA SÜRESİ/YIL/AY — runtime, atılıyor
  exitParty: string | null;
  exitCode: string | null;
  exitReason: string | null;
  exitRootCause: string | null;
  exitTurnoverType: string | null;
  exitGeneralNote: string | null;

  errors: string[];
}

function parseRow(row: unknown[], rowIdx: number): ExcelRow {
  const errors: string[] = [];
  const get = (i: number): unknown => row[i] ?? null;

  const dogumRaw = get(23);
  const dogumParsed = parseExcelDate(dogumRaw);
  if (dogumRaw !== null && dogumRaw !== "" && dogumParsed === null) {
    errors.push(`dogumTarihi parse fail (raw=${JSON.stringify(dogumRaw)})`);
  }

  return {
    rowIdx,
    no: normalizeInt(get(0)),
    sicilNo: normalizeText(get(1)),
    sinif: normalizeText(get(2)),
    cinsiyet: normalizeGender(get(3)),
    adSoyad: normalizeText(get(4)),
    yakaRengi: normalizeYaka(get(5)),
    direktEndirekt: normalizeDirektEndirekt(get(6)),
    asansorMekanik: normalizeAsansorMekanik(get(7)),
    sgkNo: normalizeText(get(8)),
    tcKimlikNo: normalizeText(get(9)),
    iseGirisTarihi: parseExcelDate(get(10)),
    denemeDegerlendirme: parseExcelDate(get(11)),
    altiAyDegerlendirme: parseExcelDate(get(12)),
    gorev: normalizeText(get(13)),
    // (14): GÖREV/DETAY — atlanıyor
    bolum: normalizeText(get(15)),
    birimSorumlusu: normalizeText(get(16)),
    sorumlu2: normalizeText(get(17)),
    sorumlu3: normalizeText(get(18)),
    bolumMuduru: normalizeText(get(19)),
    bankaSube: normalizeText(get(20)),
    bankaHesapNo: normalizeText(get(21)),
    telefon: normalizePhone(get(22)),
    dogumTarihi: dogumParsed,
    dogumTarihiRaw: dogumRaw,
    emekli: normalizeBoolean(get(25)),
    engelli: normalizeBoolean(get(26)),
    egitimYeri: normalizeText(get(27)),
    egitimTipi: normalizeText(get(28)),
    egitimAlani: normalizeText(get(29)),
    mezuniyetYili: normalizeInt(get(30)),
    interKepMail: normalizeText(get(31)),
    exitDate: parseExcelDate(get(32)),
    // (33-35): ÇALIŞMA SÜRESİ/YIL/AY — atlanıyor
    exitParty: normalizeText(get(36)),
    exitCode: normalizeText(get(37)),
    exitReason: normalizeText(get(38)),
    exitRootCause: normalizeText(get(39)),
    exitTurnoverType: normalizeText(get(40)),
    exitGeneralNote: normalizeText(get(41)),
    errors,
  };
}

// ════════════════════════════════════════════════════════════
// DEDUP
// ════════════════════════════════════════════════════════════

async function findExisting(r: ExcelRow): Promise<{ id: string; reason: string } | null> {
  // 1. tcKimlikNo dolu ise lookup (NOT unique, findFirst)
  if (r.tcKimlikNo) {
    const sens = await prisma.personnelSensitive.findFirst({
      where: { tcKimlikNo: r.tcKimlikNo },
      select: { personnelId: true },
    });
    if (sens) {
      return { id: sens.personnelId, reason: `tcKimlikNo match: ${r.tcKimlikNo}` };
    }
  }

  // 2. Composite key (adSoyad + iseGirisTarihi + exitDate)
  if (r.adSoyad && r.iseGirisTarihi && r.exitDate) {
    const p = await prisma.personnel.findFirst({
      where: {
        adSoyad: r.adSoyad,
        iseGirisTarihi: r.iseGirisTarihi,
        exitDate: r.exitDate,
      },
      select: { id: true },
    });
    if (p) {
      return { id: p.id, reason: `composite (adSoyad+iseGiris+exitDate)` };
    }
  }

  return null;
}

// ════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const isApply = process.argv.includes("--apply");

  if (!isDryRun && !isApply) {
    console.error("Usage: --dry-run | --apply");
    process.exit(1);
  }
  if (isDryRun && isApply) {
    console.error("--dry-run ve --apply aynı anda kullanılamaz");
    process.exit(1);
  }

  if (!fs.existsSync(SOURCE_FILE)) {
    console.error(`Source file YOK: ${SOURCE_FILE}`);
    process.exit(1);
  }

  // Audit: file hash
  const fileBuffer = fs.readFileSync(SOURCE_FILE);
  const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
  const fileSize = fileBuffer.length;

  // Audit: actor lookup
  const actor = await prisma.user.findFirst({ where: { email: ACTOR_EMAIL }, select: { id: true } });
  if (!actor) {
    console.error(`Actor user not found: ${ACTOR_EMAIL}`);
    process.exit(1);
  }

  const startedAt = new Date();

  console.log("════════════════════════════════════════════════");
  console.log(`Ayrılan personel toplu import (${isDryRun ? "DRY-RUN" : "APPLY"})`);
  console.log("════════════════════════════════════════════════");
  console.log(`Source     : ${SOURCE_FILE}`);
  console.log(`SHA256     : ${fileHash}`);
  console.log(`Size       : ${fileSize} bytes`);
  console.log(`Sheet      : ${SOURCE_SHEET}`);
  console.log(`Actor      : ${ACTOR_EMAIL} (id=${actor.id})`);
  console.log(`Started    : ${startedAt.toISOString()}`);
  console.log("");

  // ── 1. EXCEL OKU ──
  const wb = XLSX.readFile(SOURCE_FILE);
  if (!wb.SheetNames.includes(SOURCE_SHEET)) {
    console.error(`Sheet bulunamadı: ${SOURCE_SHEET}`);
    process.exit(1);
  }
  const ws = wb.Sheets[SOURCE_SHEET];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  const header = rows[0] as unknown[];
  const dataRows = rows.slice(1);

  console.log(`Toplam Excel rows : ${dataRows.length}`);
  console.log(`Header           : ${(header.slice(0, 5) as unknown[]).join(" | ")}...`);
  console.log("");

  // ── 2. PARSE ──
  const parsed: ExcelRow[] = [];
  for (let i = 0; i < dataRows.length; i++) {
    parsed.push(parseRow(dataRows[i] as unknown[], i + 2));
  }

  // Boş satır (adSoyad ve diğer key field boş) filtrele
  const validRows = parsed.filter(r => r.adSoyad !== null);
  const emptyRows = parsed.length - validRows.length;

  console.log(`Boş satır       : ${emptyRows}`);
  console.log(`Parse edilen    : ${validRows.length}`);
  console.log("");

  // ── 3. DEDUP TARAMA ──
  let skipCount = 0;
  let createCount = 0;
  let manualSkipCount = 0;
  const dedupHits: Array<{ rowIdx: number; adSoyad: string; reason: string }> = [];
  const manualSkips: Array<{ rowIdx: number; adSoyad: string | null }> = [];
  const createList: ExcelRow[] = [];

  for (const r of validRows) {
    // Manuel skip (kolon kayması)
    if (SKIP_ROW_NUMBERS.has(r.rowIdx)) {
      manualSkipCount++;
      manualSkips.push({ rowIdx: r.rowIdx, adSoyad: r.adSoyad });
      continue;
    }
    const existing = await findExisting(r);
    if (existing) {
      skipCount++;
      dedupHits.push({ rowIdx: r.rowIdx, adSoyad: r.adSoyad ?? "?", reason: existing.reason });
    } else {
      createCount++;
      createList.push(r);
    }
  }

  // ── 4. FIELD STATS ──
  const stats = {
    sicilNo: validRows.filter(r => r.sicilNo).length,
    tcKimlikNo: validRows.filter(r => r.tcKimlikNo).length,
    sgkNo: validRows.filter(r => r.sgkNo).length,
    bankaSube: validRows.filter(r => r.bankaSube).length,
    bankaHesapNo: validRows.filter(r => r.bankaHesapNo).length,
    cinsiyet: validRows.filter(r => r.cinsiyet).length,
    yakaRengi: validRows.filter(r => r.yakaRengi).length,
    iseGirisTarihi: validRows.filter(r => r.iseGirisTarihi).length,
    exitDate: validRows.filter(r => r.exitDate).length,
    dogumTarihi: validRows.filter(r => r.dogumTarihi).length,
    dogumTarihiCorrupted: validRows.filter(r => r.errors.some(e => e.includes("dogumTarihi"))).length,
  };

  const dogumCorruptedRows = validRows
    .filter(r => r.errors.some(e => e.includes("dogumTarihi")))
    .map(r => ({ row: r.rowIdx, adSoyad: r.adSoyad, raw: r.dogumTarihiRaw }));

  console.log("── FIELD STATS ──");
  for (const [k, v] of Object.entries(stats)) {
    console.log(`  ${k}: ${v}/${validRows.length}`);
  }
  console.log("");

  if (dogumCorruptedRows.length > 0) {
    console.log("── DOĞUM TARİHİ corrupted ──");
    for (const r of dogumCorruptedRows) {
      console.log(`  row ${r.row} (${r.adSoyad}): raw=${JSON.stringify(r.raw)}`);
    }
    console.log("");
  }

  console.log("── DEDUP SONUÇ ──");
  console.log(`  Manual skip (kolon kayması): ${manualSkipCount}`);
  for (const m of manualSkips) console.log(`    row ${m.rowIdx} (${m.adSoyad})`);
  console.log(`  Dedup skip (TC eşleşmesi)  : ${skipCount}`);
  console.log(`  Create new                 : ${createCount}`);
  console.log("");

  // Sample print
  console.log("── SAMPLE (ilk 3 create) ──");
  for (const r of createList.slice(0, 3)) {
    console.log(`  row ${r.rowIdx}: ${r.adSoyad} | bolum=${r.bolum} | iseGiris=${r.iseGirisTarihi?.toISOString().slice(0, 10)} | exit=${r.exitDate?.toISOString().slice(0, 10)} | yaka=${r.yakaRengi}`);
  }
  if (createList.length > 5) {
    console.log("  ... ");
    console.log("── SAMPLE (son 2 create) ──");
    for (const r of createList.slice(-2)) {
      console.log(`  row ${r.rowIdx}: ${r.adSoyad} | bolum=${r.bolum} | iseGiris=${r.iseGirisTarihi?.toISOString().slice(0, 10)} | exit=${r.exitDate?.toISOString().slice(0, 10)} | yaka=${r.yakaRengi}`);
    }
  }
  console.log("");

  // ── 5. ZORUNLU FIELD KONTROL ──
  // Personnel modelinde NOT NULL: cinsiyet, adSoyad, yakaRengi, iseGirisTarihi, gorev, bolum
  const missingMandatory: Array<{ rowIdx: number; adSoyad: string | null; missing: string[] }> = [];
  for (const r of createList) {
    const m: string[] = [];
    if (!r.cinsiyet) m.push("cinsiyet");
    if (!r.adSoyad) m.push("adSoyad");
    if (!r.yakaRengi) m.push("yakaRengi");
    if (!r.iseGirisTarihi) m.push("iseGirisTarihi");
    if (!r.gorev) m.push("gorev");
    if (!r.bolum) m.push("bolum");
    if (m.length > 0) {
      missingMandatory.push({ rowIdx: r.rowIdx, adSoyad: r.adSoyad, missing: m });
    }
  }

  if (missingMandatory.length > 0) {
    console.log("── ZORUNLU FIELD EKSİK (oluşturulamayacak) ──");
    for (const m of missingMandatory.slice(0, 20)) {
      console.log(`  row ${m.rowIdx} (${m.adSoyad}): missing ${m.missing.join(",")}`);
    }
    if (missingMandatory.length > 20) console.log(`  ... +${missingMandatory.length - 20} satır daha`);
    console.log("");
  }

  // ── 6. APPLY (eğer flag) ──
  let appliedCount = 0;
  const applyErrors: Array<{ rowIdx: number; adSoyad: string | null; error: string }> = [];

  if (isApply) {
    console.log("── APPLY: creating records ──");
    for (const r of createList) {
      // Zorunlu eksikse atla
      const mandatoryMissing: string[] = [];
      if (!r.cinsiyet) mandatoryMissing.push("cinsiyet");
      if (!r.adSoyad) mandatoryMissing.push("adSoyad");
      if (!r.yakaRengi) mandatoryMissing.push("yakaRengi");
      if (!r.iseGirisTarihi) mandatoryMissing.push("iseGirisTarihi");
      if (!r.gorev) mandatoryMissing.push("gorev");
      if (!r.bolum) mandatoryMissing.push("bolum");
      if (mandatoryMissing.length > 0) {
        applyErrors.push({ rowIdx: r.rowIdx, adSoyad: r.adSoyad, error: `missing mandatory: ${mandatoryMissing.join(",")}` });
        continue;
      }

      try {
        // sicilNo unique check: dolu ise mevcut DB'de var mı?
        if (r.sicilNo) {
          const dup = await prisma.personnel.findUnique({ where: { sicilNo: r.sicilNo }, select: { id: true } });
          if (dup) {
            applyErrors.push({ rowIdx: r.rowIdx, adSoyad: r.adSoyad, error: `sicilNo conflict: ${r.sicilNo}` });
            continue;
          }
        }

        await prisma.$transaction(async (tx) => {
          const p = await tx.personnel.create({
            data: {
              sicilNo: r.sicilNo,
              sinif: r.sinif,
              cinsiyet: r.cinsiyet!,
              adSoyad: r.adSoyad!,
              yakaRengi: r.yakaRengi!,
              direktEndirekt: r.direktEndirekt,
              asansorMekanik: r.asansorMekanik,
              iseGirisTarihi: r.iseGirisTarihi!,
              gorev: r.gorev!,
              bolum: r.bolum!,
              birimSorumlusu: r.birimSorumlusu,
              sorumlu2: r.sorumlu2,
              sorumlu3: r.sorumlu3,
              bolumMuduru: r.bolumMuduru,
              telefon: r.telefon,
              emekli: r.emekli,
              engelli: r.engelli,
              egitimYeri: r.egitimYeri,
              egitimTipi: r.egitimTipi,
              egitimAlani: r.egitimAlani,
              mezuniyetYili: r.mezuniyetYili,
              interKepMail: r.interKepMail,
              denemeDegerlendirme: r.denemeDegerlendirme,
              altiAyDegerlendirme: r.altiAyDegerlendirme,
              aktif: false,
              exitDate: r.exitDate,
              exitParty: r.exitParty,
              exitCode: r.exitCode,
              exitReason: r.exitReason,
              exitRootCause: r.exitRootCause,
              exitTurnoverType: r.exitTurnoverType,
              exitGeneralNote: r.exitGeneralNote,
              exitRecordedById: actor.id,
              exitRecordedAt: startedAt,
              createdBy: CREATED_BY,
            },
          });

          // Sensitive — sadece dolu olanlar varsa
          if (r.tcKimlikNo || r.sgkNo || r.dogumTarihi || r.bankaSube || r.bankaHesapNo) {
            await tx.personnelSensitive.create({
              data: {
                personnelId: p.id,
                tcKimlikNo: r.tcKimlikNo,
                sgkNo: r.sgkNo,
                dogumTarihi: r.dogumTarihi,
                bankaSube: r.bankaSube,
                bankaHesapNo: r.bankaHesapNo,
                updatedBy: CREATED_BY,
              },
            });
          }
        });

        appliedCount++;
      } catch (err) {
        applyErrors.push({ rowIdx: r.rowIdx, adSoyad: r.adSoyad, error: String(err) });
      }
    }

    console.log(`  Created: ${appliedCount}`);
    console.log(`  Errors : ${applyErrors.length}`);
    if (applyErrors.length > 0) {
      console.log("  İlk 10 hata:");
      for (const e of applyErrors.slice(0, 10)) {
        console.log(`    row ${e.rowIdx} (${e.adSoyad}): ${e.error}`);
      }
    }
    console.log("");
  }

  // ── 7. RAPOR JSON ──
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const report = {
    mode: isApply ? "apply" : "dry-run",
    source: { file: SOURCE_FILE, sheet: SOURCE_SHEET, sha256: fileHash, size: fileSize },
    actor: { email: ACTOR_EMAIL, id: actor.id },
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    counts: {
      totalRows: dataRows.length,
      emptyRows,
      validRows: validRows.length,
      manualSkip: manualSkipCount,
      dedupSkip: skipCount,
      willCreate: createCount,
      missingMandatory: missingMandatory.length,
      ...(isApply ? { applied: appliedCount, applyErrors: applyErrors.length } : {}),
    },
    fieldStats: stats,
    dogumCorruptedRows,
    dedupHits: dedupHits.slice(0, 50),
    manualSkips,
    missingMandatory: missingMandatory.slice(0, 50),
    sampleCreate: createList.slice(0, 5).map(r => ({
      rowIdx: r.rowIdx,
      adSoyad: r.adSoyad,
      bolum: r.bolum,
      gorev: r.gorev,
      iseGirisTarihi: r.iseGirisTarihi?.toISOString().slice(0, 10),
      exitDate: r.exitDate?.toISOString().slice(0, 10),
      hasSensitive: !!(r.tcKimlikNo || r.sgkNo || r.dogumTarihi || r.bankaSube || r.bankaHesapNo),
    })),
    ...(isApply ? { applyErrors: applyErrors.slice(0, 50) } : {}),
  };

  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
  console.log(`Rapor JSON: ${REPORT_FILE}`);
  console.log("════════════════════════════════════════════════");

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
