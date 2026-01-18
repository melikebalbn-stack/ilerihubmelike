import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - Tek ilan detayı
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

    const opening = await prisma.jobOpening.findUnique({
      where: { id },
      include: {
        applications: {
          include: {
            candidate: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: { appliedAt: "desc" }
        },
        _count: {
          select: { applications: true }
        }
      }
    });

    if (!opening) {
      return NextResponse.json({ error: "İlan bulunamadı" }, { status: 404 });
    }

    return NextResponse.json(opening);
  } catch (error) {
    console.error("İlan detay hatası:", error);
    return NextResponse.json(
      { error: "İlan alınırken hata oluştu" },
      { status: 500 }
    );
  }
}

// PUT - İlan güncelle
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

    // Mevcut ilanı kontrol et
    const existingOpening = await prisma.jobOpening.findUnique({
      where: { id }
    });

    if (!existingOpening) {
      return NextResponse.json({ error: "İlan bulunamadı" }, { status: 404 });
    }

    // Durum değişikliği için postingDate güncelle
    let postingDate = existingOpening.postingDate;
    if (body.status === "OPEN" && existingOpening.status !== "OPEN") {
      postingDate = new Date();
    }

    const opening = await prisma.jobOpening.update({
      where: { id },
      data: {
        title: body.title ?? existingOpening.title,
        department: body.department ?? existingOpening.department,
        location: body.location !== undefined ? body.location : existingOpening.location,
        employmentType: body.employmentType ?? existingOpening.employmentType,
        description: body.description !== undefined ? body.description : existingOpening.description,
        requirements: body.requirements !== undefined ? body.requirements : existingOpening.requirements,
        headcount: body.headcount ?? existingOpening.headcount,
        priority: body.priority ?? existingOpening.priority,
        status: body.status ?? existingOpening.status,
        salaryMin: body.salaryMin !== undefined ? body.salaryMin : existingOpening.salaryMin,
        salaryMax: body.salaryMax !== undefined ? body.salaryMax : existingOpening.salaryMax,
        closingDate: body.closingDate !== undefined ? (body.closingDate ? new Date(body.closingDate) : null) : existingOpening.closingDate,
        hiringManagerName: body.hiringManagerName !== undefined ? body.hiringManagerName : existingOpening.hiringManagerName,
        hiringManagerEmail: body.hiringManagerEmail !== undefined ? body.hiringManagerEmail : existingOpening.hiringManagerEmail,
        postingDate
      }
    });

    return NextResponse.json(opening);
  } catch (error) {
    console.error("İlan güncelleme hatası:", error);
    return NextResponse.json(
      { error: "İlan güncellenirken hata oluştu" },
      { status: 500 }
    );
  }
}

// DELETE - İlan sil
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

    // Önce başvuruları sil (Interview'lar onDelete: Cascade ile otomatik silinir)
    await prisma.jobApplication.deleteMany({
      where: { jobOpeningId: id }
    });

    // Son olarak ilanı sil
    await prisma.jobOpening.delete({
      where: { id }
    });

    return NextResponse.json({ message: "İlan başarıyla silindi" });
  } catch (error) {
    console.error("İlan silme hatası:", error);
    return NextResponse.json(
      { error: "İlan silinirken hata oluştu" },
      { status: 500 }
    );
  }
}
