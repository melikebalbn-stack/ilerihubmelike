import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ReviewStatus } from "@/generated/prisma";
import { requireSession } from "@/lib/auth/require-session";

// Yetki kontrolü helper
async function checkAccess(session: any) {
  const userRole = session?.user?.role;
  const userDepartment = session?.user?.department || "";

  const fullAccessRoles = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "IT_MANAGER"];
  const hrDepartments = ["insan varliklari", "insan varlıkları", "human resources", "hr"];
  const isHrDepartment = hrDepartments.some(dept => userDepartment.toLowerCase().includes(dept));

  return {
    hasFullAccess: fullAccessRoles.includes(userRole) || isHrDepartment,
    isDeptHead: userRole === "DEPT_HEAD",
    userDepartment,
    userEmail: session?.user?.email || ""
  };
}

// GET - Performans değerlendirmeleri listesi
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-strategic-hr: requireSession (checkAccess session okuyor)
    const { session, error } = await requireSession();
    if (error) return error;

    const { hasFullAccess, isDeptHead, userDepartment, userEmail } = await checkAccess(session);

    const { searchParams } = new URL(request.url);
    const cycleId = searchParams.get("cycleId");
    const status = searchParams.get("status") as ReviewStatus | null;
    const employeeEmail = searchParams.get("employeeEmail");
    const managerEmail = searchParams.get("managerEmail");
    const myReviews = searchParams.get("myReviews"); // Kendi değerlendirmelerim
    const myTeam = searchParams.get("myTeam"); // Ekibimin değerlendirmeleri

    const where: any = {};

    if (cycleId) {
      where.cycleId = cycleId;
    }

    if (status) {
      where.status = status;
    }

    if (employeeEmail) {
      where.employeeEmail = employeeEmail.toLowerCase();
    }

    if (managerEmail) {
      where.managerEmail = managerEmail.toLowerCase();
    }

    // Kendi değerlendirmelerim
    if (myReviews === "true") {
      where.employeeEmail = userEmail;
    }

    // Ekibimin değerlendirmeleri (yönetici olarak)
    if (myTeam === "true") {
      where.managerEmail = userEmail;
    }

    // Departman müdürü sadece kendi departmanını görsün
    if (!hasFullAccess && isDeptHead && myReviews !== "true" && myTeam !== "true") {
      where.employeeDepartment = { contains: userDepartment, mode: "insensitive" };
    }

    // Normal kullanıcı sadece kendini görebilir
    if (!hasFullAccess && !isDeptHead) {
      where.OR = [
        { employeeEmail: userEmail },
        { managerEmail: userEmail }
      ];
    }

    const reviews = await prisma.performanceReview.findMany({
      where,
      orderBy: [
        { status: "asc" },
        { employeeName: "asc" }
      ],
      include: {
        cycle: {
          select: {
            id: true,
            name: true,
            year: true,
            cycleType: true,
            status: true
          }
        },
        goals: {
          orderBy: { weight: "desc" }
        },
        _count: {
          select: {
            goals: true
          }
        }
      }
    });

    return NextResponse.json(reviews);
  } catch (error) {
    console.error("Performans değerlendirmeleri listesi hatası:", error);
    return NextResponse.json(
      { error: "Performans değerlendirmeleri alınırken hata oluştu" },
      { status: 500 }
    );
  }
}

// POST - Yeni performans değerlendirmesi oluştur
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-strategic-hr: requireSession (checkAccess session okuyor)
    const { session, error } = await requireSession();
    if (error) return error;

    const { hasFullAccess } = await checkAccess(session);

    if (!hasFullAccess) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
    }

    const body = await request.json();
    const {
      cycleId,
      employeeId,
      employeeEmail,
      employeeName,
      employeeDepartment,
      managerId,
      managerEmail,
      managerName
    } = body;

    if (!cycleId || !employeeId || !employeeEmail || !employeeName) {
      return NextResponse.json(
        { error: "Döngü ve çalışan bilgileri zorunludur" },
        { status: 400 }
      );
    }

    // Aynı döngü ve çalışan için zaten var mı kontrol et
    const existingReview = await prisma.performanceReview.findUnique({
      where: {
        cycleId_employeeId: {
          cycleId,
          employeeId
        }
      }
    });

    if (existingReview) {
      return NextResponse.json(
        { error: "Bu çalışan için bu döngüde zaten değerlendirme var" },
        { status: 400 }
      );
    }

    const review = await prisma.performanceReview.create({
      data: {
        cycleId,
        employeeId,
        employeeEmail: typeof employeeEmail === "string" ? employeeEmail.toLowerCase() : employeeEmail,
        employeeName,
        employeeDepartment,
        managerId,
        managerEmail: typeof managerEmail === "string" ? managerEmail.toLowerCase() : managerEmail,
        managerName,
        status: "NOT_STARTED"
      },
      include: {
        cycle: true
      }
    });

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    console.error("Performans değerlendirmesi oluşturma hatası:", error);
    return NextResponse.json(
      { error: "Performans değerlendirmesi oluşturulurken hata oluştu" },
      { status: 500 }
    );
  }
}
