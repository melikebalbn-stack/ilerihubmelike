import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SuccessionStatus, SuccessionPriority, VacancyRisk } from "@/generated/prisma";

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
    userDepartment
  };
}

// GET - Yedekleme planları listesi
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const { hasFullAccess, isDeptHead, userDepartment } = await checkAccess(session);

    if (!hasFullAccess && !isDeptHead) {
      return NextResponse.json({ error: "Bu modüle erişim yetkiniz yok" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as SuccessionStatus | null;
    const priority = searchParams.get("priority") as SuccessionPriority | null;
    const positionId = searchParams.get("positionId");

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    if (positionId) {
      where.positionId = positionId;
    }

    // Departman müdürü sadece kendi departmanındaki pozisyonları görsün
    if (!hasFullAccess && isDeptHead) {
      where.position = {
        department: { contains: userDepartment, mode: "insensitive" }
      };
    }

    const plans = await prisma.successionPlan.findMany({
      where,
      orderBy: [
        { priority: "desc" },
        { createdAt: "desc" }
      ],
      include: {
        position: {
          select: {
            id: true,
            code: true,
            title: true,
            department: true,
            level: true,
            isCritical: true
          }
        },
        candidates: {
          include: {
            readyNowProfile: {
              select: {
                id: true,
                userName: true,
                userEmail: true,
                department: true,
                nineBoxPosition: true
              }
            },
            readyIn1YearProfile: {
              select: {
                id: true,
                userName: true,
                userEmail: true,
                department: true,
                nineBoxPosition: true
              }
            },
            readyIn2YearsProfile: {
              select: {
                id: true,
                userName: true,
                userEmail: true,
                department: true,
                nineBoxPosition: true
              }
            }
          }
        }
      }
    });

    return NextResponse.json(plans);
  } catch (error) {
    console.error("Yedekleme planları listesi hatası:", error);
    return NextResponse.json(
      { error: "Yedekleme planları alınırken hata oluştu" },
      { status: 500 }
    );
  }
}

// POST - Yeni yedekleme planı oluştur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const { hasFullAccess } = await checkAccess(session);

    if (!hasFullAccess) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
    }

    const body = await request.json();
    const {
      positionId,
      currentHolderId,
      currentHolderEmail,
      currentHolderName,
      status,
      priority,
      vacancyRisk,
      impactIfVacant,
      notes
    } = body;

    if (!positionId) {
      return NextResponse.json(
        { error: "Pozisyon seçimi zorunludur" },
        { status: 400 }
      );
    }

    // Aynı pozisyon için aktif plan var mı kontrol et
    const existingPlan = await prisma.successionPlan.findFirst({
      where: {
        positionId,
        status: { in: ["DRAFT", "ACTIVE"] }
      }
    });

    if (existingPlan) {
      return NextResponse.json(
        { error: "Bu pozisyon için zaten aktif bir yedekleme planı var" },
        { status: 400 }
      );
    }

    const plan = await prisma.successionPlan.create({
      data: {
        positionId,
        currentHolderId,
        currentHolderEmail,
        currentHolderName,
        status: status || "DRAFT",
        priority: priority || "MEDIUM",
        vacancyRisk: vacancyRisk || "LOW",
        impactIfVacant,
        notes,
        createdBy: session.user.id || session.user.email || "",
        createdByName: session.user.name || ""
      },
      include: {
        position: true
      }
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    console.error("Yedekleme planı oluşturma hatası:", error);
    return NextResponse.json(
      { error: "Yedekleme planı oluşturulurken hata oluştu" },
      { status: 500 }
    );
  }
}
