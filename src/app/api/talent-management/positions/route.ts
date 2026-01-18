import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PositionLevel } from "@/generated/prisma";

// GET - Pozisyon listesi
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const department = searchParams.get("department");
    const level = searchParams.get("level") as PositionLevel | null;
    const isCritical = searchParams.get("isCritical");
    const isActive = searchParams.get("isActive");
    const source = searchParams.get("source"); // MANUAL veya AD

    const where: any = {};

    if (department) {
      where.department = { contains: department, mode: "insensitive" };
    }

    if (level) {
      where.level = level;
    }

    if (isCritical !== null) {
      where.isCritical = isCritical === "true";
    }

    if (isActive !== null) {
      where.isActive = isActive === "true";
    }

    if (source) {
      where.source = source;
    }

    const positions = await prisma.position.findMany({
      where,
      orderBy: [
        { department: "asc" },
        { level: "asc" },
        { title: "asc" }
      ],
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

    return NextResponse.json(positions);
  } catch (error) {
    console.error("Pozisyon listesi hatası:", error);
    return NextResponse.json(
      { error: "Pozisyonlar alınırken hata oluştu" },
      { status: 500 }
    );
  }
}

// POST - Yeni pozisyon oluştur (Manuel)
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { code, title, department, level, description, nextPositionId, isCritical, requiredCompetencies, minExperienceYears, requiredEducation } = body;

    if (!code || !title || !department || !level) {
      return NextResponse.json(
        { error: "Kod, unvan, departman ve seviye zorunludur" },
        { status: 400 }
      );
    }

    // Kod benzersizlik kontrolü
    const existingPosition = await prisma.position.findUnique({
      where: { code }
    });

    if (existingPosition) {
      return NextResponse.json(
        { error: "Bu kod zaten kullanılıyor" },
        { status: 400 }
      );
    }

    const position = await prisma.position.create({
      data: {
        code: code.toUpperCase(),
        title,
        department,
        level,
        description,
        nextPositionId,
        isCritical: isCritical || false,
        minExperienceYears: minExperienceYears || 0,
        requiredEducation: requiredEducation || null,
        source: "MANUAL" // Manuel olarak eklenen pozisyon
      }
    });

    // Gerekli yetkinlikleri ekle
    if (requiredCompetencies && requiredCompetencies.length > 0) {
      await prisma.positionCompetency.createMany({
        data: requiredCompetencies.map((comp: { competencyId: string; requiredLevel: number; weight: number }) => ({
          positionId: position.id,
          competencyId: comp.competencyId,
          requiredLevel: comp.requiredLevel,
          weight: comp.weight || 1
        }))
      });
    }

    return NextResponse.json(position, { status: 201 });
  } catch (error) {
    console.error("Pozisyon oluşturma hatası:", error);
    return NextResponse.json(
      { error: "Pozisyon oluşturulurken hata oluştu" },
      { status: 500 }
    );
  }
}
