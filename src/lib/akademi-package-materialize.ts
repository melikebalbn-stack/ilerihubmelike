import { prisma } from "@/lib/prisma";

export interface MaterializeResult {
  packageId: string;
  courseCount: number;
  targetUserCount: number;
  newAssignments: number;
  skippedExisting: number;
  dueDateUpdated: number;
  errors: string[];
}

export interface MaterializeOptions {
  // PR-IFS-RAPOR-2a: bireysel (direct) atamada verilen paket son tarihi.
  // Yalnız overrideUserIds için uygulanır; departman son tarihiyle birlikte
  // tighten-only birleşir (erken olan kazanır).
  overrideDueDate?: Date | null;
  overrideUserIds?: string[];
}

/**
 * Tighten-only kuralı (TEK KAYNAK): son tarih yalnız SIKILAŞIR.
 * null → doldur; hedef mevcuttan ERKEN ise öne çek; asla uzatma/silme.
 */
export function shouldTightenDue(
  current: Date | null,
  target: Date
): boolean {
  return current == null || target < current;
}

export async function materializePackage(
  packageId: string,
  _assignedById?: string,
  opts?: MaterializeOptions
): Promise<MaterializeResult> {
  const result: MaterializeResult = {
    packageId,
    courseCount: 0,
    targetUserCount: 0,
    newAssignments: 0,
    skippedExisting: 0,
    dueDateUpdated: 0,
    errors: [],
  };

  const pkg = await prisma.coursePackage.findUnique({
    where: { id: packageId },
    include: {
      packageCourses: {
        include: { course: { select: { id: true, isActive: true } } },
      },
      departmentPackages: true,
      userAssignments: true,
    },
  });

  if (!pkg) {
    result.errors.push("Paket bulunamadı");
    return result;
  }

  if (!pkg.isActive) {
    result.errors.push("Paket pasif, materialize atlandı");
    return result;
  }

  const activeCourses = pkg.packageCourses.filter((pc) => pc.course.isActive);
  result.courseCount = activeCourses.length;

  if (activeCourses.length === 0) {
    return result;
  }

  const targetUserIds = new Set<string>();
  // PR-1: kullanıcı → departman ödev son tarihi (DepartmentPackage.dueDate).
  // Direct paket atamalarında (UserPackageAssignment) departman son tarihi
  // olmadığından null kalır.
  const userIdToDueDate = new Map<string, Date | null>();

  if (pkg.departmentPackages.length > 0) {
    const bolumToDueDate = new Map<string, Date | null>();
    for (const dp of pkg.departmentPackages) {
      bolumToDueDate.set(dp.bolum, dp.dueDate);
    }
    const bolums = pkg.departmentPackages.map((dp) => dp.bolum);
    const bolumUsers = await prisma.user.findMany({
      where: {
        personnel: { bolum: { in: bolums } },
        isActive: true,
      },
      select: { id: true, personnel: { select: { bolum: true } } },
    });
    bolumUsers.forEach((u) => {
      targetUserIds.add(u.id);
      const b = u.personnel?.bolum;
      userIdToDueDate.set(u.id, b ? (bolumToDueDate.get(b) ?? null) : null);
    });
  }

  pkg.userAssignments.forEach((ua) => targetUserIds.add(ua.userId));
  result.targetUserCount = targetUserIds.size;

  // PR-IFS-RAPOR-2a: bireysel atamada verilen paket son tarihini overrideUserIds
  // için birleştir — departman son tarihiyle tighten-only (erken kazanır).
  if (opts?.overrideDueDate != null && opts.overrideUserIds?.length) {
    const ov = opts.overrideDueDate;
    for (const uid of opts.overrideUserIds) {
      const cur = userIdToDueDate.get(uid) ?? null;
      userIdToDueDate.set(uid, shouldTightenDue(cur, ov) ? ov : cur);
    }
  }

  // PR-1: bir kullanıcı için hedef son tarih (departman dueDate'i; yoksa null).
  const dueFor = (userId: string): Date | null =>
    userIdToDueDate.get(userId) ?? null;

  if (targetUserIds.size === 0) {
    return result;
  }

  // Each course needs at least one CourseAssignment record. We reuse the
  // earliest existing CourseAssignment for that course if any; otherwise
  // create one. UserCourseAssignment (userId+assignmentId unique) is then
  // created per target user. skipDuplicates leaves existing rows untouched.
  const courseIds = activeCourses.map((pc) => pc.course.id);

  const existingAssignments = await prisma.courseAssignment.findMany({
    where: { courseId: { in: courseIds } },
    orderBy: { createdAt: "asc" },
    select: { id: true, courseId: true },
  });

  const courseToAssignmentId = new Map<string, string>();
  for (const a of existingAssignments) {
    if (!courseToAssignmentId.has(a.courseId)) {
      courseToAssignmentId.set(a.courseId, a.id);
    }
  }

  for (const courseId of courseIds) {
    if (!courseToAssignmentId.has(courseId)) {
      const created = await prisma.courseAssignment.create({
        data: { courseId },
        select: { id: true },
      });
      courseToAssignmentId.set(courseId, created.id);
    }
  }

  const assignmentIds = courseIds
    .map((c) => courseToAssignmentId.get(c))
    .filter(Boolean) as string[];

  const existing = await prisma.userCourseAssignment.findMany({
    where: {
      userId: { in: Array.from(targetUserIds) },
      assignmentId: { in: assignmentIds },
    },
    select: { id: true, userId: true, assignmentId: true, dueDate: true },
  });
  const existingSet = new Set(
    existing.map((e) => `${e.userId}:${e.assignmentId}`)
  );

  const toCreate: Array<{
    userId: string;
    assignmentId: string;
    assignedAt: Date;
    dueDate: Date | null;
  }> = [];

  for (const userId of targetUserIds) {
    for (const assignmentId of assignmentIds) {
      const key = `${userId}:${assignmentId}`;
      if (existingSet.has(key)) {
        result.skippedExisting++;
      } else {
        // PR-1: yeni atamaya departman son tarihini taşı (yoksa null).
        toCreate.push({
          userId,
          assignmentId,
          assignedAt: new Date(),
          dueDate: dueFor(userId),
        });
      }
    }
  }

  if (toCreate.length > 0) {
    const created = await prisma.userCourseAssignment.createMany({
      data: toCreate,
      skipDuplicates: true,
    });
    result.newAssignments = created.count;
  }

  // PR-1: Mevcut atamalarda son tarihi yalnız SIKILAŞTIR — earliest kazanır,
  // gevşetme yok. Departman/override dueDate'i null ise mevcut satıra dokunma.
  for (const row of existing) {
    const target = dueFor(row.userId);
    if (target == null) continue;
    if (shouldTightenDue(row.dueDate, target)) {
      await prisma.userCourseAssignment.update({
        where: { id: row.id },
        data: { dueDate: target },
      });
      result.dueDateUpdated++;
    }
  }

  return result;
}

/**
 * PR-IFS-RAPOR-2a: TOPLU son tarih aracı — paketin kurslarındaki TÜM mevcut
 * UserCourseAssignment satırlarına tighten-only uygular (null→doldur, erken→öne
 * çek, asla uzatma). Yeni atama OLUŞTURMAZ. { updated, skipped } döner.
 */
export async function applyPackageDueDate(
  packageId: string,
  dueDate: Date
): Promise<{ updated: number; skipped: number }> {
  const pkg = await prisma.coursePackage.findUnique({
    where: { id: packageId },
    include: { packageCourses: { select: { courseId: true } } },
  });
  if (!pkg) return { updated: 0, skipped: 0 };

  const courseIds = pkg.packageCourses.map((pc) => pc.courseId);
  if (courseIds.length === 0) return { updated: 0, skipped: 0 };

  const assignments = await prisma.courseAssignment.findMany({
    where: { courseId: { in: courseIds } },
    select: { id: true },
  });
  const assignmentIds = assignments.map((a) => a.id);
  if (assignmentIds.length === 0) return { updated: 0, skipped: 0 };

  const rows = await prisma.userCourseAssignment.findMany({
    where: { assignmentId: { in: assignmentIds } },
    select: { id: true, dueDate: true },
  });

  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    if (shouldTightenDue(row.dueDate, dueDate)) {
      await prisma.userCourseAssignment.update({
        where: { id: row.id },
        data: { dueDate },
      });
      updated++;
    } else {
      skipped++;
    }
  }
  return { updated, skipped };
}

export async function getUserPackages(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      personnel: { select: { bolum: true } },
      packageAssignments: { select: { packageId: true } },
    },
  });

  if (!user) return [];

  const bolum = user.personnel?.bolum;
  const directPackageIds = user.packageAssignments.map((pa) => pa.packageId);

  const packages = await prisma.coursePackage.findMany({
    where: {
      isActive: true,
      OR: [
        ...(bolum ? [{ departmentPackages: { some: { bolum } } }] : []),
        ...(directPackageIds.length > 0
          ? [{ id: { in: directPackageIds } }]
          : []),
      ],
    },
    include: {
      packageCourses: {
        orderBy: { order: "asc" },
        include: {
          course: {
            select: {
              id: true,
              title: true,
              description: true,
              thumbnail: true,
              difficulty: true,
              duration: true,
              isActive: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const courseIds = packages.flatMap((p) =>
    p.packageCourses.filter((pc) => pc.course.isActive).map((pc) => pc.course.id)
  );

  const [progressRows, assignmentRows] = await Promise.all([
    prisma.courseProgress.findMany({
      where: { userId, courseId: { in: courseIds } },
      select: { courseId: true, percentage: true, completedAt: true },
    }),
    prisma.userCourseAssignment.findMany({
      where: {
        userId,
        assignment: { courseId: { in: courseIds } },
      },
      select: { assignment: { select: { courseId: true } } },
    }),
  ]);

  const progressMap = new Map(progressRows.map((p) => [p.courseId, p]));
  const assignedCourseIds = new Set(
    assignmentRows.map((ua) => ua.assignment.courseId)
  );

  return packages.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    iconColor: p.iconColor,
    source: directPackageIds.includes(p.id)
      ? ("direct" as const)
      : ("bolum" as const),
    courses: p.packageCourses
      .filter((pc) => pc.course.isActive)
      .map((pc) => {
        const progress = progressMap.get(pc.course.id);
        return {
          id: pc.course.id,
          title: pc.course.title,
          description: pc.course.description,
          thumbnail: pc.course.thumbnail,
          difficulty: pc.course.difficulty,
          duration: pc.course.duration,
          order: pc.order,
          isRequired: pc.isRequired,
          progress: progress?.percentage ?? 0,
          completedAt: progress?.completedAt
            ? progress.completedAt.toISOString()
            : null,
          isAssigned: assignedCourseIds.has(pc.course.id),
        };
      }),
  }));
}
