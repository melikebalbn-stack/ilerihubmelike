import { prisma } from "@/lib/prisma";

export interface MaterializeResult {
  packageId: string;
  courseCount: number;
  targetUserCount: number;
  newAssignments: number;
  skippedExisting: number;
  errors: string[];
}

export async function materializePackage(
  packageId: string,
  _assignedById?: string
): Promise<MaterializeResult> {
  const result: MaterializeResult = {
    packageId,
    courseCount: 0,
    targetUserCount: 0,
    newAssignments: 0,
    skippedExisting: 0,
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

  if (pkg.departmentPackages.length > 0) {
    const bolums = pkg.departmentPackages.map((dp) => dp.bolum);
    const bolumUsers = await prisma.user.findMany({
      where: {
        personnel: { bolum: { in: bolums } },
        isActive: true,
      },
      select: { id: true },
    });
    bolumUsers.forEach((u) => targetUserIds.add(u.id));
  }

  pkg.userAssignments.forEach((ua) => targetUserIds.add(ua.userId));
  result.targetUserCount = targetUserIds.size;

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
    select: { userId: true, assignmentId: true },
  });
  const existingSet = new Set(
    existing.map((e) => `${e.userId}:${e.assignmentId}`)
  );

  const toCreate: Array<{
    userId: string;
    assignmentId: string;
    assignedAt: Date;
  }> = [];

  for (const userId of targetUserIds) {
    for (const assignmentId of assignmentIds) {
      const key = `${userId}:${assignmentId}`;
      if (existingSet.has(key)) {
        result.skippedExisting++;
      } else {
        toCreate.push({ userId, assignmentId, assignedAt: new Date() });
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

  return result;
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
