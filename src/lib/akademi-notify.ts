import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
// Kurumsal yerleşim logoyu cid:ilerihub-logo ile gömer → her HTML mailde ek verilmeli.
import { logoAttachments } from "@/lib/email-templates/layout";
import * as templates from "@/lib/email-templates/akademi";
import { dueDateSetEmail } from "@/lib/email-templates/akademi/dueDateSet";

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
 *  - Yönetici: User.managerId (LDAP hiyerarşisi). managerId YOKSA (bluecollar
 *    ve LDAP dışı hesaplar — prod'da aktif 171'in 116'sı) Personnel.bolumMuduru
 *    serbest metnine düşer; ama çözülen kişi GENEL MÜDÜR / GM YARDIMCISI
 *    (Personnel.gorev) ise yönetici SAYILMAZ — 16.09.2026'ya kadar bu yüzden her
 *    sınav sonucu Genel Müdür'e gidiyordu. EXAM_* olaylarında yönetici kanalı
 *    zaten kapalı; fallback yalnız diğer olaylar için anlamlı.
 *  - İK ekibi: RBAC rol slug `hr-yoneticisi` (süresi dolmamış atama, aktif
 *    kullanıcı). Eskisi Personnel.bolum ILIKE '%insan%' idi — bölüm adına
 *    bağımlıydı; akademi.report.view SEÇİLMEDİ (23 kişi: GM/GMY/müdürler dahil).
 */
export const HR_ROLE_SLUG = "hr-yoneticisi";

/** Personnel.gorev bu deseni içeriyorsa (GENEL MÜDÜR, GENEL MÜDÜR YARDIMCISI) fallback yöneticisi olamaz. */
const UST_YONETIM_GOREV = /genel\s*m[uü]d[uü]r/i;

/**
 * managerId yoksa: Personnel.bolumMuduru metni → aktif Personnel → User.
 * Üst yönetim unvanlı (GM/GMY) eşleşme null döner. Belirsizlikte ilk kayıt
 * (id ASC) — hiç bildirim gitmemesindense yanlış kişiye gitmesi tercih edildi,
 * belirsizlik loga düşer.
 */
async function fallbackManagerFromBolumMuduru(
  userId: string
): Promise<RecipientUser | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { personnel: { select: { bolumMuduru: true } } },
  });
  const managerName = u?.personnel?.bolumMuduru?.trim();
  if (!managerName) return null;

  const adaylar = await prisma.personnel.findMany({
    where: { adSoyad: { equals: managerName, mode: "insensitive" }, aktif: true },
    select: { id: true, gorev: true },
    orderBy: { id: "asc" },
  });
  if (adaylar.length > 1) {
    console.warn(
      `[akademi-notify] belirsiz bolumMuduru: "${managerName}" -> ${adaylar.length} aktif eşleşme; ilk kayıt (${adaylar[0].id})`
    );
  }
  const aday = adaylar[0];
  if (!aday) return null;
  if (aday.gorev && UST_YONETIM_GOREV.test(aday.gorev)) {
    console.info(
      `[akademi-notify] bolumMuduru üst yönetim (${aday.gorev}) — fallback yönetici atlandı (user ${userId})`
    );
    return null;
  }
  const mu = await prisma.user.findFirst({
    where: { personnelId: aday.id, isActive: true },
    select: { id: true, email: true, name: true },
  });
  if (!mu || mu.id === userId) return null;
  return { id: mu.id, email: mu.email, name: nn(mu.name, mu.email) };
}

export async function resolveRecipients(
  userId: string
): Promise<RecipientGroup> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      manager: { select: { id: true, email: true, name: true, isActive: true } },
    },
  });

  if (!user) throw new Error(`User ${userId} not found`);

  let manager: RecipientUser | null = null;
  if (user.manager && user.manager.isActive && user.manager.id !== user.id) {
    manager = {
      id: user.manager.id,
      email: user.manager.email,
      name: nn(user.manager.name, user.manager.email),
    };
  } else {
    manager = await fallbackManagerFromBolumMuduru(userId);
    if (!manager) {
      console.warn(
        `[akademi-notify] Manager not resolved for user ${userId} (managerId yok/pasif/kendisi; bolumMuduru fallback da yok/üst yönetim)`
      );
    }
  }

  const now = new Date();
  const hrRaw = await prisma.user.findMany({
    where: {
      isActive: true,
      id: { not: user.id },
      userRoles: {
        some: {
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          role: { slug: HR_ROLE_SLUG },
        },
      },
    },
    select: { id: true, email: true, name: true },
    orderBy: { id: "asc" },
  });
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
 *
 * MAİL YALNIZ EĞİTİMİ ALAN KİŞİYE gider (Melih kararı 02.10.2026). Yönetici ve
 * İK kopyaları KALDIRILDI: toplu atamada her atama için üç mail çıkıyor ve
 * gelen kutuları kilitleniyordu — bir müdür ekibinin, İK ise ŞİRKETİN TÜM
 * atamalarının kopyasını alıyordu.
 *
 * In-app bildirim DEĞİŞMEDİ: kullanıcı + İK çanda görmeye devam eder; şikâyet
 * mail trafiğineydi. MANAGER_CHANNEL_OFF kümesi de düştü — artık hiçbir olayda
 * yöneticiye mail gitmediği için "hangi olayda kapalı" sorusu kalmadı.
 */
export async function notifyAkademiEvent(ctx: NotifyContext): Promise<void> {
  const recipients = await resolveRecipients(ctx.userId);

  // 1) In-app — kullanıcının kendisi
  try {
    const customTitle =
      typeof ctx.data.title === "string" ? ctx.data.title : null;
    const customMessage =
      typeof ctx.data.message === "string" ? ctx.data.message : null;
    const title = customTitle ?? buildInAppTitle(ctx);
    const message = customMessage ?? buildInAppMessage(ctx);
    await prisma.akademiNotification.create({
      data: {
        userId: ctx.userId,
        type: ctx.eventType,
        title,
        message,
        link: ctx.link ?? null,
      },
    });
    // GENEL ÇAN (18.09.2026): akademi_notifications'ı okuyan ekran yok; kullanıcı
    // bildirimi ancak genel Notification tablosunda görüyor. Aynı başlık/link.
    await genelBildirimYaz(ctx.userId, title, message, ctx.link ?? null, ctx.eventType);
  } catch (err) {
    console.error(`[akademi-notify] in-app failed for ${ctx.userId}:`, err);
  }

  // 1b) In-app — İK (her birine ayrı kayıt; başlık kişiyi belirtir)
  if (recipients.hr.length) {
    try {
      const hrTitle = `${buildInAppTitle(ctx)} — ${recipients.user.name}`;
      const hrMessage = `${recipients.user.name}: ${ctx.courseTitle} (${buildInAppTitle(ctx).toLowerCase()})`;
      await prisma.akademiNotification.createMany({
        data: recipients.hr.map((h) => ({
          userId: h.id,
          type: ctx.eventType,
          title: hrTitle,
          message: hrMessage,
          link: ctx.link ?? null,
        })),
      });
      for (const h of recipients.hr) {
        await genelBildirimYaz(h.id, hrTitle, hrMessage, ctx.link ?? null, ctx.eventType);
      }
    } catch (err) {
      console.error(`[akademi-notify] in-app (HR) failed:`, err);
    }
  }

  // 2) Mail — kullanıcı + (kanal açıksa) yönetici + İK
  const content = dispatchTemplate(ctx, recipients);

  // Kullanıcıya
  // sendEmail throw ETMEZ ({success:false} döner) → sonuç kontrol edilip alıcı loglanır.
  const mailGonder = (kanal: string, to: { email: string; name: string }, text: string, html: string) =>
    sendEmail([to], content.subject, text, html, logoAttachments())
      .then((r) => {
        if (!r.success) {
          console.error(`[akademi-notify] ${ctx.eventType} mail ${kanal} → ${to.email} BAŞARISIZ: ${r.error ?? "?"}`);
        }
      })
      .catch((err) => console.error(`[akademi-notify] ${ctx.eventType} mail ${kanal} → ${to.email} hata:`, err));

  if (recipients.user.email) {
    void mailGonder("user", { email: recipients.user.email, name: recipients.user.name }, content.textForUser, content.htmlForUser);
  }

  // Yönetici ve İK mailleri 02.10.2026'da KALDIRILDI (bkz. fonksiyon başı).
  // `content.textForManager` / `htmlForManager` şablonlarda DURUYOR: in-app
  // başlıkları ve ileride istenirse haftalık özet aynı metni kullanır, silmek
  // dokuz şablonu dokunmayı gerektirirdi.
}

/**
 * Genel Notification tablosuna yaz (mevcut çan). Mükerrer koruması: aynı kullanıcı
 * + başlık + link son 60 sn içinde yazıldıysa atla (aynı olay iki kez tetiklenirse).
 */
async function genelBildirimYaz(
  userId: string,
  title: string,
  message: string,
  link: string | null,
  eventType: AkademiEventType
): Promise<void> {
  try {
    const yakinda = await prisma.notification.findFirst({
      where: { userId, title, link, createdAt: { gte: new Date(Date.now() - 60_000) } },
      select: { id: true },
    });
    if (yakinda) return;
    const type =
      eventType === "EXAM_FAILED" || eventType === "DEADLINE_MISSED" || eventType === "CERTIFICATE_EXPIRED"
        ? "WARNING"
        : eventType === "EXAM_PASSED" || eventType === "CERTIFICATE_ISSUED"
        ? "SUCCESS"
        : eventType === "DEADLINE_APPROACHING" || eventType === "CERTIFICATE_EXPIRING_SOON"
        ? "REMINDER"
        : "INFO";
    await prisma.notification.create({ data: { userId, title, message, link, type } });
  } catch (err) {
    console.error(`[akademi-notify] genel bildirim yazılamadı (${userId}):`, err);
  }
}

/**
 * Paket ataması bildirimi — ALICI YALNIZ KULLANICI (müdür/İK fan-out YOK).
 * Paket seviyesinde TEK in-app + TEK mail. Best-effort: in-app/mail hatası
 * yutulur (atama ve diğer kullanıcılar etkilenmez).
 */
export async function notifyPackageAssigned(
  userId: string,
  pkg: { packageName: string; courseCount: number; link?: string }
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  if (!user) return;
  const name = nn(user.name, user.email);
  const link = pkg.link ?? "/akademi";

  // 1) In-app (yalnız kullanıcı) — akademi_notifications + genel çan (okunan tablo)
  const title = "Yeni eğitim paketi atandı";
  const message = `${pkg.packageName} (${pkg.courseCount} kurs) eğitim paketi size atandı.`;
  try {
    await prisma.akademiNotification.create({
      data: { userId, type: "PACKAGE_ASSIGNED", title, message, link },
    });
    await genelBildirimYaz(userId, title, message, link, "COURSE_ASSIGNED");
  } catch (err) {
    console.error(`[akademi-notify] package in-app failed for ${userId}:`, err);
  }

  // 2) Mail — yalnız kullanıcı
  if (user.email) {
    const content = templates.packageAssignedEmail({
      userName: name,
      packageName: pkg.packageName,
      courseCount: pkg.courseCount,
      link,
    });
    try {
      const r = await sendEmail(
        [{ email: user.email, name }],
        content.subject,
        content.text,
        content.html,
        logoAttachments()
      );
      if (!r.success) {
        console.error(`[akademi-notify] PACKAGE_ASSIGNED mail → ${user.email} BAŞARISIZ: ${r.error ?? "?"}`);
      }
    } catch (err) {
      console.error(
        `[akademi-notify] package mail to ${user.email} failed:`,
        err
      );
    }
  }
}

/**
 * Paket ataması bildirimini kullanıcı kümesine küçük eşzamanlılıkla (5'erli)
 * best-effort gönderir. Endpoint bunu AWAIT ETMEMELİ (fire-and-forget) — büyük
 * bölümlerde HTTP yanıtını kilitlememek için. Promise.allSettled ile asla
 * reject etmez.
 */
export async function notifyPackageAssignedBatch(
  userIds: string[],
  pkg: { packageName: string; courseCount: number; link?: string }
): Promise<void> {
  const BATCH = 5;
  for (let i = 0; i < userIds.length; i += BATCH) {
    await Promise.allSettled(
      userIds.slice(i, i + BATCH).map((uid) => notifyPackageAssigned(uid, pkg))
    );
  }
}

// PR-IFS-RAPOR-2b: son tarih atanan/öne çekilen kullanıcılara tek mail (kurs
// başına değil, kişi başına TEK). Fire-and-forget; mail patlarsa DB yazımı
// GERİ ALINMAZ — yalnız log'lanır (sendEmail zaten throw etmez, yine de guard).
export async function notifyDueDateSetBatch(
  affected: { userId: string; dueDate: Date }[],
  pkg: { packageName: string }
): Promise<void> {
  if (affected.length === 0) return;
  // Aynı kullanıcı birden çok kez gelirse en erken tarihle tekilleştir.
  const byUser = new Map<string, Date>();
  for (const a of affected) {
    const cur = byUser.get(a.userId);
    if (!cur || a.dueDate < cur) byUser.set(a.userId, a.dueDate);
  }
  const ids = [...byUser.keys()];
  const rows = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, email: true, name: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));

  const items = [...byUser.entries()];
  const BATCH = 5;
  for (let i = 0; i < items.length; i += BATCH) {
    await Promise.allSettled(
      items.slice(i, i + BATCH).map(async ([userId, dueDate]) => {
        const rec = byId.get(userId);
        if (!rec?.email) return;
        const adSoyad = nn(rec.name, rec.email);
        const { subject, html, text } = dueDateSetEmail({
          adSoyad,
          packageName: pkg.packageName,
          dueDate,
        });
        await sendEmail(
          [{ email: rec.email, name: adSoyad }],
          subject,
          text,
          html,
          logoAttachments()
        ).catch((err) =>
          console.error(
            `[akademi-notify] dueDate mail to ${rec.email} failed:`,
            err
          )
        );
      })
    );
  }
}
