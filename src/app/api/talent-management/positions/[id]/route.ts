import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PositionLevel } from "@/generated/prisma";

// GET - Tek pozisyon detayı
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

    const position = await prisma.position.findUnique({
      where: { id },
      include: {
        nextPosition: {
          select: {
            id: true,
            code: true,
            title: true
          }
        },
        requiredCompetencies: {
          include: {
            competency: {
              select: {
                id: true,
                code: true,
                name: true,
                category: true
              }
            }
          }
        },
        _count: {
          select: {
            talentProfiles: true,
            successionPlans: true
          }
        }
      }
    });

    if (!position) {
      return NextResponse.json({ error: "Pozisyon bulunamadı" }, { status: 404 });
    }

    return NextResponse.json(position);
  } catch (error) {
    console.error("Pozisyon detay hatası:", error);
    return NextResponse.json(
      { error: "Pozisyon alınırken hata oluştu" },
      { status: 500 }
    );
  }
}

// PUT - Pozisyon güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    if (!fullAccessRoles.includes(userRole) && !isHrDepartment) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      title,
      department,
      level,
      description,
      nextPositionId,
      isCritical,
      minExperienceYears,
      requiredEducation,
      isActive
    } = body;

    // Mevcut pozisyonu kontrol et
    const existingPosition = await prisma.position.findUnique({
      where: { id }
    });

    if (!existingPosition) {
      return NextResponse.json({ error: "Pozisyon bulunamadı" }, { status: 404 });
    }

    const position = await prisma.position.update({
      where: { id },
      data: {
        title: title || existingPosition.title,
        department: department || existingPosition.department,
        level: level as PositionLevel || existingPosition.level,
        description: description !== undefined ? description : existingPosition.description,
        nextPositionId: nextPositionId !== undefined ? nextPositionId : existingPosition.nextPositionId,
        isCritical: isCritical !== undefined ? isCritical : existingPosition.isCritical,
        minExperienceYears: minExperienceYears !== undefined ? minExperienceYears : existingPosition.minExperienceYears,
        requiredEducation: requiredEducation !== undefined ? requiredEducation : existingPosition.requiredEducation,
        isActive: isActive !== undefined ? isActive : existingPosition.isActive
      },
      include: {
        nextPosition: {
          select: {
            id: true,
            code: true,
            title: true
          }
        }
      }
    });

    return NextResponse.json(position);
  } catch (error) {
    console.error("Pozisyon güncelleme hatası:", error);
    return NextResponse.json(
      { error: "Pozisyon güncellenirken hata oluştu" },
      { status: 500 }
    );
  }
}

// DELETE - Pozisyon sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    if (!fullAccessRoles.includes(userRole) && !isHrDepartment) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
    }

    const { id } = await params;

    // Mevcut pozisyonu kontrol et
    const existingPosition = await prisma.position.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            talentProfiles: true,
            successionPlans: true
          }
        }
      }
    });

    if (!existingPosition) {
      return NextResponse.json({ error: "Pozisyon bulunamadı" }, { status: 404 });
    }

    // Bağlı kayıtlar varsa silme
    if (existingPosition._count.talentProfiles > 0) {
      return NextResponse.json(
        { error: "Bu pozisyona atanmış çalışanlar var. Önce çalışanları farklı pozisyona taşıyın." },
        { status: 400 }
      );
    }

    if (existingPosition._count.successionPlans > 0) {
      return NextResponse.json(
        { error: "Bu pozisyon için yedekleme planları var. Önce planları silin." },
        { status: 400 }
      );
    }

    // Önce ilişkili yetkinlikleri sil
    await prisma.positionCompetency.deleteMany({
      where: { positionId: id }
    });

    // Sonra pozisyonu sil
    await prisma.position.delete({
      where: { id }
    });

    return NextResponse.json({ message: "Pozisyon başarıyla silindi" });
  } catch (error) {
    console.error("Pozisyon silme hatası:", error);
    return NextResponse.json(
      { error: "Pozisyon silinirken hata oluştu" },
      { status: 500 }
    );
  }
}
