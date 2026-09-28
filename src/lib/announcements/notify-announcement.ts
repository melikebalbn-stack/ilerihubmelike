import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push-notifications";
import { eslesenKullaniciIdleri } from "@/lib/announcements/hedef";

/**
 * Duyuru yayınlanınca hedef kitleye in-app + push bildirim (MAİL YOK).
 * - Hedef: targetType ALL | DEPARTMENTS(targetDepartments) | ROLES(targetRoles=Role.slug)
 * - Yazarın kendisi ve pasif kullanıcılar hariç.
 * - Aboneliksiz kullanıcı push'ta sessizce atlanır (sendPushToUser 0 döner),
 *   NOTIFY_TEST_MODE=true iken push tamamen kapalı (helper guard).
 * - Bildirime tıklayınca /announcements?ac=<id> → sayfa o duyurunun popup'ını açar.
 * Asla publish akışını bloklamaz — çağıran try/catch ile sarmalı.
 */

type AnnouncementForNotify = {
  id: string;
  title: string;
  authorId: string;
  targetType: "ALL" | "DEPARTMENTS" | "ROLES";
  targetDepartments: string[];
  targetRoles: string[];
  category?: { name: string | null } | null;
};

/** Hedef kitledeki (aktif, sentetik olmayan, yazar hariç) kullanıcı id'leri. */
export async function resolveAudienceUserIds(
  ann: AnnouncementForNotify
): Promise<string[]> {
  const base = {
    isActive: true,
    email: { not: "" },
    // 28.09: yazar-hariç kaldırıldı — yayınlayan da (test eden admin dahil) kendi
    // duyurusunun in-app+push'unu alır; hedef kitledeki HERKES bildirilir.
  } as const;

  if (ann.targetType === "DEPARTMENTS") {
    // Tam-metin DEĞİL: aday kullanıcılar Personnel.bolum üzerinden normalize süzülür.
    return eslesenKullaniciIdleri(prisma, ann.targetDepartments);
  }

  if (ann.targetType === "ROLES") {
    if (!ann.targetRoles.length) return [];
    const rows = await prisma.userRole.findMany({
      where: {
        role: { slug: { in: ann.targetRoles } },
        user: base,
      },
      select: { userId: true },
    });
    return [...new Set(rows.map((r) => r.userId))];
  }

  // ALL
  const users = await prisma.user.findMany({
    where: base,
    select: { id: true },
  });
  return users.map((u) => u.id);
}

export async function notifyAnnouncementPublished(
  ann: AnnouncementForNotify
): Promise<number> {
  const userIds = await resolveAudienceUserIds(ann);
  if (!userIds.length) return 0;

  const kategori = ann.category?.name?.trim() || "Genel";
  const url = `/announcements?ac=${ann.id}`;

  const baslik = `Yeni duyuru · ${kategori}`;

  // In-app bildirim. NOT: Notification şemasında alan `link` (URL değil); ortak
  // push-notifications helper'ı `url` yazmaya çalıştığı için "Unknown argument url"
  // ile PATLIYOR → helper kullanılmıyor, doğrudan `link` yazılıyor.
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      title: baslik,
      message: ann.title,
      type: "INFO" as const,
      link: url,
    })),
  });

  // Web-push (aboneliksiz/expired sessiz atlanır; NOTIFY_TEST_MODE guard helper'da).
  const pushClient = prisma as unknown as Parameters<typeof sendPushToUser>[0];
  for (const userId of userIds) {
    try {
      await sendPushToUser(pushClient, userId, { title: baslik, body: ann.title, url });
    } catch (err) {
      console.error(`[announcements] push başarısız (userId=${userId}):`, err);
    }
  }

  return userIds.length;
}
