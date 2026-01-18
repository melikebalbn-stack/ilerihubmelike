import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PersonnelRequestStatus, PersonnelRequestType, EmploymentType, JobPriority } from "@/generated/prisma";

// Talep numarası oluştur
async function generateRequestNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PR-${year}-`;

  const lastRequest = await prisma.personnelRequest.findFirst({
    where: {
      requestNumber: { startsWith: prefix }
    },
    orderBy: { requestNumber: "desc" }
  });

  let nextNumber = 1;
  if (lastRequest) {
    const lastNumber = parseInt(lastRequest.requestNumber.replace(prefix, ""), 10);
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(3, "0")}`;
}

// GET - Eleman taleplerini listele
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const userRole = session.user.role;
    const userEmail = session.user.email || "";
    const userDepartment = session.user.department || "";

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as PersonnelRequestStatus | null;
    const department = searchParams.get("department");
    const myRequests = searchParams.get("myRequests") === "true";

    // Yetki kontrolü
    const fullAccessRoles = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "IT_MANAGER"];
    const hrDepartments = ["insan varliklari", "insan varlıkları", "human resources", "hr"];
    const isHrDepartment = hrDepartments.some(dept => userDepartment.toLowerCase().includes(dept));
    const hasFullAccess = fullAccessRoles.includes(userRole) || isHrDepartment;

    const where: any = {};

    // Tam yetkisi olmayanlar sadece kendi taleplerini görebilir
    if (!hasFullAccess || myRequests) {
      where.requesterEmail = userEmail;
    }

    if (status) {
      where.status = status;
    }

    if (department && hasFullAccess) {
      where.department = department;
    }

    const requests = await prisma.personnelRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        jobOpening: {
          select: {
            id: true,
            title: true,
            code: true,
            status: true
          }
        }
      }
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error("Eleman talepleri listesi hatası:", error);
    return NextResponse.json(
      { error: "Eleman talepleri alınırken hata oluştu" },
      { status: 500 }
    );
  }
}

// POST - Yeni eleman talebi oluştur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    // Tüm kullanıcılar talep oluşturabilir (kendi departmanları için)
    const body = await request.json();
    const {
      title,
      requestType,
      headcount,
      employmentType,
      justification,
      responsibilities,
      requirements,
      preferredStartDate,
      location,
      workModel,
      salaryMin,
      salaryMax,
      hasBudget,
      priority,
      status // DRAFT veya PENDING
    } = body;

    if (!title || !justification) {
      return NextResponse.json(
        { error: "Pozisyon adı ve gerekçe zorunludur" },
        { status: 400 }
      );
    }

    const requestNumber = await generateRequestNumber();

    const personnelRequest = await prisma.personnelRequest.create({
      data: {
        requestNumber,
        requesterId: session.user.id || session.user.email || "",
        requesterEmail: session.user.email || "",
        requesterName: session.user.name || "",
        department: session.user.department || "",
        title,
        requestType: (requestType as PersonnelRequestType) || "NEW_POSITION",
        headcount: headcount || 1,
        employmentType: (employmentType as EmploymentType) || "FULL_TIME",
        justification,
        responsibilities,
        requirements,
        preferredStartDate: preferredStartDate ? new Date(preferredStartDate) : null,
        location,
        workModel,
        salaryMin,
        salaryMax,
        hasBudget: hasBudget || false,
        priority: (priority as JobPriority) || "MEDIUM",
        status: (status as PersonnelRequestStatus) || "DRAFT"
      }
    });

    return NextResponse.json(personnelRequest, { status: 201 });
  } catch (error) {
    console.error("Eleman talebi oluşturma hatası:", error);
    return NextResponse.json(
      { error: "Eleman talebi oluşturulurken hata oluştu" },
      { status: 500 }
    );
  }
}
