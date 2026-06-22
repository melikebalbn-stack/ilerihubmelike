/**
 * PR-2 ilk-patlama bastırma (deploy adımı). Migration sonrası ŞU AN bekleyen
 * AKTİF onay adımının reminderSentAt'ini now yapar → eski backlog ilk cron
 * taramasında mail ALMAZ; hatırlatma yalnız bundan sonra gecikenlere gider.
 *
 * KRİTİK: form başına yalnız AKTİF bekleyen adım (en düşük step'li decision===null)
 * işaretlenir. Gelecekteki bekleyen adımlar (henüz sıraları gelmedi) DOKUNULMAZ —
 * aksi halde aktif olduklarında kendi 5dk/1-kez hatırlatma hakkını kaybederler.
 *
 * Kullanım: npx tsx scripts/suppress-overtime-reminder-burst.ts [--commit]
 */
import { prisma } from "@/lib/prisma";

const COMMIT = process.argv.includes("--commit");

async function main() {
  const now = new Date();
  const forms = await prisma.overtimeForm.findMany({
    where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
    select: {
      formNo: true,
      approvals: {
        orderBy: { step: "asc" },
        select: { id: true, step: true, role: true, decision: true, reminderSentAt: true },
      },
    },
  });

  const targets: { id: string; formNo: string; step: number; role: string }[] = [];
  for (const f of forms) {
    const active = f.approvals.find((a) => a.decision === null); // aktif bekleyen adım
    if (active && active.reminderSentAt === null) {
      targets.push({ id: active.id, formNo: f.formNo, step: active.step, role: active.role });
    }
  }

  console.log(`Aktif onay sürecinde form: ${forms.length}`);
  console.log(`Bastırılacak aktif bekleyen adım: ${targets.length}`);
  targets.forEach((t) => console.log(`  - ${t.formNo} step ${t.step} (${t.role})`));

  if (targets.length === 0) {
    console.log("Bastırılacak kayıt yok.");
    return;
  }
  if (!COMMIT) {
    console.log("[DRY-RUN] --commit ile uygula.");
    return;
  }

  const res = await prisma.overtimeApproval.updateMany({
    where: { id: { in: targets.map((t) => t.id) } },
    data: { reminderSentAt: now },
  });
  console.log(`COMMIT OK → ${res.count} adım reminderSentAt=now ile bastırıldı.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
