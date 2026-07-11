import { Prisma, JobApplicationStatus } from "@/generated/prisma";

// Başvuru aşama/durum geçişleri için TEK GEÇİT.
// Amaç: PublicJobApplication.status her değiştiğinde, aynı transaction içinde
// PublicJobApplicationStageLog satırı otomatik yazılsın. Böylece Time-to-Hire,
// aşama-bazlı süre ve darboğaz analizi için eksiksiz bir geçiş geçmişi tutulur.
//
// KURAL: status'u doğrudan güncelleme; her zaman updateApplicationStatus'tan geç.
// (create ile ilk kayıt için logInitialStage kullanılır — "from" yoktur.)

type TxClient = Prisma.TransactionClient;

// Düşük seviye log yazıcı — hem geçişlerde hem ilk kayıtta kullanılır.
async function writeStageLog(
  tx: TxClient,
  args: {
    applicationId: string;
    fromStatus: JobApplicationStatus | null;
    toStatus: JobApplicationStatus;
    changedBy?: string | null;
    note?: string | null;
  },
) {
  await tx.publicJobApplicationStageLog.create({
    data: {
      applicationId: args.applicationId,
      fromStatus: args.fromStatus,
      toStatus: args.toStatus,
      changedBy: args.changedBy ?? null,
      note: args.note ?? null,
    },
  });
}

// İlk kayıt (create) için başlangıç log satırı: fromStatus = null.
// consent/route.ts gibi kaydın YENİ oluşturulduğu noktada, aynı tx'te çağrılır.
export async function logInitialStage(
  tx: TxClient,
  args: {
    applicationId: string;
    toStatus: JobApplicationStatus;
    changedBy?: string | null;
    note?: string | null;
  },
) {
  await writeStageLog(tx, { ...args, fromStatus: null });
}

// Durum geçişi için TEK GEÇİT: mevcut status'u oku → güncelle → log yaz (atomik).
// data: status DIŞINDA aynı anda güncellenecek alanlar (davranış korunur).
// fromStatus === toStatus ise log YAZILMAZ (gereksiz satır).
export async function updateApplicationStatus(
  tx: TxClient,
  args: {
    applicationId: string;
    toStatus: JobApplicationStatus;
    changedBy?: string | null;
    note?: string | null;
    data?: Prisma.PublicJobApplicationUpdateInput;
  },
) {
  const current = await tx.publicJobApplication.findUnique({
    where: { id: args.applicationId },
    select: { status: true },
  });
  if (!current) {
    throw new Error(`PublicJobApplication bulunamadı: ${args.applicationId}`);
  }
  const fromStatus = current.status;

  const updated = await tx.publicJobApplication.update({
    where: { id: args.applicationId },
    data: { ...(args.data ?? {}), status: args.toStatus },
  });

  if (fromStatus !== args.toStatus) {
    await writeStageLog(tx, {
      applicationId: args.applicationId,
      fromStatus,
      toStatus: args.toStatus,
      changedBy: args.changedBy,
      note: args.note,
    });
  }

  return updated;
}
