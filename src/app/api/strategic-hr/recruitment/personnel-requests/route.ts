import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PersonnelRequestStatus, PersonnelRequestType, EmploymentType, JobPriority } from "@/generated/prisma";
import { requireSession } from "@/lib/auth/require-session";

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
    // PR-Y2.5-strategic-hr: requireSession (role/department/email session'dan)
    const { session, error } = await requireSession();
    if (error) return error;

    const userEmail = (session.user.email || "").toLowerCase();
    const userDepartment = session.user.department || "";

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as PersonnelRequestStatus | null;
    const department = searchParams.get("department");
    const myRequests = searchParams.get("myRequests") === "true";

    // PR-RECRUIT-RBAC: hasFullAccess=admin; canViewByDept=departman müdürü
    // (kendi departmanı + kendi açtığı talepler görür)
    const perms = session.user.permissions ?? [];
    const hasFullAccess = perms.includes("recruitment.admin");
    const canViewByDept = perms.includes("recruitment.view");

    if (!hasFullAccess && !canViewByDept) {
      // Hiç recruitment yetkisi yok: sadece kendi açtığı talepleri görür
      // (talep oluşturma herkese açık olduğu için, kendi takip edebilsin)
    }

    const where: any = {};

    if (myRequests) {
      where.requesterEmail = userEmail;
    } else if (!hasFullAccess && canViewByDept) {
      // Departman müdürü: kendi departmanı VEYA kendi açtığı
      where.OR = [
        { department: userDepartment },
        { requesterEmail: userEmail },
      ];
    } else if (!hasFullAccess) {
      where.requesterEmail = userEmail;
    }

    if (status) where.status = status;
    if (department && hasFullAccess) where.department = department;

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
        },
        // Onay zinciri (liste + detay dialog için) — onaycı adı/karar/tarih.
        approvals: {
          orderBy: { step: "asc" },
          include: { approver: { select: { id: true, name: true, email: true } } }
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
    // PR-Y2.5-strategic-hr: requireSession (requesterId = userId)
    const { session, userId, error } = await requireSession();
    if (error) return error;

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
        requesterId: userId,
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
