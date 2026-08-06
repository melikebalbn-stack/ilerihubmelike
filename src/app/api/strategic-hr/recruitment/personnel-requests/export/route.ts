import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PersonnelRequestStatus } from "@/generated/prisma";
import { requireSession } from "@/lib/auth/require-session";
import * as XLSX from "xlsx";
import { logAuditEvent } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

const requestTypeLabels: Record<string, string> = {
  NEW_POSITION: "Yeni Pozisyon",
  REPLACEMENT: "Yenileme",
  EXPANSION: "Kadro Genişletme",
  TEMPORARY: "Geçici",
  INTERN: "Stajyer",
};
const priorityLabels: Record<string, string> = {
  LOW: "Düşük",
  MEDIUM: "Orta",
  HIGH: "Yüksek",
  URGENT: "Acil",
};
const requestStatusLabels: Record<string, string> = {
  DRAFT: "Taslak",
  PENDING: "Onay Bekliyor",
  APPROVED: "Onaylandı",
  REJECTED: "Reddedildi",
  IN_PROGRESS: "İşlemde",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal",
};

export async function GET(request: NextRequest) {
  try {
    // Guard: /api/strategic-hr/recruitment/personnel-requests GET ile birebir aynı —
    // requireSession + aynı görünürlük kapsaması (admin / departman / kendi).
    const { session, error } = await requireSession();
    if (error) return error;

    const userEmail = (session.user.email || "").toLowerCase();
    const userDepartment = session.user.department || "";

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as PersonnelRequestStatus | null;
    const department = searchParams.get("department");
    const myRequests = searchParams.get("myRequests") === "true";

    const perms = session.user.permissions ?? [];
    const hasFullAccess = perms.includes("recruitment.admin");
    const canViewByDept = perms.includes("recruitment.view");

    const where: any = {};

    if (myRequests) {
      where.requesterEmail = userEmail;
    } else if (!hasFullAccess && canViewByDept) {
      where.OR = [{ department: userDepartment }, { requesterEmail: userEmail }];
    } else if (!hasFullAccess) {
      where.requesterEmail = userEmail;
    }

    if (status) where.status = status;
    if (department && hasFullAccess) where.department = department;

    const requests = await prisma.personnelRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        requestNumber: true,
        title: true,
        department: true,
        requesterName: true,
        requestType: true,
        headcount: true,
        priority: true,
        status: true,
        createdAt: true,
      },
    });

    // Panel tablosundaki sütunlarla birebir
    const data = requests.map((r) => ({
      "Talep No": r.requestNumber,
      Pozisyon: r.title,
      Departman: r.department,
      "Talep Eden": r.requesterName,
      Tip: requestTypeLabels[r.requestType] || r.requestType,
      Kişi: r.headcount,
      Öncelik: priorityLabels[r.priority] || r.priority,
      Durum: requestStatusLabels[r.status] || r.status,
      Tarih: new Date(r.createdAt).toLocaleDateString("tr-TR"),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Personel Talepleri");
    worksheet["!cols"] = [
      { wch: 16 }, { wch: 26 }, { wch: 20 }, { wch: 22 }, { wch: 16 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    ];

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    await logAuditEvent({
      action: "PERSONNEL_REQUEST_EXPORTED",
      actorId: session.user.id,
      targetType: "PERSONNEL_REQUEST",
      details: {
        recordCount: requests.length,
        scope: hasFullAccess ? "all" : canViewByDept ? "department" : "own",
        filters: { status: status || null, department: department || null, myRequests },
      },
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="personel-talepleri_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Personel talepleri export hatası:", error);
    return NextResponse.json({ error: "Excel export sırasında bir hata oluştu" }, { status: 500 });
  }
}
