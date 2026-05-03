// @ts-nocheck — one-shot smoke test, schema-bound types are fine at runtime
import { PrismaClient } from "../../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import { notifyAkademiEvent } from "../../src/lib/akademi-notify";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const TEST_USER_EMAIL =
  process.env.TEST_NOTIFY_EMAIL || "melihdilben@gmail.com";
const TEST_COURSE_TITLE = "Test Eğitimi (BİLDİRİM SİSTEMİ TESTİ)";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: TEST_USER_EMAIL },
    select: { id: true, name: true, email: true },
  });
  if (!user) throw new Error(`Test user ${TEST_USER_EMAIL} bulunamadı`);

  console.log(`[TEST] Hedef user: ${user.name} <${user.email}> (${user.id})`);

  const events = [
    {
      type: "COURSE_ASSIGNED",
      data: { deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    },
    { type: "ASSIGNMENT_CANCELLED", data: { reason: "Test iptal" } },
    {
      type: "DEADLINE_APPROACHING",
      data: {
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        daysLeft: 7,
      },
    },
    {
      type: "DEADLINE_MISSED",
      data: {
        deadline: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        daysLate: 3,
      },
    },
    {
      type: "EXAM_PASSED",
      data: { score: 85, passingScore: 70, attemptNumber: 1 },
    },
    {
      type: "EXAM_FAILED",
      data: { score: 55, passingScore: 70, attemptNumber: 1, canRetake: true },
    },
    {
      type: "CERTIFICATE_ISSUED",
      data: {
        certificateNo: "ILR-CERT-2026-TEST",
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    },
    {
      type: "CERTIFICATE_EXPIRING_SOON",
      data: {
        certificateNo: "ILR-CERT-2025-001",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        daysLeft: 30,
      },
    },
    {
      type: "CERTIFICATE_EXPIRED",
      data: {
        certificateNo: "ILR-CERT-2024-001",
        expiredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
    },
  ];

  for (const e of events) {
    console.log(`\n[TEST] ${e.type}`);
    await notifyAkademiEvent({
      userId: user.id,
      eventType: e.type as any,
      courseTitle: TEST_COURSE_TITLE,
      data: e.data,
      link: "/akademi",
    });
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log("\n[OK] 9 event test gönderildi.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
