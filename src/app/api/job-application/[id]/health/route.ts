import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/require-user";
import { canViewJobAppSensitive } from "@/lib/job-application/hr-access";
import { buildHealthSummary } from "@/lib/job-application/health-summary";

export const dynamic = "force-dynamic";

// GET /api/job-application/[id]/health — İK: sağlık beyanı (özel nitelikli).
// Rol-gate (VIEW_ROLES) + her başarılı görüntüleme accessLog'a yazılır.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, error } = await requireUser();
    if (error) return error;
    if (!canViewJobAppSensitive(user.role)) {
      return NextResponse.json({ error: "Yetkisiz işlem" }, { status: 403 });
    }

    const health = await prisma.jobApplicationHealth.findUnique({
      where: { applicationId: id },
      include: { items: { orderBy: { itemNo: "asc" } } },
    });

    // Eski başvuru (akış öncesi): kayıt yok → not için null döndür (log yazma).
    if (!health) {
      return NextResponse.json({ health: null });
    }

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;
    await prisma.jobApplicationAccessLog.create({
      data: { applicationId: id, accessedBy: user.id, accessType: "VIEW_HEALTH", ipAddress },
    });

    return NextResponse.json({
      health,
      summary: buildHealthSummary(health, health.items),
    });
  } catch (err) {
    console.error("[job-application/[id]/health] hata:", err);
    return NextResponse.json({ error: "Sunucu hatası oluştu" }, { status: 500 });
  }
}
