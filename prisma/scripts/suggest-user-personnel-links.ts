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

function tr(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toUpperCase()
    .replace(/İ/g, "I")
    .replace(/I/g, "I")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ş/g, "S")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C")
    .replace(/\s+/g, " ")
    .trim();
}

const OUTPUT_DIR = path.join(process.cwd(), "prisma", "scripts", "output");
const APPLIED_CSV = path.join(OUTPUT_DIR, "f1-applied.csv");
const REVIEW_CSV = path.join(OUTPUT_DIR, "f1-review.csv");
const NOMATCH_CSV = path.join(OUTPUT_DIR, "f1-no-match.csv");

interface Row {
  userId: string;
  userName: string;
  userEmail: string;
  userEmployeeId: string | null;
  userType: "blue" | "white";
  suggestedPersonnelId: string | null;
  suggestedPersonnelAdSoyad: string | null;
  suggestedPersonnelSicilNo: string | null;
  suggestedPersonnelBolum: string | null;
  similarity: number | null;
  alternativeCount: number;
  matchReason: string;
  status: "applied" | "review" | "no-match";
}

async function main() {
  console.log("=== Suggest User-Personnel Links ===\n");

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      employeeId: true,
      personnelId: true,
    },
  });

  const personnel = await prisma.personnel.findMany({
    select: {
      id: true,
      sicilNo: true,
      adSoyad: true,
      bolum: true,
    },
  });

  console.log(`${users.length} user, ${personnel.length} personnel\n`);

  const results: Row[] = [];

  const sicilMap = new Map<string, (typeof personnel)[0]>();
  personnel.forEach((p) => {
    if (p.sicilNo) sicilMap.set(p.sicilNo.toUpperCase(), p);
  });

  const adSoyadMap = new Map<string, (typeof personnel)[0][]>();
  personnel.forEach((p) => {
    if (p.adSoyad) {
      const key = p.adSoyad.toUpperCase().trim();
      const arr = adSoyadMap.get(key) ?? [];
      arr.push(p);
      adSoyadMap.set(key, arr);
    }
  });

  const adSoyadNormMap = new Map<string, (typeof personnel)[0][]>();
  personnel.forEach((p) => {
    if (p.adSoyad) {
      const key = tr(p.adSoyad);
      const arr = adSoyadNormMap.get(key) ?? [];
      arr.push(p);
      adSoyadNormMap.set(key, arr);
    }
  });

  for (const u of users) {
    if (u.personnelId) continue;

    const isBlueCollar = !!u.employeeId;
    const userType: Row["userType"] = isBlueCollar ? "blue" : "white";

    if (isBlueCollar && u.employeeId) {
      const candidate = `ILR-${u.employeeId.padStart(5, "0")}`;
      const match = sicilMap.get(candidate);

      if (match) {
        results.push({
          userId: u.id,
          userName: u.name ?? "",
          userEmail: u.email ?? "",
          userEmployeeId: u.employeeId,
          userType,
          suggestedPersonnelId: match.id,
          suggestedPersonnelAdSoyad: match.adSoyad,
          suggestedPersonnelSicilNo: match.sicilNo,
          suggestedPersonnelBolum: match.bolum,
          similarity: null,
          alternativeCount: 1,
          matchReason: "sicilNo-exact",
          status: "applied",
        });
        continue;
      }

      const altCandidates = [
        `ILR-${u.employeeId}`,
        u.employeeId,
        u.employeeId.padStart(5, "0"),
        `ILR-${u.employeeId.trim()}`,
      ];
      let altMatch: (typeof personnel)[0] | undefined;
      for (const alt of altCandidates) {
        altMatch = sicilMap.get(alt.toUpperCase());
        if (altMatch) break;
      }

      if (altMatch) {
        results.push({
          userId: u.id,
          userName: u.name ?? "",
          userEmail: u.email ?? "",
          userEmployeeId: u.employeeId,
          userType,
          suggestedPersonnelId: altMatch.id,
          suggestedPersonnelAdSoyad: altMatch.adSoyad,
          suggestedPersonnelSicilNo: altMatch.sicilNo,
          suggestedPersonnelBolum: altMatch.bolum,
          similarity: null,
          alternativeCount: 1,
          matchReason: "sicilNo-alt-format",
          status: "review",
        });
        continue;
      }

      const userName = (u.name ?? "").toUpperCase().trim();
      if (userName) {
        const exact = adSoyadMap.get(userName);
        if (exact && exact.length === 1) {
          results.push({
            userId: u.id,
            userName: u.name ?? "",
            userEmail: u.email ?? "",
            userEmployeeId: u.employeeId,
            userType,
            suggestedPersonnelId: exact[0].id,
            suggestedPersonnelAdSoyad: exact[0].adSoyad,
            suggestedPersonnelSicilNo: exact[0].sicilNo,
            suggestedPersonnelBolum: exact[0].bolum,
            similarity: 1.0,
            alternativeCount: 1,
            matchReason: "blue-name-exact",
            status: "review",
          });
          continue;
        }
      }

      results.push({
        userId: u.id,
        userName: u.name ?? "",
        userEmail: u.email ?? "",
        userEmployeeId: u.employeeId,
        userType,
        suggestedPersonnelId: null,
        suggestedPersonnelAdSoyad: null,
        suggestedPersonnelSicilNo: null,
        suggestedPersonnelBolum: null,
        similarity: null,
        alternativeCount: 0,
        matchReason: "blue-no-match",
        status: "no-match",
      });
      continue;
    }

    const userCandidates = [
      u.name,
      u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : null,
    ].filter(Boolean) as string[];

    if (userCandidates.length === 0) {
      results.push({
        userId: u.id,
        userName: u.name ?? "",
        userEmail: u.email ?? "",
        userEmployeeId: u.employeeId,
        userType,
        suggestedPersonnelId: null,
        suggestedPersonnelAdSoyad: null,
        suggestedPersonnelSicilNo: null,
        suggestedPersonnelBolum: null,
        similarity: null,
        alternativeCount: 0,
        matchReason: "no-user-name",
        status: "no-match",
      });
      continue;
    }

    const primaryCandidate = userCandidates[0];
    const userNorm = tr(primaryCandidate);

    // PASS 1: Exact tr-normalized match
    const exactMatches = adSoyadNormMap.get(userNorm) ?? [];

    if (exactMatches.length === 1) {
      const m = exactMatches[0];
      results.push({
        userId: u.id,
        userName: u.name ?? "",
        userEmail: u.email ?? "",
        userEmployeeId: u.employeeId,
        userType,
        suggestedPersonnelId: m.id,
        suggestedPersonnelAdSoyad: m.adSoyad,
        suggestedPersonnelSicilNo: m.sicilNo,
        suggestedPersonnelBolum: m.bolum,
        similarity: 1.0,
        alternativeCount: 1,
        matchReason: "white-normalized-exact",
        status: "applied",
      });
      continue;
    }

    if (exactMatches.length > 1) {
      const m = exactMatches[0];
      results.push({
        userId: u.id,
        userName: u.name ?? "",
        userEmail: u.email ?? "",
        userEmployeeId: u.employeeId,
        userType,
        suggestedPersonnelId: m.id,
        suggestedPersonnelAdSoyad: m.adSoyad,
        suggestedPersonnelSicilNo: m.sicilNo,
        suggestedPersonnelBolum: m.bolum,
        similarity: 1.0,
        alternativeCount: exactMatches.length,
        matchReason: "white-normalized-multiple",
        status: "review",
      });
      continue;
    }

    // PASS 2: Substring full-match
    const userWords = userNorm.split(" ").filter((w) => w.length >= 2);
    const substringMatches: (typeof personnel)[0][] = [];

    if (userWords.length > 0) {
      for (const p of personnel) {
        if (!p.adSoyad) continue;
        const pNorm = tr(p.adSoyad);
        const allFound = userWords.every((w) => pNorm.includes(w));
        if (allFound) substringMatches.push(p);
      }
    }

    if (substringMatches.length === 1) {
      const m = substringMatches[0];
      results.push({
        userId: u.id,
        userName: u.name ?? "",
        userEmail: u.email ?? "",
        userEmployeeId: u.employeeId,
        userType,
        suggestedPersonnelId: m.id,
        suggestedPersonnelAdSoyad: m.adSoyad,
        suggestedPersonnelSicilNo: m.sicilNo,
        suggestedPersonnelBolum: m.bolum,
        similarity: null,
        alternativeCount: 1,
        matchReason: "white-substring-unique",
        status: "applied",
      });
      continue;
    }

    if (substringMatches.length > 1) {
      const m = substringMatches[0];
      results.push({
        userId: u.id,
        userName: u.name ?? "",
        userEmail: u.email ?? "",
        userEmployeeId: u.employeeId,
        userType,
        suggestedPersonnelId: m.id,
        suggestedPersonnelAdSoyad: m.adSoyad,
        suggestedPersonnelSicilNo: m.sicilNo,
        suggestedPersonnelBolum: m.bolum,
        similarity: null,
        alternativeCount: substringMatches.length,
        matchReason: "white-substring-multiple",
        status: "review",
      });
      continue;
    }

    // PASS 3: pg_trgm fuzzy
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        adSoyad: string;
        sicilNo: string;
        bolum: string;
        sim: number;
      }>
    >`
      SELECT p.id, p."adSoyad", p."sicilNo", p.bolum,
             similarity(UPPER(p."adSoyad"), UPPER(${primaryCandidate})) AS sim
      FROM "Personnel" p
      WHERE similarity(UPPER(p."adSoyad"), UPPER(${primaryCandidate})) > 0.7
      ORDER BY sim DESC
      LIMIT 5
    `;

    if (rows.length === 0) {
      results.push({
        userId: u.id,
        userName: u.name ?? "",
        userEmail: u.email ?? "",
        userEmployeeId: u.employeeId,
        userType,
        suggestedPersonnelId: null,
        suggestedPersonnelAdSoyad: null,
        suggestedPersonnelSicilNo: null,
        suggestedPersonnelBolum: null,
        similarity: null,
        alternativeCount: 0,
        matchReason: "white-no-match",
        status: "no-match",
      });
      continue;
    }

    const top = rows[0];
    results.push({
      userId: u.id,
      userName: u.name ?? "",
      userEmail: u.email ?? "",
      userEmployeeId: u.employeeId,
      userType,
      suggestedPersonnelId: top.id,
      suggestedPersonnelAdSoyad: top.adSoyad,
      suggestedPersonnelSicilNo: top.sicilNo,
      suggestedPersonnelBolum: top.bolum,
      similarity: Number(top.sim),
      alternativeCount: rows.length,
      matchReason: "white-fuzzy",
      status: "review",
    });
  }

  const applied = results.filter((r) => r.status === "applied");
  const review = results.filter((r) => r.status === "review");
  const noMatch = results.filter((r) => r.status === "no-match");

  writeCSV(APPLIED_CSV, applied);
  writeCSV(REVIEW_CSV, review, true);
  writeCSV(NOMATCH_CSV, noMatch, true);

  console.log(`\nSONUÇ:`);
  console.log(`  applied  (otomatik yapılacak): ${applied.length}`);
  console.log(
    `    mavi yaka sicilNo-exact:   ${applied.filter((r) => r.matchReason === "sicilNo-exact").length}`
  );
  console.log(
    `    beyaz yaka exact-unique:   ${applied.filter((r) => r.matchReason === "white-exact-unique").length}`
  );
  console.log(`  review   (onayın gerekli):    ${review.length}`);
  console.log(
    `    sicilNo-alt-format:        ${review.filter((r) => r.matchReason === "sicilNo-alt-format").length}`
  );
  console.log(
    `    blue-name-exact:           ${review.filter((r) => r.matchReason === "blue-name-exact").length}`
  );
  console.log(
    `    white-exact-multiple:      ${review.filter((r) => r.matchReason === "white-exact-multiple").length}`
  );
  console.log(
    `    white-fuzzy:               ${review.filter((r) => r.matchReason === "white-fuzzy").length}`
  );
  console.log(`  no-match (manuel gerekli):    ${noMatch.length}`);
  console.log(`\nCSV'ler: ${OUTPUT_DIR}`);
  console.log(`\nApply için: npx tsx prisma/scripts/apply-user-personnel-links.ts`);
}

function writeCSV(filepath: string, rows: Row[], includeApproveColumn = false) {
  const headers = [
    "userId",
    "userName",
    "userEmail",
    "userEmployeeId",
    "userType",
    "suggestedPersonnelId",
    "suggestedPersonnelAdSoyad",
    "suggestedPersonnelSicilNo",
    "suggestedPersonnelBolum",
    "similarity",
    "alternativeCount",
    "matchReason",
    "status",
  ];
  if (includeApproveColumn) {
    headers.push("approve");
    headers.push("manualPersonnelId");
  }

  const lines = [headers.join(",")];
  for (const r of rows) {
    const base = [
      r.userId,
      csvEscape(r.userName),
      csvEscape(r.userEmail),
      r.userEmployeeId ?? "",
      r.userType,
      r.suggestedPersonnelId ?? "",
      csvEscape(r.suggestedPersonnelAdSoyad ?? ""),
      r.suggestedPersonnelSicilNo ?? "",
      csvEscape(r.suggestedPersonnelBolum ?? ""),
      r.similarity?.toFixed(3) ?? "",
      r.alternativeCount.toString(),
      r.matchReason,
      r.status,
    ];
    if (includeApproveColumn) {
      base.push("");
      base.push("");
    }
    lines.push(base.join(","));
  }

  fs.writeFileSync(filepath, lines.join("\n"), "utf-8");
  console.log(`  ${path.basename(filepath)}: ${rows.length} row`);
}

function csvEscape(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pool.end());
