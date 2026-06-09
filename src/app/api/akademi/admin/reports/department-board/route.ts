import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";
import { getUserPermissions } from "@/lib/auth/get-user-permissions";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import {
  getUsersByBolum,
  getLinkedBolums,
  resolveUserBolum,
} from "@/lib/user-personnel";
import { buildDepartmentBoard } from "@/lib/akademi-department-board";

// PR-3: Canlı departman panosu (read-only). Kim yaptı / kim geciken.
// - bolum YOK  -> meta (scope + izinli bölümler + paket filtresi seçenekleri)
// - bolum VAR  -> o bölümün çalışan-detay board verisi (özet + kişi durumları)
//
// Performans: getUsersByBolum (1) + UserCourseAssignment (1) + CourseProgress (1)
// + opsiyonel PackageCourse (1). Per-user döngüde sorgu YOK (N+1 yasak).
// Aggregation: buildDepartmentBoard (saf, DB'siz).

export async function GET(req: NextRequest) {
  const { session, error } = await requirePermission("akademi.report.view");
  if (error) return error;

  // Caller kimliği: LDAP DN değil gerçek User.id (cuid).
  const callerId = await resolveAkademiUserId(session);
  if (!callerId) {
    return NextResponse.json(
      { error: "Kullanıcı çözümlenemedi" },
      { status: 401 }
    );
  }

  // Scope: akademi.admin (tam rapor yetkisi) -> her bölüm; aksi -> kendi bölümü.
  const perms = await getUserPermissions(callerId);
  const fullScope = perms.has("akademi.admin");
  const ownBolum = fullScope ? null : await resolveUserBolum(callerId);

  const bolum = req.nextUrl.searchParams.get("bolum")?.trim() || null;
  const packageId = req.nextUrl.searchParams.get("packageId")?.trim() || null;

  // --- META modu (bölüm seçilmemiş): selector verisi ---
  if (!bolum) {
    const allowedBolums = fullScope
      ? await getLinkedBolums()
      : ownBolum
        ? [ownBolum]
        : [];
    const packages = await prisma.coursePackage.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({
      scope: fullScope ? "full" : "own",
      bolums: allowedBolums,
      packages,
    });
  }

  // --- Scope enforcement: müdür yalnız kendi bölümünü görebilir ---
  if (!fullScope && bolum !== ownBolum) {
    return NextResponse.json(
      { error: "Bu bölümü görüntüleme yetkiniz yok" },
      { status: 403 }
    );
  }

  const users = await getUsersByBolum(bolum);
  const userInputs = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
  }));

  if (users.length === 0) {
    const { summary, users: rows } = buildDepartmentBoard([], [], [], new Date());
    return NextResponse.json({ bolum, packageId, summary, users: rows });
  }
  const userIds = users.map((u) => u.id);

  // Kampanya/paket filtresi: paketteki kursların id'leri (tek sorgu).
  let courseIdFilter: string[] | null = null;
  if (packageId) {
    const pkgCourses = await prisma.packageCourse.findMany({
      where: { packageId },
      select: { courseId: true },
    });
    courseIdFilter = pkgCourses.map((p) => p.courseId);
    // Paket boşsa hiçbir atama eşleşmesin -> herkes "Başlamadı"/atanmamış.
    if (courseIdFilter.length === 0) {
      const { summary, users: rows } = buildDepartmentBoard(
        userInputs,
        [],
        [],
        new Date()
      );
      return NextResponse.json({ bolum, packageId, summary, users: rows });
    }
  }

  // TÜM atamalar tek sorguda.
  const assignments = await prisma.userCourseAssignment.findMany({
    where: {
      userId: { in: userIds },
      ...(courseIdFilter
        ? { assignment: { courseId: { in: courseIdFilter } } }
        : {}),
    },
    select: {
      userId: true,
      dueDate: true,
      assignment: { select: { courseId: true } },
    },
  });

  // İlgili tüm CourseProgress tek sorguda.
  const courseIds = Array.from(
    new Set(assignments.map((a) => a.assignment.courseId))
  );
  const progresses = courseIds.length
    ? await prisma.courseProgress.findMany({
        where: { userId: { in: userIds }, courseId: { in: courseIds } },
        select: {
          userId: true,
          courseId: true,
          percentage: true,
          completedAt: true,
        },
      })
    : [];

  const { summary, users: rows } = buildDepartmentBoard(
    userInputs,
    assignments.map((a) => ({
      userId: a.userId,
      courseId: a.assignment.courseId,
      dueDate: a.dueDate,
    })),
    progresses,
    new Date()
  );

  return NextResponse.json({ bolum, packageId, summary, users: rows });
}
