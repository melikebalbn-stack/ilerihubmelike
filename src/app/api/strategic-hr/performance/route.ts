import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CycleType, PerformanceCycleStatus } from "@/generated/prisma";
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

// GET - Performans döngüleri listesi
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-strategic-hr: requireSession (checkAccess session okuyor)
    const { session, error } = await requireSession();
    if (error) return error;

    const { hasFullAccess, isDeptHead } = await checkAccess(session);

    if (!hasFullAccess && !isDeptHead) {
      return NextResponse.json({ error: "Bu modüle erişim yetkiniz yok" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const status = searchParams.get("status") as PerformanceCycleStatus | null;
    const isActive = searchParams.get("isActive");

    const where: any = {};

    if (year) {
      where.year = parseInt(year);
    }

    if (status) {
      where.status = status;
    }

    if (isActive !== null) {
      where.isActive = isActive === "true";
    }

    const cycles = await prisma.performanceCycle.findMany({
      where,
      orderBy: [
        { year: "desc" },
        { startDate: "desc" }
      ],
      include: {
        _count: {
          select: {
            reviews: true
          }
        }
      }
    });

    return NextResponse.json(cycles);
  } catch (error) {
    console.error("Performans döngüleri listesi hatası:", error);
    return NextResponse.json(
      { error: "Performans döngüleri alınırken hata oluştu" },
      { status: 500 }
    );
  }
}

// POST - Yeni performans döngüsü oluştur
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-strategic-hr: requireSession (createdBy = userId)
    const { session, userId, error } = await requireSession();
    if (error) return error;

    const { hasFullAccess } = await checkAccess(session);

    if (!hasFullAccess) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      description,
      year,
      cycleType,
      startDate,
      endDate,
      goalSettingStart,
      goalSettingEnd,
      midYearReviewStart,
      midYearReviewEnd,
      yearEndReviewStart,
      yearEndReviewEnd,
      calibrationStart,
      calibrationEnd,
      status,
      isActive
    } = body;

    if (!name || !year || !cycleType || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Ad, yıl, döngü tipi, başlangıç ve bitiş tarihi zorunludur" },
        { status: 400 }
      );
    }

    // Aynı yıl için aktif döngü varsa isActive false olmalı
    if (isActive) {
      await prisma.performanceCycle.updateMany({
        where: { year, isActive: true },
        data: { isActive: false }
      });
    }

    const cycle = await prisma.performanceCycle.create({
      data: {
        name,
        description,
        year,
        cycleType: cycleType as CycleType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        goalSettingStart: goalSettingStart ? new Date(goalSettingStart) : null,
        goalSettingEnd: goalSettingEnd ? new Date(goalSettingEnd) : null,
        midYearReviewStart: midYearReviewStart ? new Date(midYearReviewStart) : null,
        midYearReviewEnd: midYearReviewEnd ? new Date(midYearReviewEnd) : null,
        yearEndReviewStart: yearEndReviewStart ? new Date(yearEndReviewStart) : null,
        yearEndReviewEnd: yearEndReviewEnd ? new Date(yearEndReviewEnd) : null,
        calibrationStart: calibrationStart ? new Date(calibrationStart) : null,
        calibrationEnd: calibrationEnd ? new Date(calibrationEnd) : null,
        status: status || "DRAFT",
        isActive: isActive || false,
        createdBy: userId,
        createdByName: session.user.name || ""
      }
    });

    return NextResponse.json(cycle, { status: 201 });
  } catch (error) {
    console.error("Performans döngüsü oluşturma hatası:", error);
    return NextResponse.json(
      { error: "Performans döngüsü oluşturulurken hata oluştu" },
      { status: 500 }
    );
  }
}
