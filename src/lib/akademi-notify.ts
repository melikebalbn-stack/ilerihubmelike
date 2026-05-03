import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import * as templates from "@/lib/email-templates/akademi";

export type RecipientUser = { id: string; email: string | null; name: string };

function nn(name: string | null, email: string | null): string {
  return name?.trim() || email?.split("@")[0] || "Kullanıcı";
}

export type RecipientGroup = {
  user: RecipientUser;
  manager: RecipientUser | null;
  hr: RecipientUser[];
};

export type AkademiEventType =
  | "COURSE_ASSIGNED"
  | "ASSIGNMENT_CANCELLED"
  | "DEADLINE_APPROACHING"
  | "DEADLINE_MISSED"
  | "EXAM_PASSED"
  | "EXAM_FAILED"
  | "CERTIFICATE_ISSUED"
  | "CERTIFICATE_EXPIRING_SOON"
  | "CERTIFICATE_EXPIRED";

export type NotifyContext = {
  userId: string;
  eventType: AkademiEventType;
  courseTitle: string;
  data: Record<string, unknown>;
  link?: string;
};

/**
 * Bir kullanıcı için 3 alıcı grubunu çözer:
 *  - Kullanıcının kendisi
 *  - Bölüm müdürü (Personnel.bolumMuduru → Personnel.adSoyad → User)
 *  - İK ekibi (Personnel.bolum ILIKE '%insan%' → User'lar)
 */
export async function resolveRecipients(
  userId: string
): Promise<RecipientGroup> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      personnel: {
        select: { bolumMuduru: true, bolum: true, sicilNo: true },
      },
    },
  });

  if (!user) throw new Error(`User ${userId} not found`);

  let manager: RecipientUser | null = null;
  const managerName = user.personnel?.bolumMuduru?.trim();
  if (managerName) {
    const managerPersonnel = await prisma.personnel.findFirst({
      where: {
        adSoyad: { equals: managerName, mode: "insensitive" },
        aktif: true,
      },
      select: { id: true },
    });

    if (managerPersonnel) {
      const managerUser = await prisma.user.findFirst({
        where: { personnelId: managerPersonnel.id },
        select: { id: true, email: true, name: true },
      });
      if (managerUser) {
        manager = {
          id: managerUser.id,
          email: managerUser.email,
          name: nn(managerUser.name, managerUser.email),
        };
      }
    }

    if (!manager) {
      console.warn(
        `[akademi-notify] Manager not resolved for user ${userId} ` +
          `(sicilNo=${user.personnel?.sicilNo}, bolumMuduru="${user.personnel?.bolumMuduru}")`
      );
    }
  }

  const hrPersonnel = await prisma.personnel.findMany({
    where: {
      aktif: true,
      bolum: { contains: "insan", mode: "insensitive" },
    },
    select: { id: true },
  });
  const hrPersonnelIds = hrPersonnel.map((p) => p.id);

  const hrRaw = hrPersonnelIds.length
    ? await prisma.user.findMany({
        where: { personnelId: { in: hrPersonnelIds } },
        select: { id: true, email: true, name: true },
      })
    : [];
  const hr: RecipientUser[] = hrRaw.map((h) => ({
    id: h.id,
    email: h.email,
    name: nn(h.name, h.email),
  }));

  return {
    user: {
      id: user.id,
      email: user.email,
      name: nn(user.name, user.email),
    },
    manager,
    hr,
  };
}

function dispatchTemplate(
  ctx: NotifyContext,
  recipients: RecipientGroup
): templates.EmailContent {
  switch (ctx.eventType) {
    case "COURSE_ASSIGNED":
      return templates.courseAssigned(ctx, recipients);
    case "ASSIGNMENT_CANCELLED":
      return templates.assignmentCancelled(ctx, recipients);
    case "DEADLINE_APPROACHING":
      return templates.deadlineApproaching(ctx, recipients);
    case "DEADLINE_MISSED":
      return templates.deadlineMissed(ctx, recipients);
    case "EXAM_PASSED":
      return templates.examPassed(ctx, recipients);
    case "EXAM_FAILED":
      return templates.examFailed(ctx, recipients);
    case "CERTIFICATE_ISSUED":
      return templates.certificateIssued(ctx, recipients);
    case "CERTIFICATE_EXPIRING_SOON":
      return templates.certificateExpiringSoon(ctx, recipients);
    case "CERTIFICATE_EXPIRED":
      return templates.certificateExpired(ctx, recipients);
  }
}

function buildInAppTitle(ctx: NotifyContext): string {
  const titles: Record<AkademiEventType, string> = {
    COURSE_ASSIGNED: "Yeni eğitim atandı",
    ASSIGNMENT_CANCELLED: "Eğitim ataması iptal edildi",
    DEADLINE_APPROACHING: "Eğitim son tarihi yaklaşıyor",
    DEADLINE_MISSED: "Eğitim son tarihi geçti",
    EXAM_PASSED: "Sınavı geçtiniz",
    EXAM_FAILED: "Sınavda kaldınız",
    CERTIFICATE_ISSUED: "Sertifikanız hazır",
    CERTIFICATE_EXPIRING_SOON: "Sertifikanız yakında geçersiz olacak",
    CERTIFICATE_EXPIRED: "Sertifikanız geçersiz oldu",
  };
  return titles[ctx.eventType];
}

function buildInAppMessage(ctx: NotifyContext): string {
  return `${ctx.courseTitle} eğitimi için bildirim.`;
}

/**
 * 9 event tipi için ortak gönderim fonksiyonu.
 * In-app notification + mail (3 alıcı grubuna).
 */
export async function notifyAkademiEvent(ctx: NotifyContext): Promise<void> {
  const recipients = await resolveRecipients(ctx.userId);

  // 1) In-app — sadece kullanıcının kendisi (yönetici/İK in-app yok, mail var)
  try {
    const customTitle =
      typeof ctx.data.title === "string" ? ctx.data.title : null;
    const customMessage =
      typeof ctx.data.message === "string" ? ctx.data.message : null;
    await prisma.akademiNotification.create({
      data: {
        userId: ctx.userId,
        type: ctx.eventType,
        title: customTitle ?? buildInAppTitle(ctx),
        message: customMessage ?? buildInAppMessage(ctx),
        link: ctx.link ?? null,
      },
    });
  } catch (err) {
    console.error(`[akademi-notify] in-app failed for ${ctx.userId}:`, err);
  }

  // 2) Mail — 3 alıcı grubu
  const content = dispatchTemplate(ctx, recipients);

  // Kullanıcıya
  if (recipients.user.email) {
    sendEmail(
      [{ email: recipients.user.email, name: recipients.user.name }],
      content.subject,
      content.textForUser,
      content.htmlForUser
    ).catch((err) =>
      console.error(
        `[akademi-notify] mail to user ${recipients.user.email} failed:`,
        err
      )
    );
  }

  // Müdüre (varsa)
  if (recipients.manager?.email) {
    sendEmail(
      [{ email: recipients.manager.email, name: recipients.manager.name }],
      content.subject,
      content.textForManager,
      content.htmlForManager
    ).catch((err) =>
      console.error(`[akademi-notify] mail to manager failed:`, err)
    );
  }

  // İK (her birine ayrı — KVKK)
  for (const hrUser of recipients.hr) {
    if (!hrUser.email) continue;
    sendEmail(
      [{ email: hrUser.email, name: hrUser.name }],
      content.subject,
      content.textForManager,
      content.htmlForManager
    ).catch((err) =>
      console.error(`[akademi-notify] mail to HR ${hrUser.email} failed:`, err)
    );
  }
}
