import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SuccessionStatus, SuccessionPriority } from "@/generated/prisma";
import { requireSession } from "@/lib/auth/require-session";
import * as XLSX from "xlsx";
import { logAuditEvent } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

// Guard: /api/strategic-hr/succession-plans GET ile birebir aynı checkAccess.
function checkAccess(session: any) {
  const userRole = session?.user?.role;
  const userDepartment = session?.user?.department || "";

  const fullAccessRoles = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "IT_MANAGER"];
  const hrDepartments = ["insan varliklari", "insan varlıkları", "human resources", "hr"];
  const isHrDepartment = hrDepartments.some((dept) => userDepartment.toLowerCase().includes(dept));

  return {
    hasFullAccess: fullAccessRoles.includes(userRole) || isHrDepartment,
    isDeptHead: userRole === "DEPT_HEAD",
    userDepartment,
  };
}

const statusLabels: Record<string, string> = {
  DRAFT: "Taslak",
  ACTIVE: "Aktif",
  COMPLETED: "Tamamlandı",
};
const priorityLabels: Record<string, string> = {
  LOW: "Düşük",
  MEDIUM: "Orta",
  HIGH: "Yüksek",
  CRITICAL: "Kritik",
};
const vacancyRiskLabels: Record<string, string> = {
  LOW: "Düşük",
  MEDIUM: "Orta",
  HIGH: "Yüksek",
  IMMINENT: "Yakın",
};

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;

    const { hasFullAccess, isDeptHead, userDepartment } = checkAccess(session);
    if (!hasFullAccess && !isDeptHead) {
      return NextResponse.json({ error: "Bu modüle erişim yetkiniz yok" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as SuccessionStatus | null;
    const priority = searchParams.get("priority") as SuccessionPriority | null;
    const positionId = searchParams.get("positionId");

    const where: any = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (positionId) where.positionId = positionId;

    // Departman müdürü: yalnız kendi departmanı (liste route ile aynı scoping)
    if (!hasFullAccess && isDeptHead) {
      where.position = { department: { contains: userDepartment, mode: "insensitive" } };
    }

    const plans = await prisma.successionPlan.findMany({
      where,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      include: {
        position: { select: { title: true, department: true } },
        candidates: {
          select: {
            readyNowProfile: { select: { id: true } },
            readyIn1YearProfile: { select: { id: true } },
            readyIn2YearsProfile: { select: { id: true } },
          },
        },
      },
    });

    const data = plans.map((p) => {
      const adaySayisi = p.candidates.filter(
        (c) => c.readyNowProfile || c.readyIn1YearProfile || c.readyIn2YearsProfile
      ).length;
      const hazirAday = p.candidates.filter((c) => c.readyNowProfile).length;
      return {
        Pozisyon: p.position?.title || "",
        Departman: p.position?.department || "",
        "Mevcut Çalışan": p.currentHolderName || "",
        Öncelik: priorityLabels[p.priority] || p.priority,
        "Boşalma Riski": vacancyRiskLabels[p.vacancyRisk] || p.vacancyRisk,
        Durum: statusLabels[p.status] || p.status,
        "Aday Sayısı": adaySayisi,
        "Hazır Aday": hazirAday,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Yedekleme Planlari");
    worksheet["!cols"] = [
      { wch: 28 }, { wch: 20 }, { wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
    ];

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    await logAuditEvent({
      action: "SUCCESSION_PLAN_EXPORTED",
      actorId: session.user.id,
      targetType: "SUCCESSION_PLAN",
      details: {
        recordCount: plans.length,
        filters: { status: status || null, priority: priority || null, positionId: positionId || null },
      },
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="yedekleme-planlari_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Yedekleme planları export hatası:", error);
    return NextResponse.json({ error: "Excel export sırasında bir hata oluştu" }, { status: 500 });
  }
}
