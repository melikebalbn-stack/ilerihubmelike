import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";

// POST - Yeni başvuru oluştur
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-strategic-hr: requireSession (role/department session'dan)
    const { session, error } = await requireSession();
    if (error) return error;

    // PR-RECRUIT-RBAC: aday-pozisyon başvuru ekleme — admin veya
    // recruitment.candidate.view yetkisi (HR rolleri)
    const perms = session.user.permissions ?? [];
    if (!perms.includes('recruitment.admin') && !perms.includes('recruitment.candidate.view')) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
    }

    const body = await request.json();
    const { candidateId, jobOpeningId } = body;

    if (!candidateId || !jobOpeningId) {
      return NextResponse.json(
        { error: "Aday ve ilan seçimi zorunludur" },
        { status: 400 }
      );
    }

    // Aday kontrolü
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId }
    });

    if (!candidate) {
      return NextResponse.json({ error: "Aday bulunamadı" }, { status: 404 });
    }

    // İlan kontrolü
    const jobOpening = await prisma.jobOpening.findUnique({
      where: { id: jobOpeningId }
    });

    if (!jobOpening) {
      return NextResponse.json({ error: "İlan bulunamadı" }, { status: 404 });
    }

    // Mevcut başvuru kontrolü
    const existingApplication = await prisma.jobApplication.findFirst({
      where: {
        candidateId,
        jobOpeningId
      }
    });

    if (existingApplication) {
      return NextResponse.json(
        { error: "Bu aday zaten bu ilana başvurmuş" },
        { status: 400 }
      );
    }

    // Başvuru oluştur
    const application = await prisma.jobApplication.create({
      data: {
        candidateId,
        jobOpeningId,
        status: "NEW",
        appliedAt: new Date()
      },
      include: {
        candidate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        jobOpening: {
          select: {
            id: true,
            title: true,
            code: true
          }
        }
      }
    });

    return NextResponse.json(application, { status: 201 });
  } catch (error) {
    console.error("Başvuru oluşturma hatası:", error);
    return NextResponse.json(
      { error: "Başvuru oluşturulurken hata oluştu" },
      { status: 500 }
    );
  }
}

// GET - Başvuruları listele
export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;

    // PR-RECRUIT-RBAC: başvuru listesi — admin veya recruitment.view (departman)
    const perms = session.user.permissions ?? [];
    const isAdmin = perms.includes('recruitment.admin');
    const canViewByDept = perms.includes('recruitment.view');
    if (!isAdmin && !canViewByDept) {
      return NextResponse.json({ error: "Bu modüle erişim yetkiniz yok" }, { status: 403 });
    }
    const userDepartment = (session.user.department || '').toLowerCase();

    const { searchParams } = new URL(request.url);
    const jobOpeningId = searchParams.get("jobOpeningId");
    const candidateId = searchParams.get("candidateId");
    const status = searchParams.get("status");

    const where: any = {};

    // Departman müdürü: sadece kendi departmanı pozisyonlarına başvurular
    if (!isAdmin && canViewByDept && userDepartment) {
      where.jobOpening = {
        department: { contains: userDepartment, mode: "insensitive" },
      };
    }

    if (jobOpeningId) {
      where.jobOpeningId = jobOpeningId;
    }

    if (candidateId) {
      where.candidateId = candidateId;
    }

    if (status) {
      where.status = status;
    }

    const applications = await prisma.jobApplication.findMany({
      where,
      orderBy: { appliedAt: "desc" },
      include: {
        candidate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            currentTitle: true,
            currentCompany: true
          }
        },
        jobOpening: {
          select: {
            id: true,
            title: true,
            code: true,
            department: true,
            status: true
          }
        }
      }
    });

    return NextResponse.json(applications);
  } catch (error) {
    console.error("Başvurular listesi hatası:", error);
    return NextResponse.json(
      { error: "Başvurular alınırken hata oluştu" },
      { status: 500 }
    );
  }
}
