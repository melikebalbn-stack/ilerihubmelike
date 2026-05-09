import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";

// PR-RECRUIT-RBAC: aday detayı sadece admin veya kendi departmanı
// pozisyonlarına başvuran adayları görüntüler/edit/sil eder.
function recruitAccess(session: { user: { permissions?: string[]; department?: string | null } }) {
  const perms = session.user.permissions ?? [];
  return {
    isAdmin: perms.includes("recruitment.admin"),
    canViewCandidate: perms.includes("recruitment.candidate.view"),
    canViewByDept: perms.includes("recruitment.view"),
    userDepartment: (session.user.department || "").toLowerCase(),
  };
}

function canSeeCandidate(
  candidate: { applications: { jobOpening: { department: string } }[] },
  ctx: { isAdmin: boolean; canViewCandidate: boolean; canViewByDept: boolean; userDepartment: string }
): boolean {
  if (ctx.isAdmin || ctx.canViewCandidate) return true;
  if (!ctx.canViewByDept) return false;
  if (!ctx.userDepartment) return false;
  return candidate.applications.some(
    (a) => a.jobOpening.department.toLowerCase().includes(ctx.userDepartment)
  );
}

// GET - Tek aday detayı
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;

    const ctx = recruitAccess(session);
    if (!ctx.isAdmin && !ctx.canViewCandidate && !ctx.canViewByDept) {
      return NextResponse.json({ error: "Bu modüle erişim yetkiniz yok" }, { status: 403 });
    }

    const { id } = await params;

    const candidate = await prisma.candidate.findUnique({
      where: { id },
      include: {
        applications: {
          include: {
            jobOpening: {
              select: { id: true, title: true, code: true, department: true, status: true },
            },
            interviews: { orderBy: { scheduledAt: "desc" } },
          },
          orderBy: { appliedAt: "desc" },
        },
        _count: { select: { applications: true } },
      },
    });

    if (!candidate) {
      return NextResponse.json({ error: "Aday bulunamadı" }, { status: 404 });
    }

    if (!canSeeCandidate(candidate, ctx)) {
      return NextResponse.json({ error: "Bu adayı görüntüleme yetkiniz yok" }, { status: 403 });
    }

    return NextResponse.json(candidate);
  } catch (error) {
    console.error("Aday detay hatası:", error);
    return NextResponse.json(
      { error: "Aday alınırken hata oluştu" },
      { status: 500 }
    );
  }
}

// PUT - Aday güncelle (sadece admin veya recruitment.candidate.view)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;

    const ctx = recruitAccess(session);
    if (!ctx.isAdmin && !ctx.canViewCandidate) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const existingCandidate = await prisma.candidate.findUnique({ where: { id } });
    if (!existingCandidate) {
      return NextResponse.json({ error: "Aday bulunamadı" }, { status: 404 });
    }

    const normalizedEmail = typeof body.email === "string" ? body.email.toLowerCase() : body.email;

    if (normalizedEmail && normalizedEmail !== existingCandidate.email) {
      const emailExists = await prisma.candidate.findUnique({ where: { email: normalizedEmail } });
      if (emailExists) {
        return NextResponse.json(
          { error: "Bu e-posta adresi başka bir aday tarafından kullanılıyor" },
          { status: 400 }
        );
      }
    }

    const candidate = await prisma.candidate.update({
      where: { id },
      data: {
        firstName: body.firstName ?? existingCandidate.firstName,
        lastName: body.lastName ?? existingCandidate.lastName,
        email: normalizedEmail ?? existingCandidate.email,
        phone: body.phone !== undefined ? body.phone : existingCandidate.phone,
        currentTitle: body.currentTitle !== undefined ? body.currentTitle : existingCandidate.currentTitle,
        currentCompany: body.currentCompany !== undefined ? body.currentCompany : existingCandidate.currentCompany,
        yearsOfExperience: body.yearsOfExperience !== undefined ? body.yearsOfExperience : existingCandidate.yearsOfExperience,
        education: body.education !== undefined ? body.education : existingCandidate.education,
        skills: body.skills !== undefined ? body.skills : existingCandidate.skills,
        resumeUrl: body.resumeUrl !== undefined ? body.resumeUrl : existingCandidate.resumeUrl,
        linkedinUrl: body.linkedinUrl !== undefined ? body.linkedinUrl : existingCandidate.linkedinUrl,
        portfolioUrl: body.portfolioUrl !== undefined ? body.portfolioUrl : existingCandidate.portfolioUrl,
        source: body.source ?? existingCandidate.source,
        referredBy: body.referredBy !== undefined ? body.referredBy : existingCandidate.referredBy,
        notes: body.notes !== undefined ? body.notes : existingCandidate.notes,
        tags: body.tags !== undefined ? body.tags : existingCandidate.tags
      }
    });

    return NextResponse.json(candidate);
  } catch (error) {
    console.error("Aday güncelleme hatası:", error);
    return NextResponse.json(
      { error: "Aday güncellenirken hata oluştu" },
      { status: 500 }
    );
  }
}

// DELETE - Aday sil (sadece admin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;

    const ctx = recruitAccess(session);
    if (!ctx.isAdmin) {
      return NextResponse.json({ error: "Aday silmek için yönetim yetkisi gerekli" }, { status: 403 });
    }

    const { id } = await params;

    await prisma.jobApplication.deleteMany({ where: { candidateId: id } });
    await prisma.candidate.delete({ where: { id } });

    return NextResponse.json({ message: "Aday başarıyla silindi" });
  } catch (error) {
    console.error("Aday silme hatası:", error);
    return NextResponse.json(
      { error: "Aday silinirken hata oluştu" },
      { status: 500 }
    );
  }
}
