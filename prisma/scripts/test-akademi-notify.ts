import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import * as dotenv from "dotenv";
import { PrismaClient } from "../../src/generated/prisma";
import { sendEmail } from "../../src/lib/email";
import {
  courseAssigned,
  assignmentCancelled,
  deadlineApproaching,
  deadlineMissed,
  examPassed,
  examFailed,
  certificateIssued,
  certificateExpiringSoon,
  certificateExpired,
} from "../../src/lib/email-templates/akademi";
import type {
  AkademiEventType,
  NotifyContext,
  RecipientGroup,
} from "../../src/lib/akademi-notify";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

const TEST_EMAIL =
  process.env.TEST_NOTIFY_EMAIL || "melihdilben@gmail.com";
const TEST_COURSE_TITLE = "Test Eğitimi (BİLDİRİM SİSTEMİ TESTİ)";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Sahte alıcı grubu — hepsi TEST_EMAIL'e döner.
 * Gerçek resolveRecipients çağrılmıyor → İK ve müdüre mail GİTMEZ.
 */
function buildFakeRecipients(): RecipientGroup {
  return {
    user: { id: "test-user", email: TEST_EMAIL, name: "Melih Dilben (TEST)" },
    manager: {
      id: "test-manager",
      email: TEST_EMAIL,
      name: "Test Bölüm Müdürü",
    },
    hr: [{ id: "test-hr-1", email: TEST_EMAIL, name: "Test İK Üyesi" }],
  };
}

/**
 * Event tipine göre template dispatch (akademi-notify.ts'deki ile paralel,
 * burada bypass için duplike — production kodu dokunulmamış).
 */
function dispatch(ctx: NotifyContext, recipients: RecipientGroup) {
  switch (ctx.eventType) {
    case "COURSE_ASSIGNED":
      return courseAssigned(ctx, recipients);
    case "ASSIGNMENT_CANCELLED":
      return assignmentCancelled(ctx, recipients);
    case "DEADLINE_APPROACHING":
      return deadlineApproaching(ctx, recipients);
    case "DEADLINE_MISSED":
      return deadlineMissed(ctx, recipients);
    case "EXAM_PASSED":
      return examPassed(ctx, recipients);
    case "EXAM_FAILED":
      return examFailed(ctx, recipients);
    case "CERTIFICATE_ISSUED":
      return certificateIssued(ctx, recipients);
    case "CERTIFICATE_EXPIRING_SOON":
      return certificateExpiringSoon(ctx, recipients);
    case "CERTIFICATE_EXPIRED":
      return certificateExpired(ctx, recipients);
    default:
      throw new Error(`Unknown event: ${(ctx as { eventType: string }).eventType}`);
  }
}

async function main() {
  console.log(
    `\n[TEST MODE] Tüm mailler ${TEST_EMAIL} adresine gönderilecek.`
  );
  console.log(
    `[TEST MODE] Gerçek alıcılara (İK, müdür, kullanıcı) mail GİTMİYOR.\n`
  );

  const events: Array<{ type: AkademiEventType; data: Record<string, unknown> }> = [
    {
      type: "COURSE_ASSIGNED",
      data: { deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    },
    {
      type: "ASSIGNMENT_CANCELLED",
      data: { reason: "Test iptal" },
    },
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
      data: {
        score: 55,
        passingScore: 70,
        attemptNumber: 1,
        canRetake: true,
      },
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

  const recipients = buildFakeRecipients();
  const recipientList = [{ email: TEST_EMAIL, name: "Melih Dilben (TEST)" }];

  let okCount = 0;
  let failCount = 0;

  for (const e of events) {
    const ctx: NotifyContext = {
      userId: "test-user",
      eventType: e.type,
      courseTitle: TEST_COURSE_TITLE,
      data: e.data,
      link: "/akademi",
    };

    const content = dispatch(ctx, recipients);

    console.log(`[${e.type}]`);

    // Kullanıcı template'i
    try {
      const result = await sendEmail(
        recipientList,
        `[KULLANICI] ${content.subject}`,
        content.textForUser,
        content.htmlForUser
      );
      if (result.success) {
        console.log(`  ✓ kullanıcı template`);
        okCount++;
      } else {
        console.error(`  ✗ kullanıcı template: ${result.error}`);
        failCount++;
      }
    } catch (err) {
      console.error(`  ✗ kullanıcı template (throw):`, (err as Error).message);
      failCount++;
    }

    // Müdür/İK template'i
    try {
      const result = await sendEmail(
        recipientList,
        `[MÜDÜR/İK] ${content.subject}`,
        content.textForManager,
        content.htmlForManager
      );
      if (result.success) {
        console.log(`  ✓ müdür/İK template`);
        okCount++;
      } else {
        console.error(`  ✗ müdür/İK template: ${result.error}`);
        failCount++;
      }
    } catch (err) {
      console.error(`  ✗ müdür/İK template (throw):`, (err as Error).message);
      failCount++;
    }

    // SMTP rate limit
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log(`\n[SUMMARY] ${okCount} OK, ${failCount} FAIL`);
  console.log(`[INFO] Mail kutuna bak: ${TEST_EMAIL}`);
  console.log(`[INFO] Beklenen: 9 event × 2 template = 18 mail.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
