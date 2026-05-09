import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { JobOpeningStatus, JobPriority, EmploymentType, Prisma } from "@/generated/prisma";
import { requireSession } from "@/lib/auth/require-session";

// PR-RECRUIT-RBAC: fullAccessRoles enum + isHrDepartment string fallback
// kaldırıldı, permissions tabanlı:
//   recruitment.admin: tam yönetim (super-admin/admin/hr-yoneticisi)
//   recruitment.view:  kendi departmanı görünürlük (departman-muduru)
//   recruitment.create: pozisyon/talep oluşturma
function recruitAccess(session: { user: { permissions?: string[]; department?: string | null; email?: string | null } }) {
  const perms = session.user.permissions ?? [];
  return {
    isAdmin: perms.includes("recruitment.admin"),
    canViewByDept: perms.includes("recruitment.view"),
    canCreate: perms.includes("recruitment.create"),
    userDepartment: session.user.department || "",
    userEmail: session.user.email || "",
  };
}

// GET - Açık pozisyonlar listesi
export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;

    const { isAdmin, canViewByDept, userDepartment, userEmail } = recruitAccess(session);

    if (!isAdmin && !canViewByDept) {
      return NextResponse.json({ error: "Bu modüle erişim yetkiniz yok" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as JobOpeningStatus | null;
    const priority = searchParams.get("priority") as JobPriority | null;
    const department = searchParams.get("department");
    const employmentType = searchParams.get("employmentType") as EmploymentType | null;

    const where: Prisma.JobOpeningWhereInput = {};

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (department) where.department = { contains: department, mode: "insensitive" };
    if (employmentType) where.employmentType = employmentType;

    // Departman müdürü: kendi departmanı VEYA hiring manager olduğu pozisyonlar
    if (!isAdmin && canViewByDept) {
      where.OR = [
        { department: { contains: userDepartment, mode: "insensitive" } },
        { hiringManagerEmail: userEmail },
      ];
    }

    const openings = await prisma.jobOpening.findMany({
      where,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      include: {
        applications: {
          select: { id: true, status: true },
        },
        interviewStages: { orderBy: { order: "asc" } },
        _count: { select: { applications: true } },
      },
    });

    return NextResponse.json(openings);
  } catch (error) {
    console.error("Açık pozisyonlar listesi hatası:", error);
    return NextResponse.json(
      { error: "Açık pozisyonlar alınırken hata oluştu" },
      { status: 500 }
    );
  }
}

// POST - Yeni iş ilanı oluştur
export async function POST(request: NextRequest) {
  try {
    const { session, userId, error } = await requireSession();
    if (error) return error;

    const { canCreate } = recruitAccess(session);

    if (!canCreate) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
    }

    const body = await request.json();
    const {
      title,
      department,
      location,
      employmentType,
      positionId,
      description,
      responsibilities,
      requirements,
      qualifications,
      benefits,
      salaryMin,
      salaryMax,
      salaryCurrency,
      showSalary,
      hiringManagerId,
      hiringManagerEmail,
      hiringManagerName,
      recruiterId,
      recruiterEmail,
      recruiterName,
      headcount,
      postingDate,
      closingDate,
      targetHireDate,
      priority,
      interviewStages
    } = body;

    if (!title || !department || !employmentType || !description) {
      return NextResponse.json(
        { error: "Başlık, departman, çalışma tipi ve açıklama zorunludur" },
        { status: 400 }
      );
    }

    // Otomatik kod oluştur
    const year = new Date().getFullYear();
    const count = await prisma.jobOpening.count({
      where: { code: { startsWith: `JOB-${year}-` } },
    });
    const code = `JOB-${year}-${String(count + 1).padStart(3, "0")}`;

    const opening = await prisma.jobOpening.create({
      data: {
        code,
        title,
        department,
        location,
        employmentType: employmentType as EmploymentType,
        positionId,
        description,
        responsibilities,
        requirements,
        qualifications,
        benefits,
        salaryMin,
        salaryMax,
        salaryCurrency: salaryCurrency || "TRY",
        showSalary: showSalary || false,
        hiringManagerId,
        hiringManagerEmail: typeof hiringManagerEmail === "string" ? hiringManagerEmail.toLowerCase() : hiringManagerEmail,
        hiringManagerName,
        recruiterId,
        recruiterEmail: typeof recruiterEmail === "string" ? recruiterEmail.toLowerCase() : recruiterEmail,
        recruiterName,
        headcount: headcount || 1,
        postingDate: postingDate ? new Date(postingDate) : null,
        closingDate: closingDate ? new Date(closingDate) : null,
        targetHireDate: targetHireDate ? new Date(targetHireDate) : null,
        status: "DRAFT",
        priority: priority || "MEDIUM",
        createdBy: userId,
        createdByName: session.user.name || "",
        interviewStages: interviewStages ? {
          create: interviewStages.map((stage: any, index: number) => ({
            name: stage.name,
            description: stage.description,
            order: index + 1,
            interviewType: stage.interviewType,
            durationMinutes: stage.durationMinutes || 60,
            evaluatorEmails: stage.evaluatorEmails || [],
            evaluationCriteria: stage.evaluationCriteria || [],
            isRequired: stage.isRequired !== false
          }))
        } : undefined
      },
      include: { interviewStages: true },
    });

    return NextResponse.json(opening, { status: 201 });
  } catch (error) {
    console.error("İş ilanı oluşturma hatası:", error);
    return NextResponse.json(
      { error: "İş ilanı oluşturulurken hata oluştu" },
      { status: 500 }
    );
  }
}
