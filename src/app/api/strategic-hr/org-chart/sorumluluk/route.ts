import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { logAuditEvent } from "@/lib/audit-log";

// org-chart/route.ts'teki checkAccess private (export edilmemiş) olduğu için
// import edilemiyor — diğer org-chart alt route'larında (vekil-ata, uye-ata,
// personel-listesi) yapıldığı gibi aynı rol listesiyle yerel bir kopya tutuyoruz.
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

// POST - Sorumlu tablosu satırı ekle / çıkar. vekil-ata/uye-ata ile birebir aynı
// iskelet (guard, doğrulama sırası, audit). İsimler serbest metin (String) olarak
// yazılır — OrgSorumluluk'ta personnelId alanı yok, mevcut model bu şekilde.
export async function POST(req: Request) {
  const { session, error } = await requireSession();
  if (error || !session) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { hasFullAccess } = checkAccess(session);
  if (!hasFullAccess) {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }

  const body = await req.json();
  const { orgUnitCode, birinciSorumlu, yedekSorumlu, sorumlulukId, kaldir } = body;

  // ── Çıkarma ───────────────────────────────────────────────────────────────
  if (kaldir === true) {
    if (!sorumlulukId || typeof sorumlulukId !== "string") {
      return NextResponse.json({ error: "sorumlulukId zorunludur" }, { status: 400 });
    }

    const kayit = await prisma.orgSorumluluk.findUnique({
      where: { id: sorumlulukId },
      select: { id: true, orgUnitId: true },
    });
    if (!kayit) {
      return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 });
    }

    await prisma.orgSorumluluk.delete({ where: { id: sorumlulukId } });

    await logAuditEvent({
      action: "ORG_SORUMLULUK_CIKAR",
      actorId: session.user.id,
      targetType: "ORG_UNIT",
      targetId: kayit.orgUnitId,
      details: {},
    });

    return NextResponse.json({ sorumlulukId });
  }

  // ── Ekleme ────────────────────────────────────────────────────────────────
  if (!orgUnitCode || typeof orgUnitCode !== "string") {
    return NextResponse.json({ error: "orgUnitCode zorunludur" }, { status: 400 });
  }
  if (!birinciSorumlu || typeof birinciSorumlu !== "string" || !birinciSorumlu.trim()) {
    return NextResponse.json({ error: "birinciSorumlu zorunludur" }, { status: 400 });
  }
  if (yedekSorumlu != null && typeof yedekSorumlu !== "string") {
    return NextResponse.json({ error: "yedekSorumlu geçersiz" }, { status: 400 });
  }

  const orgUnit = await prisma.orgUnit.findUnique({
    where: { code: orgUnitCode },
    select: { id: true, unitType: true },
  });
  if (!orgUnit) {
    return NextResponse.json({ error: "Birim bulunamadı" }, { status: 404 });
  }
  if (orgUnit.unitType !== "DEPARTMENT") {
    return NextResponse.json(
      { error: "Sorumlu tablosu yalnız departman köküne eklenebilir" },
      { status: 400 }
    );
  }

  const sonKayit = await prisma.orgSorumluluk.findFirst({
    where: { orgUnitId: orgUnit.id },
    orderBy: { sira: "desc" },
    select: { sira: true },
  });
  const yeniSira = (sonKayit?.sira ?? 0) + 1;

  const created = await prisma.orgSorumluluk.create({
    data: {
      orgUnitId: orgUnit.id,
      sira: yeniSira,
      birinciSorumlu: birinciSorumlu.trim(),
      yedekSorumlu: yedekSorumlu?.trim() || null,
    },
  });

  await logAuditEvent({
    action: "ORG_SORUMLULUK_EKLE",
    actorId: session.user.id,
    targetType: "ORG_UNIT",
    targetId: orgUnit.id,
    details: { sira: yeniSira, birinciSorumlu: created.birinciSorumlu },
  });

  const guncelListe = await prisma.orgSorumluluk.findMany({
    where: { orgUnitId: orgUnit.id },
    orderBy: { sira: "asc" },
    select: { id: true, sira: true, birinciSorumlu: true, yedekSorumlu: true },
  });

  return NextResponse.json({ eklenen: created, liste: guncelListe });
}
