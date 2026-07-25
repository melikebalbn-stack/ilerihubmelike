import { Prisma, JobApplicationStatus } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { notifyApplicationStageChange } from "@/lib/hr-notifications";
import { ensureAssessmentSession, AssessmentSessionError } from "@/lib/recruitment/assessment-session";
import { requiresAssessment } from "@/lib/recruitment/transitions";

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
    // Workflow: müdür ataması. Verilirse assignedManagerId + assignedAt AYNI tx'te yazılır.
    // (relation connect ile — assignedManagerId scalar FK'si relation üzerinden yönetilir.)
    assignedManagerId?: string | null;
    // Yeniden atama gibi AYNI-durum geçişlerinde de StageLog yazılsın (aksi halde
    // fromStatus === toStatus olduğundan log atlanır ve "müdür yeniden atandı" izi kaybolur).
    forceLog?: boolean;
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

  // Atama verilmişse aynı update data'sına ekle (aynı transaction, atomik).
  const assignData: Prisma.PublicJobApplicationUpdateInput =
    args.assignedManagerId !== undefined && args.assignedManagerId !== null
      ? { assignedManager: { connect: { id: args.assignedManagerId } }, assignedAt: new Date() }
      : {};

  const updated = await tx.publicJobApplication.update({
    where: { id: args.applicationId },
    data: { ...(args.data ?? {}), ...assignData, status: args.toStatus },
  });

  if (fromStatus !== args.toStatus || args.forceLog) {
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

// Workflow üst-geçit: status update + StageLog + (varsa) müdür ataması TEK transaction'da;
// COMMIT'ten SONRA bildirim gönderilir. Bildirim hatası transaction'ı GERİ ALMAZ
// (try/catch + console.error) — durum değişimi kalıcı, bildirim best-effort.
// Mevcut updateApplicationStatus(tx, ...) çağıranları etkilemez (bu ayrı, üst-seviye API).
export async function transitionApplicationStatus(args: {
  applicationId: string;
  toStatus: JobApplicationStatus;
  changedBy?: string | null;
  note?: string | null;
  assignedManagerId?: string | null;
  actorName?: string | null;
  // REJECTED geçişinde ret nedeni. Verilirse PublicJobApplication.rejectionReasonId AYNI
  // tx'te yazılır ve StageLog note'una nedenin ETİKETİ (ham id değil) eklenir.
  rejectionReasonId?: string | null;
  // SINAV geçişinde sınav. Verilirse AYNI tx'te AssessmentSession açılır (idempotent) +
  // StageLog note'una sınav ADI eklenir. Oturum açılamazsa tüm geçiş geri alınır.
  assessmentId?: string | null;
}) {
  // Güvenlik ağı (invariant): SINAV'a geçiş assessmentId olmadan yapılamaz — oturumsuz
  // SINAV üretilemez. Tek çağıran (transition route) zaten guard'lı; bu, gelecekteki
  // çağıranlar için de kapıyı kapatır. Tx'ten ÖNCE fast-fail (hiçbir yazma olmadan).
  if (requiresAssessment(args.toStatus) && !args.assessmentId) {
    throw new AssessmentSessionError("Sınav seçimi zorunlu", 400);
  }

  // İşlem: önce mevcut durumu + başvuran adını oku (bildirim metni için), sonra güncelle.
  const outcome = await prisma.$transaction(async (tx) => {
    const before = await tx.publicJobApplication.findUnique({
      where: { id: args.applicationId },
      select: { status: true, fullName: true, assignedManagerId: true },
    });
    if (!before) {
      throw new Error(`PublicJobApplication bulunamadı: ${args.applicationId}`);
    }

    // D4: MUDUR_DEGERLENDIRME → MUDUR_DEGERLENDIRME + müdür değişiyorsa (yeniden atama),
    // StageLog note'una "eski → yeni müdür" bilgisini ekle (isimlerle).
    let effectiveNote = args.note ?? null;
    const isReassign =
      before.status === "MUDUR_DEGERLENDIRME" &&
      args.toStatus === "MUDUR_DEGERLENDIRME" &&
      !!args.assignedManagerId &&
      args.assignedManagerId !== before.assignedManagerId;
    if (isReassign) {
      const ids = [before.assignedManagerId, args.assignedManagerId].filter(
        (x): x is string => !!x,
      );
      const users = await tx.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, firstName: true, lastName: true, email: true },
      });
      const nameOf = (id: string | null): string => {
        if (!id) return "(atanmamış)";
        const u = users.find((x) => x.id === id);
        if (!u) return id;
        return [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.name || u.email || id;
      };
      const reassignNote = `Müdür yeniden atandı: ${nameOf(before.assignedManagerId)} → ${nameOf(args.assignedManagerId!)}`;
      effectiveNote = args.note ? `${args.note} | ${reassignNote}` : reassignNote;
    }

    // Ret nedeni: verilmişse AYNI tx'te rejectionReasonId yaz + note'a okunabilir etiket ekle.
    // (Etiket StageLog note'una girer; ham id kullanıcıya gösterilmez.)
    const extraData: Prisma.PublicJobApplicationUpdateInput = {};
    if (args.rejectionReasonId) {
      const reason = await tx.rejectionReason.findUnique({
        where: { id: args.rejectionReasonId },
        select: { name: true },
      });
      if (!reason) {
        throw new Error(`RejectionReason bulunamadı: ${args.rejectionReasonId}`);
      }
      extraData.rejectionReason = { connect: { id: args.rejectionReasonId } };
      const reasonNote = `Ret nedeni: ${reason.name}`;
      effectiveNote = effectiveNote ? `${effectiveNote} | ${reasonNote}` : reasonNote;
    }

    // Sınav: verilmişse AYNI tx'te oturum aç (ORTAK helper, idempotent) + note'a sınav adı.
    // Helper sınav geçerliliğini doğrular; başarısızsa fırlatır → tx GERİ ALINIR
    // (statü SINAV olup oturumsuz kalmaz). Statü guard'ı matriste; helper statüye bakmaz.
    if (args.assessmentId) {
      const { assessmentName } = await ensureAssessmentSession(tx, {
        publicJobApplicationId: args.applicationId,
        assessmentId: args.assessmentId,
        select: { id: true },
      });
      const sinavNote = `Sınava yönlendirildi: ${assessmentName}`;
      effectiveNote = effectiveNote ? `${effectiveNote} | ${sinavNote}` : sinavNote;
    }

    const updated = await updateApplicationStatus(tx, {
      applicationId: args.applicationId,
      toStatus: args.toStatus,
      changedBy: args.changedBy,
      note: effectiveNote,
      assignedManagerId: args.assignedManagerId,
      data: Object.keys(extraData).length ? extraData : undefined,
      // Yeniden atama (aynı durum) → log yine yazılsın.
      forceLog: isReassign,
    });
    return {
      updated,
      fromStatus: before.status,
      applicantName: before.fullName,
      // Bildirim için etkin müdür: yeni atanan varsa o, yoksa mevcut.
      effectiveManagerId: args.assignedManagerId ?? before.assignedManagerId ?? null,
    };
  });

  // COMMIT sonrası — bildirim best-effort.
  try {
    await notifyApplicationStageChange({
      applicationId: args.applicationId,
      applicantName: outcome.applicantName,
      fromStatus: outcome.fromStatus,
      toStatus: args.toStatus,
      assignedManagerId: outcome.effectiveManagerId,
      actorName: args.actorName ?? null,
    });
  } catch (err) {
    console.error("notifyApplicationStageChange başarısız (geçiş kalıcı):", err);
  }

  return outcome.updated;
}
