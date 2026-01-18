import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CompetencyCategory } from "@/generated/prisma";

// GET - Yetkinlik listesi
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") as CompetencyCategory | null;
    const isActive = searchParams.get("isActive");

    const where: any = {};

    if (category) {
      where.category = category;
    }

    if (isActive !== null) {
      where.isActive = isActive === "true";
    }

    const competencies = await prisma.competency.findMany({
      where,
      orderBy: [
        { category: "asc" },
        { sortOrder: "asc" },
        { name: "asc" }
      ],
      include: {
        _count: {
          select: {
            positionCompetencies: true,
            employeeCompetencies: true
          }
        }
      }
    });

    return NextResponse.json(competencies);
  } catch (error) {
    console.error("Yetkinlik listesi hatası:", error);
    return NextResponse.json(
      { error: "Yetkinlikler alınırken hata oluştu" },
      { status: 500 }
    );
  }
}

// POST - Yeni yetkinlik oluştur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    // Yetki kontrolü
    const allowedRoles = ["IT_MANAGER", "ADMIN", "SUPER_ADMIN", "HR_MANAGER"];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
    }

    const body = await request.json();
    const { code, name, description, category, level1Desc, level2Desc, level3Desc, level4Desc, level5Desc, sortOrder } = body;

    // Validasyon
    if (!code || !name || !category) {
      return NextResponse.json(
        { error: "Kod, ad ve kategori zorunludur" },
        { status: 400 }
      );
    }

    // Kod benzersizlik kontrolü
    const existingCompetency = await prisma.competency.findUnique({
      where: { code }
    });

    if (existingCompetency) {
      return NextResponse.json(
        { error: "Bu kod zaten kullanılıyor" },
        { status: 400 }
      );
    }

    const competency = await prisma.competency.create({
      data: {
        code: code.toUpperCase(),
        name,
        description,
        category,
        level1Desc,
        level2Desc,
        level3Desc,
        level4Desc,
        level5Desc,
        sortOrder: sortOrder || 0
      }
    });

    return NextResponse.json(competency, { status: 201 });
  } catch (error) {
    console.error("Yetkinlik oluşturma hatası:", error);
    return NextResponse.json(
      { error: "Yetkinlik oluşturulurken hata oluştu" },
      { status: 500 }
    );
  }
}
