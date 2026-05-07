import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";

// GET - Tek aday detayı
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-strategic-hr: requireSession (read-only detay)
    const { error } = await requireSession();
    if (error) return error;

    const { id } = await params;

    const candidate = await prisma.candidate.findUnique({
      where: { id },
      include: {
        applications: {
          include: {
            jobOpening: {
              select: {
                id: true,
                title: true,
                code: true,
                department: true,
                status: true
              }
            },
            interviews: {
              orderBy: { scheduledAt: "desc" }
            }
          },
          orderBy: { appliedAt: "desc" }
        },
        _count: {
          select: {
            applications: true
          }
        }
      }
    });

    if (!candidate) {
      return NextResponse.json({ error: "Aday bulunamadı" }, { status: 404 });
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

// PUT - Aday güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-strategic-hr: requireSession (role/department session'dan)
    const { session, error } = await requireSession();
    if (error) return error;

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

    // Mevcut adayı kontrol et
    const existingCandidate = await prisma.candidate.findUnique({
      where: { id }
    });

    if (!existingCandidate) {
      return NextResponse.json({ error: "Aday bulunamadı" }, { status: 404 });
    }

    const normalizedEmail = typeof body.email === "string" ? body.email.toLowerCase() : body.email;

    // E-posta değiştiyse benzersizlik kontrolü
    if (normalizedEmail && normalizedEmail !== existingCandidate.email) {
      const emailExists = await prisma.candidate.findUnique({
        where: { email: normalizedEmail }
      });
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

// DELETE - Aday sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-strategic-hr: requireSession (role/department session'dan)
    const { session, error } = await requireSession();
    if (error) return error;

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
      where: { candidateId: id }
    });

    // Son olarak adayı sil
    await prisma.candidate.delete({
      where: { id }
    });

    return NextResponse.json({ message: "Aday başarıyla silindi" });
  } catch (error) {
    console.error("Aday silme hatası:", error);
    return NextResponse.json(
      { error: "Aday silinirken hata oluştu" },
      { status: 500 }
    );
  }
}
