import { PrismaClient } from "../../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const TEST_FORM_NOS = ["OT-2026-002", "OT-2026-003", "OT-2026-004"];

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const forms = await prisma.overtimeForm.findMany({
    where: { formNo: { in: TEST_FORM_NOS } },
    select: { id: true, formNo: true, status: true, createdAt: true },
  });

  console.log(`\n[FOUND] ${forms.length} form bulundu:`);
  console.table(forms);

  if (forms.length === 0) {
    console.log("[SKIP] Silinecek form yok.");
    return;
  }

  if (forms.length !== TEST_FORM_NOS.length) {
    console.warn(
      `[WARN] Beklenen ${TEST_FORM_NOS.length}, bulunan ${forms.length}. Devam ediliyor.`
    );
  }

  const formIds = forms.map((f) => f.id);

  await prisma.$transaction(async (tx) => {
    const opDeleted = await tx.overtimePersonnel.deleteMany({
      where: { overtimeFormId: { in: formIds } },
    });
    console.log(`[OP] ${opDeleted.count} OvertimePersonnel silindi`);

    const apDeleted = await tx.overtimeApproval.deleteMany({
      where: { overtimeFormId: { in: formIds } },
    });
    console.log(`[APPROVAL] ${apDeleted.count} OvertimeApproval silindi`);

    const formDeleted = await tx.overtimeForm.deleteMany({
      where: { id: { in: formIds } },
    });
    console.log(`[FORM] ${formDeleted.count} OvertimeForm silindi`);
  });

  const remaining = await prisma.overtimePersonnel.count({
    where: { personnelId: null },
  });
  console.log(`\n[AFTER] personnelId NULL OP: ${remaining}`);

  const totalForms = await prisma.overtimeForm.count();
  console.log(`[AFTER] Toplam form: ${totalForms}`);

  if (remaining !== 0) {
    console.error("[FAIL] Hâlâ NULL kayıt var, schema temizliğine geçme.");
    process.exit(1);
  }
  console.log("[OK] Test form temizliği tamam, schema migration güvenli.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
