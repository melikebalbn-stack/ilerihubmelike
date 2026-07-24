import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { logAuditEvent } from "@/lib/audit-log";

// org-chart/route.ts'teki checkAccess private (export edilmemiş) olduğu için
// import edilemiyor — diğer org-chart alt route'larında (vekil-ata, personel-listesi)
// yapıldığı gibi aynı rol listesiyle yerel bir kopya tutuyoruz.
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

// POST - Boş kadroya üye ata / çıkar. vekil-ata/route.ts ile birebir aynı iskelet
// (guard, doğrulama sırası, audit) — farkı: OrgUnit değil OrgEmployee create/delete.
// Personnel'e SADECE OKUMA (personnelId doğrulama) — yazma/ilişki kurma yok.
export async function POST(req: Request) {
  const { session, error } = await requireSession();
  if (error || !session) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { hasFullAccess } = checkAccess(session);
  if (!hasFullAccess) {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }

  const body = await req.json();
  const { orgUnitId, personnelId, displayName, orgEmployeeId, kaldir } = body;

  if (!orgUnitId || typeof orgUnitId !== "string") {
    return NextResponse.json({ error: "orgUnitId zorunludur" }, { status: 400 });
  }

  const unit = await prisma.orgUnit.findUnique({
    where: { id: orgUnitId },
    select: { id: true, unitType: true, vekaletDurumu: true },
  });
  if (!unit) {
    return NextResponse.json({ error: "Birim bulunamadı" }, { status: 404 });
  }

  if (unit.unitType !== "POSITION") {
    return NextResponse.json({ error: "Yalnız pozisyona üye atanabilir" }, { status: 400 });
  }

  // ── Çıkarma ───────────────────────────────────────────────────────────────
  if (kaldir === true) {
    if (!orgEmployeeId || typeof orgEmployeeId !== "string") {
      return NextResponse.json({ error: "orgEmployeeId zorunludur" }, { status: 400 });
    }

    const orgEmployee = await prisma.orgEmployee.findUnique({
      where: { id: orgEmployeeId },
      select: { id: true, orgUnitId: true, displayName: true },
    });
    if (!orgEmployee || orgEmployee.orgUnitId !== orgUnitId) {
      return NextResponse.json({ error: "Kayıt bu kutuya ait değil" }, { status: 400 });
    }

    await prisma.orgEmployee.delete({ where: { id: orgEmployeeId } });

    await logAuditEvent({
      action: "ORG_UYE_CIKARMA",
      actorId: session.user.id,
      targetType: "ORG_UNIT",
      targetId: orgUnitId,
      details: { displayName: orgEmployee.displayName },
    });

    return NextResponse.json({ orgUnitId, orgEmployeeId });
  }

  // ── Atama ─────────────────────────────────────────────────────────────────
  const doluKoltukSayisi = await prisma.orgEmployee.count({
    where: { orgUnitId, isActive: true },
  });
  if (doluKoltukSayisi !== 0) {
    return NextResponse.json(
      { error: "Dolu kadroya üye atanamaz — kadro boş olmalı" },
      { status: 400 }
    );
  }

  if (unit.vekaletDurumu === true) {
    return NextResponse.json(
      { error: "Vekaletli kadroya üye atanamaz — önce vekaleti kaldırın" },
      { status: 400 }
    );
  }

  if (!personnelId || typeof personnelId !== "string") {
    return NextResponse.json({ error: "personnelId zorunludur" }, { status: 400 });
  }
  if (!displayName || typeof displayName !== "string" || !displayName.trim()) {
    return NextResponse.json({ error: "displayName zorunludur" }, { status: 400 });
  }

  // Personnel'e SADECE OKUMA — doğrulama amaçlı, yazma/ilişki kurma yok
  const personel = await prisma.personnel.findUnique({
    where: { id: personnelId },
    select: { id: true, aktif: true },
  });
  if (!personel || !personel.aktif) {
    return NextResponse.json({ error: "Geçersiz veya pasif personel" }, { status: 400 });
  }

  const created = await prisma.orgEmployee.create({
    data: {
      orgUnitId,
      displayName,
      personnelId,
      employmentStatus: "ACTIVE",
    },
    select: { id: true, displayName: true },
  });

  await logAuditEvent({
    action: "ORG_UYE_ATAMA",
    actorId: session.user.id,
    targetType: "ORG_UNIT",
    targetId: orgUnitId,
    details: { displayName },
  });

  return NextResponse.json({ orgUnitId, orgEmployeeId: created.id });
}
