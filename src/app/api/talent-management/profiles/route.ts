import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - Yetenek profili listesi
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const userRole = session.user.role;
    const userDepartment = session.user.department || "";

    // Yetki kontrolü
    const fullAccessRoles = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "IT_MANAGER"];
    const hrDepartments = ["insan varliklari", "insan varlıkları", "human resources", "hr"];
    const isHrDepartment = hrDepartments.some(dept => userDepartment.toLowerCase().includes(dept));
    const hasFullAccess = fullAccessRoles.includes(userRole) || isHrDepartment;

    // Departman müdürü (DEPT_HEAD) ve tam erişimi olmayanlar için kontrol
    if (!hasFullAccess && userRole !== "DEPT_HEAD") {
      return NextResponse.json({ error: "Bu modüle erişim yetkiniz yok" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const performanceLevel = searchParams.get("performanceLevel");
    const potentialLevel = searchParams.get("potentialLevel");
    const nineBoxPosition = searchParams.get("nineBoxPosition");
    const retentionRisk = searchParams.get("retentionRisk");
    const search = searchParams.get("search");

    const where: any = {};

    // Departman müdürü ise sadece kendi departmanını görsün
    if (!hasFullAccess && userRole === "DEPT_HEAD") {
      where.department = { contains: userDepartment, mode: "insensitive" };
    }

    if (performanceLevel) {
      where.performanceLevel = performanceLevel;
    }

    if (potentialLevel) {
      where.potentialLevel = potentialLevel;
    }

    if (nineBoxPosition) {
      where.nineBoxPosition = nineBoxPosition;
    }

    if (retentionRisk) {
      where.retentionRisk = retentionRisk;
    }

    if (search) {
      where.OR = [
        { userName: { contains: search, mode: "insensitive" } },
        { userEmail: { contains: search, mode: "insensitive" } }
      ];
    }

    const profiles = await prisma.talentProfile.findMany({
      where,
      orderBy: [
        { talentScore: "desc" },
        { userName: "asc" }
      ],
      include: {
        currentPosition: {
          select: {
            id: true,
            code: true,
            title: true,
            department: true,
            level: true
          }
        },
        competencies: {
          include: {
            competency: {
              select: {
                id: true,
                code: true,
                name: true,
                category: true
              }
            }
          },
          orderBy: { currentLevel: "desc" }
        },
        _count: {
          select: {
            developmentPlans: true,
            careerPaths: true,
            mentorOf: true,
            menteeOf: true
          }
        }
      }
    });

    return NextResponse.json(profiles);
  } catch (error) {
    console.error("Profil listesi hatası:", error);
    return NextResponse.json(
      { error: "Profiller alınırken hata oluştu" },
      { status: 500 }
    );
  }
}

// POST - Yeni yetenek profili oluştur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const userRole = session.user.role;
    const userDepartment = session.user.department || "";

    // Yetki kontrolü - sadece tam erişimi olanlar profil oluşturabilir
    const fullAccessRoles = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "IT_MANAGER"];
    const hrDepartments = ["insan varliklari", "insan varlıkları", "human resources", "hr"];
    const isHrDepartment = hrDepartments.some(dept => userDepartment.toLowerCase().includes(dept));

    if (!fullAccessRoles.includes(userRole) && !isHrDepartment) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, userEmail, userName, currentPositionId, performanceLevel, potentialLevel, retentionRisk, engagementLevel, tags, notes } = body;

    if (!userId || !userEmail || !userName) {
      return NextResponse.json(
        { error: "Kullanıcı ID, email ve isim zorunludur" },
        { status: 400 }
      );
    }

    // Mevcut profil kontrolü
    const existingProfile = await prisma.talentProfile.findUnique({
      where: { userId }
    });

    if (existingProfile) {
      return NextResponse.json(
        { error: "Bu kullanıcı için zaten bir profil var" },
        { status: 400 }
      );
    }

    // 9-Box pozisyonunu hesapla
    const nineBoxPosition = calculateNineBoxPosition(
      performanceLevel || "MEETING",
      potentialLevel || "MEDIUM"
    );

    const profile = await prisma.talentProfile.create({
      data: {
        userId,
        userEmail,
        userName,
        currentPositionId,
        performanceLevel: performanceLevel || "MEETING",
        potentialLevel: potentialLevel || "MEDIUM",
        nineBoxPosition,
        retentionRisk: retentionRisk || "LOW",
        engagementLevel: engagementLevel || "ENGAGED",
        tags: tags || []
      }
    });

    // Aktivite logu
    await prisma.talentActivityLog.create({
      data: {
        employeeId: userId,
        employeeEmail: userEmail,
        employeeName: userName,
        activityType: "PROFILE_CREATED",
        description: `${userName} için yetenek profili oluşturuldu`,
        performedBy: session.user.id,
        performedByName: session.user.name || session.user.email || "Bilinmiyor"
      }
    });

    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    console.error("Profil oluşturma hatası:", error);
    return NextResponse.json(
      { error: "Profil oluşturulurken hata oluştu" },
      { status: 500 }
    );
  }
}

// 9-Box Grid pozisyonunu hesapla
function calculateNineBoxPosition(performanceLevel: string, potentialLevel: string): string {
  const performanceMap: Record<string, number> = {
    LOW: 0,
    MEETING: 1,
    EXCEEDING: 2
  };

  const potentialMap: Record<string, number> = {
    LOW: 0,
    MEDIUM: 1,
    HIGH: 2
  };

  const perfIndex = performanceMap[performanceLevel] || 1;
  const potIndex = potentialMap[potentialLevel] || 1;

  // 9-Box Grid pozisyonları (0-8)
  // [0,1,2] = Düşük Performans (Potansiyel: Düşük, Orta, Yüksek)
  // [3,4,5] = Orta Performans
  // [6,7,8] = Yüksek Performans
  const positions = [
    ["1-1", "1-2", "1-3"], // Düşük Performans
    ["2-1", "2-2", "2-3"], // Orta Performans
    ["3-1", "3-2", "3-3"]  // Yüksek Performans
  ];

  return positions[perfIndex][potIndex];
}
