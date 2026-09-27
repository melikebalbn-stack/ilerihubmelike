import { prisma } from "@/lib/prisma";
import type { YakaRengi } from "./atama-model";

/**
 * Yeni Atama hedef kitle segmenti → kullanıcı kümesi.
 * - tumSirket: tüm aktif kullanıcılar
 * - yakalar + departmanlar: BİRLİKTE daraltır (AND) — Personnel.yakaRengi ∈ yakalar
 *   VE Personnel.bolum ∈ departmanlar (ikisi de aktif personel)
 * - userIds: doğrudan kişi seçimi
 * Departman = Personnel.bolum (HR master metni; atama personele göre olduğundan
 * DepartmentDefinition.name yerine gerçek personel bölümü kaynak alınır).
 */
export type AtamaSegment = {
  tumSirket?: boolean;
  yakalar?: YakaRengi[];
  departmanlar?: string[];
  userIds?: string[];
};

type UserWhere = Record<string, unknown>;

/** Segment → Prisma User where (SAF, test edilir). */
export function audienceWhere(seg: AtamaSegment): UserWhere {
  if (seg.userIds && seg.userIds.length) {
    return { isActive: true, id: { in: seg.userIds } };
  }
  if (seg.tumSirket) {
    return { isActive: true };
  }
  const hasYaka = !!seg.yakalar?.length;
  const hasDept = !!seg.departmanlar?.length;
  if (!hasYaka && !hasDept) {
    return { isActive: true }; // filtre yok → tüm şirket
  }
  const personnel: UserWhere = { aktif: true };
  if (hasYaka) personnel.yakaRengi = { in: seg.yakalar };
  if (hasDept) personnel.bolum = { in: seg.departmanlar };
  return { isActive: true, personnel };
}

/** Segmentteki aktif kullanıcı id'leri. */
export async function resolveAudience(seg: AtamaSegment): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: audienceWhere(seg) as never,
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/** Bir kursa (tüm container'ları) hâlihazırda atanmış kullanıcı id'leri. */
export async function atanmisUserIdleri(courseId: string): Promise<string[]> {
  const containers = await prisma.courseAssignment.findMany({
    where: { courseId },
    select: { id: true },
  });
  if (!containers.length) return [];
  const rows = await prisma.userCourseAssignment.findMany({
    where: { assignmentId: { in: containers.map((c) => c.id) } },
    select: { userId: true },
  });
  return [...new Set(rows.map((r) => r.userId))];
}
