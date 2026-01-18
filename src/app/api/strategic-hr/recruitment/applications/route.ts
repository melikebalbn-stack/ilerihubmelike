import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST - Yeni başvuru oluştur
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
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const jobOpeningId = searchParams.get("jobOpeningId");
    const candidateId = searchParams.get("candidateId");
    const status = searchParams.get("status");

    const where: any = {};

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
