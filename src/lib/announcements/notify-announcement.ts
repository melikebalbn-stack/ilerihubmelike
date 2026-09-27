import { prisma } from "@/lib/prisma";
import { createManyNotificationsWithPush } from "@/lib/push-notifications";

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
    id: { not: ann.authorId }, // yazara kendi duyurusu gitmez
  } as const;

  if (ann.targetType === "DEPARTMENTS") {
    if (!ann.targetDepartments.length) return [];
    const users = await prisma.user.findMany({
      where: { ...base, department: { in: ann.targetDepartments } },
      select: { id: true },
    });
    return users.map((u) => u.id);
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

  // push-notifications helper'ı yapısal (structural) bir prisma tipi bekliyor;
  // gerçek PrismaClient'ın notification.createMany imzası (NotificationType) daha
  // dar olduğundan doğrudan atanamıyor → helper'ın kendi param tipine cast.
  const client = prisma as unknown as Parameters<typeof createManyNotificationsWithPush>[0];

  await createManyNotificationsWithPush(
    client,
    userIds.map((userId) => ({
      userId,
      title: `Yeni duyuru · ${kategori}`,
      message: ann.title,
      type: "INFO",
      url,
    }))
  );

  return userIds.length;
}
