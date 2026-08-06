import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CandidateSource, Prisma } from "@/generated/prisma";
import { requireSession } from "@/lib/auth/require-session";
import * as XLSX from "xlsx";
import { logAuditEvent } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

// Guard: /api/strategic-hr/recruitment/candidates GET ile birebir aynı recruitAccess.
function recruitAccess(session: { user: { permissions?: string[]; department?: string | null } }) {
  const perms = session.user.permissions ?? [];
  return {
    isAdmin: perms.includes("recruitment.admin"),
    canViewCandidate: perms.includes("recruitment.candidate.view"),
    canViewByDept: perms.includes("recruitment.view"),
    userDepartment: session.user.department || "",
  };
}

const sourceLabels: Record<string, string> = {
  DIRECT: "Direkt Başvuru",
  REFERRAL: "Referans",
  LINKEDIN: "LinkedIn",
  JOB_BOARD: "İş İlanı Sitesi",
  AGENCY: "Ajans",
  CAREER_FAIR: "Kariyer Fuarı",
  INTERNAL: "İç Aday",
  OTHER: "Diğer",
};

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;

    const ctx = recruitAccess(session);
    if (!ctx.isAdmin && !ctx.canViewByDept && !ctx.canViewCandidate) {
      return NextResponse.json({ error: "Bu modüle erişim yetkiniz yok" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const source = searchParams.get("source") as CandidateSource | null;
    const skills = searchParams.get("skills");

    const where: Prisma.CandidateWhereInput = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { currentTitle: { contains: search, mode: "insensitive" } },
        { currentCompany: { contains: search, mode: "insensitive" } },
      ];
    }
    if (source) where.source = source;
    if (skills) where.skills = { hasSome: skills.split(",") };

    // Departman müdürü: kendi departmanı pozisyonlarına başvuran adaylar (liste ile aynı)
    if (!ctx.isAdmin && !ctx.canViewCandidate && ctx.canViewByDept) {
      where.applications = {
        some: {
          jobOpening: { department: { contains: ctx.userDepartment, mode: "insensitive" } },
        },
      };
    }

    const candidates = await prisma.candidate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      // KVKK: yalnız Aday Havuzu tablosunda görünen sütunlar. TC/telefon/özgeçmiş/
      // sağlık/onay gibi hassas alanlar export EDİLMEZ.
      select: {
        firstName: true,
        lastName: true,
        email: true,
        currentTitle: true,
        currentCompany: true,
        yearsOfExperience: true,
        source: true,
        _count: { select: { applications: true } },
      },
    });

    const data = candidates.map((c) => ({
      "Ad Soyad": `${c.firstName} ${c.lastName}`.trim(),
      "E-posta": c.email,
      "Mevcut Pozisyon": c.currentTitle || "-",
      Şirket: c.currentCompany || "-",
      Deneyim: c.yearsOfExperience != null ? `${c.yearsOfExperience} yıl` : "-",
      Kaynak: sourceLabels[c.source] || c.source,
      Başvuru: c._count.applications,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Aday Havuzu");
    worksheet["!cols"] = [
      { wch: 24 }, { wch: 28 }, { wch: 22 }, { wch: 22 }, { wch: 12 }, { wch: 16 }, { wch: 10 },
    ];

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    await logAuditEvent({
      action: "CANDIDATE_EXPORTED",
      actorId: session.user.id,
      targetType: "JOB_CANDIDATE",
      details: {
        recordCount: candidates.length,
        scope: ctx.isAdmin || ctx.canViewCandidate ? "all" : "department",
        filters: { source: source || null, skills: skills || null, search: search ? "<filtered>" : null },
      },
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="aday-havuzu_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Aday havuzu export hatası:", error);
    return NextResponse.json({ error: "Excel export sırasında bir hata oluştu" }, { status: 500 });
  }
}
