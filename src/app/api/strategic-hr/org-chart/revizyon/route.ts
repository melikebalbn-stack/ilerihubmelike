import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { logAuditEvent } from "@/lib/audit-log";

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

const CODE_PATTERN = /^ORG-[A-Z0-9-]+$/;

// GET - Revizyon geçmişi (herkese açık — org-chart ana GET'iyle aynı felsefe,
// revizyon kayıtlarında gizlenecek hassas bir alt-küme yok)
export async function GET(request: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code") ?? "ORG-TF";
  if (!CODE_PATTERN.test(code)) {
    return NextResponse.json({ error: "Geçersiz bölüm kodu" }, { status: 400 });
  }

  const kok = await prisma.orgUnit.findUnique({
    where: { code },
    select: { id: true },
  });
  if (!kok) {
    return NextResponse.json({ error: "Bölüm bulunamadı" }, { status: 404 });
  }

  const revizyonlar = await prisma.orgRevizyon.findMany({
    where: { orgUnitId: kok.id },
    orderBy: { revNo: "asc" },
    select: {
      id: true,
      revNo: true,
      tarih: true,
      aciklama: true,
      degisiklikYeri: true,
      yapan: true,
    },
  });

  return NextResponse.json(revizyonlar);
}

// POST - Yeni revizyon ekle (ATOMİK: insert + OrgBolumMeta.revNo güncelleme).
// Guard: hasFullAccess zorunlu — tam blok (yazma).
export async function POST(request: Request) {
  const { session, error } = await requireSession();
  if (error || !session) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { hasFullAccess } = checkAccess(session);
  if (!hasFullAccess) {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }

  const body = await request.json();
  const { code, tarih, aciklama, degisiklikYeri, yapan } = body;

  if (!code || typeof code !== "string" || !CODE_PATTERN.test(code)) {
    return NextResponse.json({ error: "Geçersiz bölüm kodu" }, { status: 400 });
  }
  if (!tarih) {
    return NextResponse.json({ error: "Tarih zorunludur" }, { status: 400 });
  }
  if (!aciklama || typeof aciklama !== "string" || !aciklama.trim()) {
    return NextResponse.json({ error: "Açıklama zorunludur" }, { status: 400 });
  }
  if (!degisiklikYeri || typeof degisiklikYeri !== "string" || !degisiklikYeri.trim()) {
    return NextResponse.json({ error: "Değişiklik yeri zorunludur" }, { status: 400 });
  }
  if (!yapan || typeof yapan !== "string" || !yapan.trim()) {
    return NextResponse.json({ error: "Yapan zorunludur" }, { status: 400 });
  }

  const kok = await prisma.orgUnit.findUnique({
    where: { code },
    include: { bolumMeta: true },
  });
  if (!kok) {
    return NextResponse.json({ error: "Bölüm bulunamadı" }, { status: 404 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // a) Mevcut max revNo (bu bölümün OrgRevizyon kayıtlarından)
      const maxAgg = await tx.orgRevizyon.aggregate({
        where: { orgUnitId: kok.id },
        _max: { revNo: true },
      });

      let yeniRevNo: number;
      if (maxAgg._max.revNo != null) {
        yeniRevNo = maxAgg._max.revNo + 1;
      } else {
        // İlk revizyon: OrgRevizyon boş — OrgBolumMeta.revNo'yu (String, ör. "3") baz al
        const mevcutRevNo = kok.bolumMeta?.revNo ? parseInt(kok.bolumMeta.revNo, 10) : 0;
        yeniRevNo = (Number.isNaN(mevcutRevNo) ? 0 : mevcutRevNo) + 1;
      }

      // b) Revizyon kaydı
      const revizyon = await tx.orgRevizyon.create({
        data: {
          orgUnitId: kok.id,
          revNo: yeniRevNo,
          tarih: new Date(tarih),
          aciklama,
          degisiklikYeri,
          yapan,
          yapanUserId: session.user.id,
        },
      });

      // c) Bölümün güncel Rev No'sunu güncelle (export başlığında görünür)
      if (kok.bolumMeta) {
        await tx.orgBolumMeta.update({
          where: { orgUnitId: kok.id },
          data: { revNo: String(yeniRevNo) },
        });
      }

      return { revizyon, yeniRevNo };
    });

    // Audit — PII yok, yalnız kapsam/hedef özeti
    await logAuditEvent({
      action: "ORG_REVIZYON_EKLENDI",
      actorId: session.user.id,
      targetType: "ORG_UNIT",
      targetId: code,
      details: { revNo: result.yeniRevNo },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("Org revizyon eklenirken hata:", err);
    return NextResponse.json({ error: "Revizyon eklenirken hata oluştu" }, { status: 500 });
  }
}
