import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PerformanceCycleStatus } from "@/generated/prisma";
import { requireSession } from "@/lib/auth/require-session";
import * as XLSX from "xlsx";
import { logAuditEvent } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

// Guard: /api/strategic-hr/performance GET ile birebir aynı checkAccess.
function checkAccess(session: any) {
  const userRole = session?.user?.role;
  const userDepartment = session?.user?.department || "";

  const fullAccessRoles = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "IT_MANAGER"];
  const hrDepartments = ["insan varliklari", "insan varlıkları", "human resources", "hr"];
  const isHrDepartment = hrDepartments.some((dept) => userDepartment.toLowerCase().includes(dept));

  return {
    hasFullAccess: fullAccessRoles.includes(userRole) || isHrDepartment,
    isDeptHead: userRole === "DEPT_HEAD",
  };
}

const cycleTypeLabels: Record<string, string> = {
  ANNUAL: "Yıllık",
  SEMI_ANNUAL: "6 Aylık",
  QUARTERLY: "3 Aylık",
};
const cycleStatusLabels: Record<string, string> = {
  DRAFT: "Taslak",
  GOAL_SETTING: "Hedef Belirleme",
  IN_PROGRESS: "Devam Ediyor",
  MID_YEAR: "Ara Değerlendirme",
  YEAR_END: "Yıl Sonu",
  CALIBRATION: "Kalibrasyon",
  COMPLETED: "Tamamlandı",
  ARCHIVED: "Arşivlendi",
};

function fmt(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("tr-TR");
}

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;

    const { hasFullAccess, isDeptHead } = checkAccess(session);
    if (!hasFullAccess && !isDeptHead) {
      return NextResponse.json({ error: "Bu modüle erişim yetkiniz yok" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const status = searchParams.get("status") as PerformanceCycleStatus | null;
    const isActive = searchParams.get("isActive");

    const where: any = {};
    if (year) where.year = parseInt(year);
    if (status) where.status = status;
    if (isActive === "true" || isActive === "false") where.isActive = isActive === "true";

    const cycles = await prisma.performanceCycle.findMany({
      where,
      orderBy: [{ year: "desc" }, { startDate: "desc" }],
      include: { _count: { select: { reviews: true } } },
    });

    // Ekrandaki "Döngüler" tablosuyla birebir sütunlar
    const data = cycles.map((c) => ({
      "Döngü Adı": c.name,
      Yıl: c.year,
      Tip: cycleTypeLabels[c.cycleType] || c.cycleType,
      Dönem: `${fmt(c.startDate)} - ${fmt(c.endDate)}`,
      Durum: cycleStatusLabels[c.status] || c.status,
      "Değerlendirme Sayısı": c._count.reviews,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Performans Donguleri");
    worksheet["!cols"] = [{ wch: 32 }, { wch: 8 }, { wch: 12 }, { wch: 24 }, { wch: 18 }, { wch: 20 }];

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    await logAuditEvent({
      action: "PERFORMANCE_EXPORTED",
      actorId: session.user.id,
      targetType: "PERFORMANCE_REVIEW",
      details: {
        scope: "performance-cycles",
        recordCount: cycles.length,
        filters: { year: year || null, status: status || null, isActive: isActive || null },
      },
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="performans-donguleri_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Performans export hatası:", error);
    return NextResponse.json({ error: "Excel export sırasında bir hata oluştu" }, { status: 500 });
  }
}
