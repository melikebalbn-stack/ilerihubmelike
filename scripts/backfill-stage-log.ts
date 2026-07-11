/**
 * PublicJobApplicationStageLog BACKFILL — dürüst, idempotent, dry-run öncelikli.
 *
 * Kural (UYDURMA ZAMAN DAMGASI YOK):
 *   - Her kayda 1 "başvuru geldi" satırı: createdAt (gerçek), from=null → to=PENDING.
 *     Gerekçe: mevcut kayıtların HEPSİ eski akıştan (consent/health kaydı=0); form
 *     gönderiminde PENDING'e giriyorlar. createdAt = gerçek gönderim anı.
 *   - Yalnız status'u GERÇEKTEN değişmiş (updatedAt > createdAt VE status != PENDING)
 *     kayıtlara 1 "güncel durum" satırı: updatedAt (gerçek), from=null (ara hop
 *     bilinmiyor → uydurulmaz) → to=currentStatus.
 *   - updatedAt > createdAt ama hâlâ PENDING olanlar: ikinci satır YAZILMAZ (bu bir
 *     notes düzenlemesidir, status geçişi değil — PENDING→PENDING uydurma olur).
 *
 * Idempotent: zaten stageLog'u olan başvuru ATLANIR.
 * Çalıştırma:  npx tsx scripts/backfill-stage-log.ts            (DRY-RUN, hiçbir şey yazmaz)
 *              npx tsx scripts/backfill-stage-log.ts --commit   (staging'de yazar)
 */
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const COMMIT = process.argv.includes("--commit");
const CHANGED_THRESHOLD_MS = 1000; // updatedAt-createdAt > 1sn => gerçekten güncellenmiş

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const apps = await prisma.publicJobApplication.findMany({
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { stageLogs: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    let atlanan = 0;
    let arrivalRows = 0;
    let currentRows = 0;
    const planlanan: {
      applicationId: string;
      toStatus: string;
      at: Date;
      kind: string;
    }[] = [];

    for (const a of apps) {
      if (a._count.stageLogs > 0) {
        atlanan++;
        continue; // idempotent
      }

      // 1) başvuru geldi satırı
      planlanan.push({ applicationId: a.id, toStatus: "PENDING", at: a.createdAt, kind: "arrival" });
      arrivalRows++;

      // 2) gerçek status değişimi olan güncel-durum satırı
      const changed = a.updatedAt.getTime() - a.createdAt.getTime() > CHANGED_THRESHOLD_MS;
      if (changed && a.status !== "PENDING") {
        planlanan.push({ applicationId: a.id, toStatus: a.status, at: a.updatedAt, kind: "current" });
        currentRows++;
      }
    }

    const toplam = arrivalRows + currentRows;
    console.log(`\n=== BACKFILL ${COMMIT ? "(COMMIT)" : "(DRY-RUN)"} ===`);
    console.log(`Başvuru toplam            : ${apps.length}`);
    console.log(`Atlanan (zaten log'u var) : ${atlanan}`);
    console.log(`Yazılacak 'arrival' satır : ${arrivalRows}`);
    console.log(`Yazılacak 'current' satır : ${currentRows}`);
    console.log(`TOPLAM yazılacak satır    : ${toplam}`);
    console.log(`(Not: ara hop'lar uydurulmadı; PENDING→PENDING satırı yazılmadı)\n`);

    if (!COMMIT) {
      console.log("DRY-RUN — hiçbir şey yazılmadı. Yazmak için: --commit");
      return;
    }

    // COMMIT: her başvuruyu tek transaction'da yaz (idempotency korunur).
    let yazilan = 0;
    for (const a of apps) {
      const rows = planlanan.filter((p) => p.applicationId === a.id);
      if (rows.length === 0) continue;
      await prisma.$transaction(
        rows.map((r) =>
          prisma.publicJobApplicationStageLog.create({
            data: {
              applicationId: r.applicationId,
              fromStatus: null,
              toStatus: r.toStatus as never,
              changedBy: null,
              note: r.kind === "arrival"
                ? "backfill: başvuru geldi (eski kayıt, PENDING girişi)"
                : "backfill: güncel durum @ updatedAt (ara geçişler bilinmiyor)",
              createdAt: r.at, // gerçek tarihsel zaman
            },
          }),
        ),
      );
      yazilan += rows.length;
    }
    console.log(`YAZILDI: ${yazilan} satır.`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
