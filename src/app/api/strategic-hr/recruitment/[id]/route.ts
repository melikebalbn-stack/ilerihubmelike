import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";

// PR-RECRUIT-RBAC: permissions tabanlı; departman müdürü kendi
// departmanı VEYA hiring manager olduğu pozisyonu görür/düzenler.
function recruitAccess(session: { user: { permissions?: string[]; department?: string | null; email?: string | null } }) {
  const perms = session.user.permissions ?? [];
  return {
    isAdmin: perms.includes("recruitment.admin"),
    canViewByDept: perms.includes("recruitment.view"),
    userDepartment: (session.user.department || "").toLowerCase(),
    userEmail: (session.user.email || "").toLowerCase(),
  };
}

function canSeeOpening(
  opening: { department: string; hiringManagerEmail: string | null },
  ctx: { isAdmin: boolean; canViewByDept: boolean; userDepartment: string; userEmail: string }
): boolean {
  if (ctx.isAdmin) return true;
  if (!ctx.canViewByDept) return false;
  const deptMatch = opening.department.toLowerCase().includes(ctx.userDepartment) && ctx.userDepartment.length > 0;
  const ownerMatch = (opening.hiringManagerEmail || "").toLowerCase() === ctx.userEmail;
  return deptMatch || ownerMatch;
}

// GET - Tek ilan detayı
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;

    const ctx = recruitAccess(session);
    if (!ctx.isAdmin && !ctx.canViewByDept) {
      return NextResponse.json({ error: "Bu modüle erişim yetkiniz yok" }, { status: 403 });
    }

    const { id } = await params;

    const opening = await prisma.jobOpening.findUnique({
      where: { id },
      include: {
        applications: {
          include: {
            candidate: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
          orderBy: { appliedAt: "desc" },
        },
        _count: { select: { applications: true } },
      },
    });

    if (!opening) {
      return NextResponse.json({ error: "İlan bulunamadı" }, { status: 404 });
    }

    if (!canSeeOpening(opening, ctx)) {
      return NextResponse.json({ error: "Bu ilanı görüntüleme yetkiniz yok" }, { status: 403 });
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
    const { session, error } = await requireSession();
    if (error) return error;

    const ctx = recruitAccess(session);
    if (!ctx.isAdmin && !ctx.canViewByDept) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const existingOpening = await prisma.jobOpening.findUnique({ where: { id } });
    if (!existingOpening) {
      return NextResponse.json({ error: "İlan bulunamadı" }, { status: 404 });
    }

    if (!canSeeOpening(existingOpening, ctx)) {
      return NextResponse.json({ error: "Bu ilanı düzenleme yetkiniz yok" }, { status: 403 });
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
        hiringManagerEmail: body.hiringManagerEmail !== undefined
          ? (typeof body.hiringManagerEmail === "string" ? body.hiringManagerEmail.toLowerCase() : body.hiringManagerEmail)
          : existingOpening.hiringManagerEmail,
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

// DELETE - İlan sil (sadece admin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;

    const ctx = recruitAccess(session);
    if (!ctx.isAdmin) {
      return NextResponse.json({ error: "İlan silmek için yönetim yetkisi gerekli" }, { status: 403 });
    }

    const { id } = await params;

    // Önce başvuruları sil (Interview'lar onDelete: Cascade ile otomatik silinir)
    await prisma.jobApplication.deleteMany({ where: { jobOpeningId: id } });

    await prisma.jobOpening.delete({ where: { id } });

    return NextResponse.json({ message: "İlan başarıyla silindi" });
  } catch (error) {
    console.error("İlan silme hatası:", error);
    return NextResponse.json(
      { error: "İlan silinirken hata oluştu" },
      { status: 500 }
    );
  }
}
