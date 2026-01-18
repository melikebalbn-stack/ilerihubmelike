import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PersonnelRequestStatus } from "@/generated/prisma";

// GET - Tek talep detayı
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

    const personnelRequest = await prisma.personnelRequest.findUnique({
      where: { id },
      include: {
        jobOpening: {
          select: {
            id: true,
            title: true,
            code: true,
            status: true,
            _count: {
              select: { applications: true }
            }
          }
        }
      }
    });

    if (!personnelRequest) {
      return NextResponse.json({ error: "Talep bulunamadı" }, { status: 404 });
    }

    return NextResponse.json(personnelRequest);
  } catch (error) {
    console.error("Talep detay hatası:", error);
    return NextResponse.json(
      { error: "Talep alınırken hata oluştu" },
      { status: 500 }
    );
  }
}

// PUT - Talep güncelle veya onay/red işlemi
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action } = body; // "approve", "reject", "update", "submit", "cancel"

    const userRole = session.user.role;
    const userEmail = session.user.email || "";
    const userDepartment = session.user.department || "";

    // Yetki kontrolü
    const fullAccessRoles = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "IT_MANAGER"];
    const hrDepartments = ["insan varliklari", "insan varlıkları", "human resources", "hr"];
    const isHrDepartment = hrDepartments.some(dept => userDepartment.toLowerCase().includes(dept));
    const hasFullAccess = fullAccessRoles.includes(userRole) || isHrDepartment;

    // Mevcut talebi al
    const existingRequest = await prisma.personnelRequest.findUnique({
      where: { id }
    });

    if (!existingRequest) {
      return NextResponse.json({ error: "Talep bulunamadı" }, { status: 404 });
    }

    // İşlem türüne göre yetki kontrolü
    if (action === "approve" || action === "reject") {
      // Sadece IK onaylayabilir/reddedebilir
      if (!hasFullAccess) {
        return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
      }
    } else if (action === "update" || action === "submit" || action === "cancel") {
      // Sadece talep sahibi güncelleyebilir (DRAFT durumundayken)
      if (existingRequest.requesterEmail !== userEmail && !hasFullAccess) {
        return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
      }
    }

    let updateData: any = {};

    switch (action) {
      case "approve":
        if (existingRequest.status !== "PENDING") {
          return NextResponse.json({ error: "Sadece bekleyen talepler onaylanabilir" }, { status: 400 });
        }
        updateData = {
          status: "APPROVED" as PersonnelRequestStatus,
          approvedById: session.user.id || userEmail,
          approvedByEmail: userEmail,
          approvedByName: session.user.name || "",
          approvedAt: new Date(),
          approvalNotes: body.approvalNotes
        };
        break;

      case "reject":
        if (existingRequest.status !== "PENDING") {
          return NextResponse.json({ error: "Sadece bekleyen talepler reddedilebilir" }, { status: 400 });
        }
        if (!body.rejectionReason) {
          return NextResponse.json({ error: "Red gerekçesi zorunludur" }, { status: 400 });
        }
        updateData = {
          status: "REJECTED" as PersonnelRequestStatus,
          rejectedById: session.user.id || userEmail,
          rejectedByEmail: userEmail,
          rejectedByName: session.user.name || "",
          rejectedAt: new Date(),
          rejectionReason: body.rejectionReason
        };
        break;

      case "submit":
        if (existingRequest.status !== "DRAFT") {
          return NextResponse.json({ error: "Sadece taslak talepler gönderilebilir" }, { status: 400 });
        }
        updateData = {
          status: "PENDING" as PersonnelRequestStatus
        };
        break;

      case "cancel":
        if (!["DRAFT", "PENDING"].includes(existingRequest.status)) {
          return NextResponse.json({ error: "Bu talep iptal edilemez" }, { status: 400 });
        }
        updateData = {
          status: "CANCELLED" as PersonnelRequestStatus
        };
        break;

      case "update":
        // Sadece DRAFT durumundaki talepler güncellenebilir
        if (existingRequest.status !== "DRAFT" && !hasFullAccess) {
          return NextResponse.json({ error: "Sadece taslak talepler güncellenebilir" }, { status: 400 });
        }
        updateData = {
          title: body.title ?? existingRequest.title,
          requestType: body.requestType ?? existingRequest.requestType,
          headcount: body.headcount ?? existingRequest.headcount,
          employmentType: body.employmentType ?? existingRequest.employmentType,
          justification: body.justification ?? existingRequest.justification,
          responsibilities: body.responsibilities !== undefined ? body.responsibilities : existingRequest.responsibilities,
          requirements: body.requirements !== undefined ? body.requirements : existingRequest.requirements,
          preferredStartDate: body.preferredStartDate !== undefined
            ? (body.preferredStartDate ? new Date(body.preferredStartDate) : null)
            : existingRequest.preferredStartDate,
          location: body.location !== undefined ? body.location : existingRequest.location,
          workModel: body.workModel !== undefined ? body.workModel : existingRequest.workModel,
          salaryMin: body.salaryMin !== undefined ? body.salaryMin : existingRequest.salaryMin,
          salaryMax: body.salaryMax !== undefined ? body.salaryMax : existingRequest.salaryMax,
          hasBudget: body.hasBudget !== undefined ? body.hasBudget : existingRequest.hasBudget,
          priority: body.priority ?? existingRequest.priority
        };
        break;

      case "create_opening":
        // Onaylanan talepten ilan oluştur
        if (!hasFullAccess) {
          return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
        }
        if (existingRequest.status !== "APPROVED") {
          return NextResponse.json({ error: "Sadece onaylanan taleplerden ilan oluşturulabilir" }, { status: 400 });
        }

        // İlan kodu oluştur
        const year = new Date().getFullYear();
        const codePrefix = `JOB-${year}-`;
        const lastOpening = await prisma.jobOpening.findFirst({
          where: { code: { startsWith: codePrefix } },
          orderBy: { code: "desc" }
        });
        let nextNum = 1;
        if (lastOpening) {
          const lastNum = parseInt(lastOpening.code.replace(codePrefix, ""), 10);
          nextNum = lastNum + 1;
        }
        const jobCode = `${codePrefix}${nextNum.toString().padStart(3, "0")}`;

        // İlanı oluştur
        const jobOpening = await prisma.jobOpening.create({
          data: {
            code: jobCode,
            title: existingRequest.title,
            department: existingRequest.department,
            location: existingRequest.location,
            employmentType: existingRequest.employmentType,
            description: existingRequest.justification,
            responsibilities: existingRequest.responsibilities,
            requirements: existingRequest.requirements,
            salaryMin: existingRequest.salaryMin,
            salaryMax: existingRequest.salaryMax,
            headcount: existingRequest.headcount,
            priority: existingRequest.priority,
            status: "DRAFT",
            hiringManagerEmail: existingRequest.requesterEmail,
            hiringManagerName: existingRequest.requesterName,
            createdBy: userEmail,
            createdByName: session.user.name || ""
          }
        });

        // Talebi güncelle
        updateData = {
          status: "IN_PROGRESS" as PersonnelRequestStatus,
          jobOpeningId: jobOpening.id
        };
        break;

      default:
        return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 });
    }

    const updatedRequest = await prisma.personnelRequest.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json(updatedRequest);
  } catch (error) {
    console.error("Talep güncelleme hatası:", error);
    return NextResponse.json(
      { error: "Talep güncellenirken hata oluştu" },
      { status: 500 }
    );
  }
}

// DELETE - Talebi sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const { id } = await params;
    const userEmail = session.user.email || "";
    const userRole = session.user.role;
    const userDepartment = session.user.department || "";

    // Yetki kontrolü
    const fullAccessRoles = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "IT_MANAGER"];
    const hrDepartments = ["insan varliklari", "insan varlıkları", "human resources", "hr"];
    const isHrDepartment = hrDepartments.some(dept => userDepartment.toLowerCase().includes(dept));
    const hasFullAccess = fullAccessRoles.includes(userRole) || isHrDepartment;

    const existingRequest = await prisma.personnelRequest.findUnique({
      where: { id }
    });

    if (!existingRequest) {
      return NextResponse.json({ error: "Talep bulunamadı" }, { status: 404 });
    }

    // Sadece taslak talepler silinebilir
    if (existingRequest.status !== "DRAFT") {
      return NextResponse.json({ error: "Sadece taslak talepler silinebilir" }, { status: 400 });
    }

    // Yetki kontrolü - sadece talep sahibi veya admin silebilir
    if (existingRequest.requesterEmail !== userEmail && !hasFullAccess) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
    }

    await prisma.personnelRequest.delete({
      where: { id }
    });

    return NextResponse.json({ message: "Talep başarıyla silindi" });
  } catch (error) {
    console.error("Talep silme hatası:", error);
    return NextResponse.json(
      { error: "Talep silinirken hata oluştu" },
      { status: 500 }
    );
  }
}
