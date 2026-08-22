import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { logAuditEvent } from "@/lib/audit-log";
import { orgYonetimYetkisi, tasimaKontrol } from "@/lib/org/yonetim";

// POST - Bir üyeyi (OrgEmployee) baska bir pozisyona TASIR.
// Kayit SILINMEZ; yalniz orgUnitId degisir → OrgEmployee.id ayni kalir, gecmis korunur.
// Guard/dogrulama/audit iskeleti uye-ata ile birebir ayni.
export async function POST(req: Request) {
  const { session, error } = await requireSession();
  if (error || !session) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { hasFullAccess } = orgYonetimYetkisi(session);
  if (!hasFullAccess) {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }

  const body = await req.json();
  const { orgEmployeeId, hedefOrgUnitId } = body;

  if (!orgEmployeeId || typeof orgEmployeeId !== "string") {
    return NextResponse.json({ error: "orgEmployeeId zorunludur" }, { status: 400 });
  }
  if (!hedefOrgUnitId || typeof hedefOrgUnitId !== "string") {
    return NextResponse.json({ error: "hedefOrgUnitId zorunludur" }, { status: 400 });
  }

  const hata = await tasimaKontrol(orgEmployeeId, hedefOrgUnitId);
  if (hata) return NextResponse.json({ error: hata.mesaj, kod: hata.kod }, { status: 400 });

  const oncesi = await prisma.orgEmployee.findUnique({
    where: { id: orgEmployeeId },
    select: { id: true, displayName: true, orgUnitId: true, orgUnit: { select: { name: true, code: true } } },
  });

  const guncel = await prisma.orgEmployee.update({
    where: { id: orgEmployeeId },
    data: { orgUnitId: hedefOrgUnitId },
    select: { id: true, displayName: true, orgUnitId: true, orgUnit: { select: { name: true, code: true } } },
  });

  await logAuditEvent({
    action: "ORG_UYE_TASIMA",
    actorId: session.user.id,
    targetType: "ORG_UNIT",
    targetId: hedefOrgUnitId,
    details: {
      displayName: guncel.displayName,
      orgEmployeeId,
      kaynak: `${oncesi?.orgUnit?.code ?? ""} ${oncesi?.orgUnit?.name ?? ""}`.trim(),
      kaynakOrgUnitId: oncesi?.orgUnitId,
      hedef: `${guncel.orgUnit?.code ?? ""} ${guncel.orgUnit?.name ?? ""}`.trim(),
    },
  });

  return NextResponse.json({
    ok: true,
    orgEmployeeId: guncel.id,
    kaynakOrgUnitId: oncesi?.orgUnitId,
    hedefOrgUnitId: guncel.orgUnitId,
  });
}
