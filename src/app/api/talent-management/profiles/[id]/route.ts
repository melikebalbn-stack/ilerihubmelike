import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - Profil detayı
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const { id } = await params;

    const profile = await prisma.talentProfile.findUnique({
      where: { id },
      include: {
        currentPosition: {
          include: {
            requiredCompetencies: {
              include: {
                competency: true
              }
            }
          }
        },
        competencies: {
          include: {
            competency: true
          },
          orderBy: { currentLevel: "desc" }
        },
        developmentPlans: {
          include: {
            goals: true
          },
          orderBy: { createdAt: "desc" }
        },
        careerPaths: {
          include: {
            targetPosition: true
          },
          orderBy: { createdAt: "desc" }
        },
        mentorOf: {
          include: {
            mentee: {
              select: {
                id: true,
                userName: true,
                userEmail: true
              }
            }
          }
        },
        menteeOf: {
          include: {
            mentor: {
              select: {
                id: true,
                userName: true,
                userEmail: true
              }
            }
          }
        },
        readyNowFor: {
          include: {
            successionPlan: {
              include: {
                position: true
              }
            }
          }
        },
        readyIn1YearFor: {
          include: {
            successionPlan: {
              include: {
                position: true
              }
            }
          }
        },
        readyIn2YearsFor: {
          include: {
            successionPlan: {
              include: {
                position: true
              }
            }
          }
        }
      }
    });

    if (!profile) {
      return NextResponse.json({ error: "Profil bulunamadı" }, { status: 404 });
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Profil detay hatası:", error);
    return NextResponse.json(
      { error: "Profil alınırken hata oluştu" },
      { status: 500 }
    );
  }
}

// PUT - Profil güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const allowedRoles = ["IT_MANAGER", "ADMIN", "SUPER_ADMIN", "HR_MANAGER"];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const existingProfile = await prisma.talentProfile.findUnique({
      where: { id }
    });

    if (!existingProfile) {
      return NextResponse.json({ error: "Profil bulunamadı" }, { status: 404 });
    }

    const {
      currentPositionId,
      performanceLevel,
      potentialLevel,
      retentionRisk,
      engagementLevel,
      tags,
      notes
    } = body;

    // Değişiklikleri izle
    const changes: string[] = [];
    if (performanceLevel && performanceLevel !== existingProfile.performanceLevel) {
      changes.push(`Performans seviyesi: ${existingProfile.performanceLevel} → ${performanceLevel}`);
    }
    if (potentialLevel && potentialLevel !== existingProfile.potentialLevel) {
      changes.push(`Potansiyel seviyesi: ${existingProfile.potentialLevel} → ${potentialLevel}`);
    }

    // 9-Box pozisyonunu yeniden hesapla
    let nineBoxPosition = existingProfile.nineBoxPosition;
    if (performanceLevel || potentialLevel) {
      nineBoxPosition = calculateNineBoxPosition(
        performanceLevel || existingProfile.performanceLevel,
        potentialLevel || existingProfile.potentialLevel
      );
    }

    const profile = await prisma.talentProfile.update({
      where: { id },
      data: {
        ...(currentPositionId !== undefined && { currentPositionId }),
        ...(performanceLevel && { performanceLevel }),
        ...(potentialLevel && { potentialLevel }),
        nineBoxPosition,
        ...(retentionRisk && { retentionRisk }),
        ...(engagementLevel && { engagementLevel }),
        ...(tags !== undefined && { tags })
      }
    });

    // Değişiklik varsa aktivite logu
    if (changes.length > 0) {
      await prisma.talentActivityLog.create({
        data: {
          employeeId: profile.userId,
          employeeEmail: profile.userEmail,
          employeeName: profile.userName,
          activityType: "PROFILE_UPDATED",
          description: changes.join(", "),
          performedBy: session.user.id,
          performedByName: session.user.name || session.user.email || "Bilinmiyor"
        }
      });
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Profil güncelleme hatası:", error);
    return NextResponse.json(
      { error: "Profil güncellenirken hata oluştu" },
      { status: 500 }
    );
  }
}

// DELETE - Profil sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const allowedRoles = ["IT_MANAGER", "ADMIN", "SUPER_ADMIN"];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
    }

    const { id } = await params;

    const existingProfile = await prisma.talentProfile.findUnique({
      where: { id }
    });

    if (!existingProfile) {
      return NextResponse.json({ error: "Profil bulunamadı" }, { status: 404 });
    }

    // İlişkili kayıtları sil
    await prisma.$transaction([
      prisma.employeeCompetency.deleteMany({ where: { talentProfileId: id } }),
      prisma.developmentGoal.deleteMany({
        where: { developmentPlan: { talentProfileId: id } }
      }),
      prisma.developmentPlan.deleteMany({ where: { talentProfileId: id } }),
      prisma.careerPath.deleteMany({ where: { talentProfileId: id } }),
      prisma.mentorshipRelation.deleteMany({
        where: { OR: [{ mentorId: id }, { menteeId: id }] }
      }),
      prisma.successionCandidate.deleteMany({
        where: {
          OR: [
            { readyNowProfileId: id },
            { readyIn1YearProfileId: id },
            { readyIn2YearsProfileId: id }
          ]
        }
      }),
      prisma.talentActivityLog.deleteMany({ where: { employeeId: existingProfile.userId } }),
      prisma.talentProfile.delete({ where: { id } })
    ]);

    return NextResponse.json({ success: true, message: "Profil silindi" });
  } catch (error) {
    console.error("Profil silme hatası:", error);
    return NextResponse.json(
      { error: "Profil silinirken hata oluştu" },
      { status: 500 }
    );
  }
}

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

  const positions = [
    ["1-1", "1-2", "1-3"],
    ["2-1", "2-2", "2-3"],
    ["3-1", "3-2", "3-3"]
  ];

  return positions[perfIndex][potIndex];
}
