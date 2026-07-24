import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { logAuditEvent } from "@/lib/audit-log";

// org-chart/route.ts'teki checkAccess private (export edilmemiş) olduğu için
// import edilemiyor — diğer org-chart alt route'larında yapıldığı gibi aynı
// rol listesiyle yerel bir kopya tutuyoruz.
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

// POST - Boş kadroya vekil ata / kaldır. Yalnız OrgUnit güncellenir; Personnel'e
// SADECE OKUMA (personnelId doğrulama) — yazma/ilişki kurma yok.
export async function POST(req: Request) {
  const { session, error } = await requireSession();
  if (error || !session) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { hasFullAccess } = checkAccess(session);
  if (!hasFullAccess) {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }

  const body = await req.json();
  const { orgUnitId, personnelId, vekilAdi, kaldir } = body;

  if (!orgUnitId || typeof orgUnitId !== "string") {
    return NextResponse.json({ error: "orgUnitId zorunludur" }, { status: 400 });
  }

  const unit = await prisma.orgUnit.findUnique({
    where: { id: orgUnitId },
    select: { id: true, unitType: true },
  });
  if (!unit) {
    return NextResponse.json({ error: "Birim bulunamadı" }, { status: 404 });
  }

  if (unit.unitType !== "POSITION") {
    return NextResponse.json({ error: "Yalnız pozisyona vekil atanabilir" }, { status: 400 });
  }

  const doluKoltukSayisi = await prisma.orgEmployee.count({
    where: { orgUnitId, isActive: true },
  });
  if (doluKoltukSayisi !== 0) {
    return NextResponse.json(
      { error: "Dolu kadroya vekil atanamaz — kadro boş olmalı" },
      { status: 400 }
    );
  }

  // ── Kaldırma ──────────────────────────────────────────────────────────────
  if (kaldir === true) {
    const updated = await prisma.orgUnit.update({
      where: { id: orgUnitId },
      data: { vekaletDurumu: false, vekilAdi: null, vekilPersonnelId: null },
      select: { id: true, vekaletDurumu: true, vekilAdi: true },
    });

    await logAuditEvent({
      action: "ORG_VEKIL_KALDIRMA",
      actorId: session.user.id,
      targetType: "ORG_UNIT",
      targetId: orgUnitId,
      details: {},
    });

    return NextResponse.json(updated);
  }

  // ── Atama ─────────────────────────────────────────────────────────────────
  if (!personnelId || typeof personnelId !== "string") {
    return NextResponse.json({ error: "personnelId zorunludur" }, { status: 400 });
  }
  if (!vekilAdi || typeof vekilAdi !== "string" || !vekilAdi.trim()) {
    return NextResponse.json({ error: "vekilAdi zorunludur" }, { status: 400 });
  }

  // Personnel'e SADECE OKUMA — doğrulama amaçlı, yazma/ilişki kurma yok
  const personel = await prisma.personnel.findUnique({
    where: { id: personnelId },
    select: { id: true, aktif: true },
  });
  if (!personel || !personel.aktif) {
    return NextResponse.json({ error: "Geçersiz veya pasif personel" }, { status: 400 });
  }

  const updated = await prisma.orgUnit.update({
    where: { id: orgUnitId },
    data: { vekaletDurumu: true, vekilAdi, vekilPersonnelId: personnelId },
    select: { id: true, vekaletDurumu: true, vekilAdi: true },
  });

  await logAuditEvent({
    action: "ORG_VEKIL_ATAMA",
    actorId: session.user.id,
    targetType: "ORG_UNIT",
    targetId: orgUnitId,
    details: { vekilAdi },
  });

  return NextResponse.json(updated);
}
