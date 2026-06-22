import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - Yetkinlik detayı
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

    const competency = await prisma.competency.findUnique({
      where: { id },
      include: {
        positionCompetencies: {
          include: {
            position: {
              select: {
                id: true,
                code: true,
                title: true,
                department: true,
                level: true
              }
            }
          }
        },
        employeeCompetencies: {
          include: {
            talentProfile: {
              select: {
                id: true,
                userId: true,
                userName: true,
                userEmail: true
              }
            }
          },
          orderBy: { currentLevel: "desc" }
        }
      }
    });

    if (!competency) {
      return NextResponse.json({ error: "Yetkinlik bulunamadı" }, { status: 404 });
    }

    return NextResponse.json(competency);
  } catch (error) {
    console.error("Yetkinlik detay hatası:", error);
    return NextResponse.json(
      { error: "Yetkinlik alınırken hata oluştu" },
      { status: 500 }
    );
  }
}

// PUT - Yetkinlik güncelle
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
    const { name, description, category, level1Desc, level2Desc, level3Desc, level4Desc, level5Desc, sortOrder, isActive } = body;

    const existingCompetency = await prisma.competency.findUnique({
      where: { id }
    });

    if (!existingCompetency) {
      return NextResponse.json({ error: "Yetkinlik bulunamadı" }, { status: 404 });
    }

    const competency = await prisma.competency.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(category && { category }),
        ...(level1Desc !== undefined && { level1Desc }),
        ...(level2Desc !== undefined && { level2Desc }),
        ...(level3Desc !== undefined && { level3Desc }),
        ...(level4Desc !== undefined && { level4Desc }),
        ...(level5Desc !== undefined && { level5Desc }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive })
      }
    });

    return NextResponse.json(competency);
  } catch (error) {
    console.error("Yetkinlik güncelleme hatası:", error);
    return NextResponse.json(
      { error: "Yetkinlik güncellenirken hata oluştu" },
      { status: 500 }
    );
  }
}

// DELETE - Yetkinlik sil
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

    // Bağlı kayıt kontrolü
    const competency = await prisma.competency.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            positionCompetencies: true,
            employeeCompetencies: true
          }
        }
      }
    });

    if (!competency) {
      return NextResponse.json({ error: "Yetkinlik bulunamadı" }, { status: 404 });
    }

    if (competency._count.positionCompetencies > 0 || competency._count.employeeCompetencies > 0) {
      return NextResponse.json(
        { error: "Bu yetkinlik pozisyon veya çalışanlara bağlı olduğu için silinemez. Önce pasif yapabilirsiniz." },
        { status: 400 }
      );
    }

    await prisma.competency.delete({
      where: { id }
    });

    return NextResponse.json({ success: true, message: "Yetkinlik silindi" });
  } catch (error) {
    console.error("Yetkinlik silme hatası:", error);
    return NextResponse.json(
      { error: "Yetkinlik silinirken hata oluştu" },
      { status: 500 }
    );
  }
}
