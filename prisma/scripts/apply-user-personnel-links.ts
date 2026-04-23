import { PrismaClient } from "../../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const OUTPUT_DIR = path.join(process.cwd(), "prisma", "scripts", "output");
const APPLIED_CSV = path.join(OUTPUT_DIR, "f1-applied.csv");
const REVIEW_CSV = path.join(OUTPUT_DIR, "f1-review.csv");
const NOMATCH_CSV = path.join(OUTPUT_DIR, "f1-no-match.csv");

interface CsvRow {
  userId: string;
  userName: string;
  userType: string;
  suggestedPersonnelId: string;
  similarity: string;
  matchReason: string;
  status: string;
  approve?: string;
  manualPersonnelId?: string;
}

function parseCSV(filepath: string): CsvRow[] {
  if (!fs.existsSync(filepath)) return [];
  const content = fs.readFileSync(filepath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length <= 1) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row as unknown as CsvRow);
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        current += c;
      }
    } else {
      if (c === ",") {
        result.push(current);
        current = "";
      } else if (c === '"') {
        inQuotes = true;
      } else {
        current += c;
      }
    }
  }
  result.push(current);
  return result;
}

async function main() {
  const DRY_RUN = process.argv.includes("--dry-run");

  console.log(`=== Apply User-Personnel Links ${DRY_RUN ? "(DRY RUN)" : ""} ===\n`);

  const applied = parseCSV(APPLIED_CSV);
  const review = parseCSV(REVIEW_CSV);
  const noMatch = parseCSV(NOMATCH_CSV);

  console.log(`applied.csv:  ${applied.length} row`);
  console.log(`review.csv:   ${review.length} row`);
  console.log(`no-match.csv: ${noMatch.length} row\n`);

  const toApply: Array<{ userId: string; personnelId: string; source: string }> = [];

  for (const r of applied) {
    if (r.suggestedPersonnelId) {
      toApply.push({
        userId: r.userId,
        personnelId: r.suggestedPersonnelId,
        source: `applied: ${r.matchReason}`,
      });
    }
  }

  for (const r of review) {
    const approve = (r.approve ?? "").toLowerCase().trim();
    const manualId = (r.manualPersonnelId ?? "").trim();
    const finalId =
      manualId ||
      (approve === "true" || approve === "yes" || approve === "evet"
        ? r.suggestedPersonnelId
        : null);

    if (finalId) {
      toApply.push({
        userId: r.userId,
        personnelId: finalId,
        source: manualId ? `review-manual-override` : `review-approved: ${r.matchReason}`,
      });
    }
  }

  for (const r of noMatch) {
    const manualId = (r.manualPersonnelId ?? "").trim();
    if (manualId) {
      toApply.push({
        userId: r.userId,
        personnelId: manualId,
        source: "no-match-manual",
      });
    }
  }

  console.log(`Toplam ${toApply.length} User güncellenecek\n`);

  const personnelIds = [...new Set(toApply.map((t) => t.personnelId))];
  const validPersonnel = await prisma.personnel.findMany({
    where: { id: { in: personnelIds } },
    select: { id: true },
  });
  const validIds = new Set(validPersonnel.map((p) => p.id));

  const invalid = toApply.filter((t) => !validIds.has(t.personnelId));
  if (invalid.length > 0) {
    console.error(`UYARI: ${invalid.length} geçersiz personnelId var:`);
    invalid.slice(0, 10).forEach((i) => console.error(`  ${i.userId} → ${i.personnelId} (yok)`));
    console.error("\nBu kayıtlar atlanacak.");
  }

  const personnelIdCounts = new Map<string, number>();
  toApply.forEach((t) => {
    personnelIdCounts.set(t.personnelId, (personnelIdCounts.get(t.personnelId) ?? 0) + 1);
  });
  const duplicates = [...personnelIdCounts.entries()].filter(([, c]) => c > 1);
  if (duplicates.length > 0) {
    console.error(`HATA: Aynı personnelId birden fazla user'a atanıyor:`);
    duplicates.forEach(([pid, count]) => {
      const users = toApply.filter((t) => t.personnelId === pid);
      console.error(`  ${pid} → ${count} user: ${users.map((u) => u.userId).join(", ")}`);
    });
    console.error("\nDurduruldu. CSV'leri düzelt.");
    process.exit(1);
  }

  const final = toApply.filter((t) => validIds.has(t.personnelId));

  if (DRY_RUN) {
    console.log(`\nDRY RUN — hiçbir şey yazılmadı.`);
    console.log(`Uygulansa ${final.length} user güncellenirdi.`);
    return;
  }

  console.log(`\nUygulanıyor...`);
  let applied_count = 0;
  const failed: Array<{ userId: string; error: string }> = [];

  for (const t of final) {
    try {
      await prisma.user.update({
        where: { id: t.userId },
        data: { personnelId: t.personnelId },
      });
      applied_count++;
    } catch (e) {
      failed.push({
        userId: t.userId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  console.log(`\n✓ ${applied_count}/${final.length} user güncellendi`);
  if (failed.length > 0) {
    console.log(`✗ ${failed.length} başarısız:`);
    failed.forEach((f) => console.log(`  ${f.userId}: ${f.error}`));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pool.end());
