import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";

// org-chart/route.ts'teki checkAccess private (export edilmemiş) olduğu için
// import edilemiyor — employees/route.ts ve export/route.ts'te yapıldığı gibi
// aynı rol listesiyle yerel bir kopya tutuyoruz.
function checkAccess(session: any) {
  const userRole = session?.user?.role;
  const userDepartment = session?.user?.department || "";

  const fullAccessRoles = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "IT_MANAGER"];
  const hrDepartments = ["insan varliklari", "insan varlıkları", "human resources", "hr"];
  const isHrDepartment = hrDepartments.some((dept) => userDepartment.toLowerCase().includes(dept));

  return {
    hasFullAccess: fullAccessRoles.includes(userRole) || isHrDepartment,
  };
}

// GET - Vekil seçimi için aktif personel listesi (salt okuma, arama destekli).
// Bölüm filtresi YOK (Karar C — sonraki adımda eklenecek), şimdilik tüm aktif + arama.
export async function GET(req: Request) {
  const { session, error } = await requireSession();
  if (error || !session) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { hasFullAccess } = checkAccess(session);
  if (!hasFullAccess) {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";

  const where = {
    aktif: true,
    ...(q ? { adSoyad: { contains: q, mode: "insensitive" as const } } : {}),
  };

  const [personel, toplam] = await Promise.all([
    prisma.personnel.findMany({
      where,
      select: {
        id: true,
        adSoyad: true,
        bolum: true,
        bolumDetay: true,
        gorev: true,
        sicilNo: true,
      },
      orderBy: { adSoyad: "asc" },
      take: 50,
    }),
    prisma.personnel.count({ where }),
  ]);

  return NextResponse.json({ personel, toplam });
}
