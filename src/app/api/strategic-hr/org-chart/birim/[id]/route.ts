import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { logAuditEvent } from "@/lib/audit-log";
import { orgYonetimYetkisi, parentDongusuVarMi } from "@/lib/org/yonetim";

const GECERLI_TIPLER = ["DEPARTMENT", "POSITION", "GROUP"];

/** Bir birimin ve altindaki tum agacin level degerini yeniden hesaplar. */
async function seviyeleriTazele(kokId: string, kokLevel: number) {
  let katman = [{ id: kokId, level: kokLevel }];
  for (let d = 0; d < 100 && katman.length > 0; d++) {
    const cocuklar = await prisma.orgUnit.findMany({
      where: { parentId: { in: katman.map((k) => k.id) } },
      select: { id: true, parentId: true },
    });
    if (cocuklar.length === 0) break;
    const levelByParent = new Map(katman.map((k) => [k.id, k.level]));
    const sonraki: { id: string; level: number }[] = [];
    for (const c of cocuklar) {
      const yeni = (levelByParent.get(c.parentId as string) ?? 0) + 1;
      await prisma.orgUnit.update({ where: { id: c.id }, data: { level: yeni } });
      sonraki.push({ id: c.id, level: yeni });
    }
    katman = sonraki;
  }
}

// PATCH - Birim duzenle: parentId (tasima), name, unitType, approvedHeadcount.
// parentId icin DONGU KORUMASI zorunlu; parentId=null serbest (kok yapar).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession();
  if (error || !session) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { hasFullAccess } = orgYonetimYetkisi(session);
  if (!hasFullAccess) return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  const birim = await prisma.orgUnit.findUnique({
    where: { id },
    select: { id: true, code: true, name: true, unitType: true, parentId: true, level: true },
  });
  if (!birim) return NextResponse.json({ error: "Birim bulunamadı" }, { status: 404 });

  const data: Record<string, unknown> = {};
  const degisiklikler: Record<string, { once: unknown; sonra: unknown }> = {};

  if (Object.prototype.hasOwnProperty.call(body, "parentId")) {
    const yeniParent = body.parentId === null || body.parentId === "" ? null : body.parentId;
    if (yeniParent !== null && typeof yeniParent !== "string") {
      return NextResponse.json({ error: "parentId geçersiz" }, { status: 400 });
    }
    if (yeniParent === id) {
      return NextResponse.json({ error: "Bir birim kendi altına taşınamaz" }, { status: 400 });
    }
    if (yeniParent !== birim.parentId) {
      if (yeniParent) {
        const hedef = await prisma.orgUnit.findUnique({ where: { id: yeniParent }, select: { id: true, level: true, name: true } });
        if (!hedef) return NextResponse.json({ error: "Hedef üst birim bulunamadı" }, { status: 404 });
        if (await parentDongusuVarMi(id, yeniParent)) {
          return NextResponse.json(
            { error: `Döngü oluşur: "${birim.name}" kendi alt ağacındaki "${hedef.name}" altına taşınamaz`, kod: "DONGU" },
            { status: 400 },
          );
        }
        data.level = hedef.level + 1;
      } else {
        data.level = 0;
      }
      data.parentId = yeniParent;
      degisiklikler.parentId = { once: birim.parentId, sonra: yeniParent };
    }
  }

  if (typeof body.name === "string" && body.name.trim() && body.name.trim() !== birim.name) {
    data.name = body.name.trim();
    degisiklikler.name = { once: birim.name, sonra: body.name.trim() };
  }
  if (typeof body.unitType === "string" && body.unitType !== birim.unitType) {
    if (!GECERLI_TIPLER.includes(body.unitType)) {
      return NextResponse.json({ error: `unitType şunlardan biri olmalı: ${GECERLI_TIPLER.join(", ")}` }, { status: 400 });
    }
    data.unitType = body.unitType;
    degisiklikler.unitType = { once: birim.unitType, sonra: body.unitType };
  }
  if (typeof body.approvedHeadcount === "number") data.approvedHeadcount = body.approvedHeadcount;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: true, message: "Değişiklik yok", birim });
  }

  const guncel = await prisma.orgUnit.update({
    where: { id },
    data: data as never,
    select: { id: true, code: true, name: true, unitType: true, parentId: true, level: true },
  });

  // parent degistiyse alt agacin level'lari kayar — tazele.
  if (degisiklikler.parentId) await seviyeleriTazele(guncel.id, guncel.level);

  await logAuditEvent({
    action: degisiklikler.parentId ? "ORG_BIRIM_PARENT_DEGISTI" : "ORG_BIRIM_GUNCELLE",
    actorId: session.user.id,
    targetType: "ORG_UNIT",
    targetId: guncel.code,
    details: { name: guncel.name, degisiklikler },
  });

  return NextResponse.json({ ok: true, birim: guncel, degisiklikler });
}

// DELETE - Birim siler. IKI SERT KURAL:
//  1) Koltugu olan kutu SILINEMEZ (OrgEmployee→OrgUnit FK RESTRICT; aktif/pasif AYRIMI YOK).
//  2) Alt birimi olan kutu SILINEMEZ — OrgUnit.parentId SET NULL oldugu icin
//     tepeden silme cocuklari KOK yapar ve dagitir. Once cocuklar tasinmali.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession();
  if (error || !session) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { hasFullAccess } = orgYonetimYetkisi(session);
  if (!hasFullAccess) return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });

  const { id } = await params;
  const birim = await prisma.orgUnit.findUnique({
    where: { id },
    select: { id: true, code: true, name: true, unitType: true },
  });
  if (!birim) return NextResponse.json({ error: "Birim bulunamadı" }, { status: 404 });

  const [koltuk, cocuk] = await Promise.all([
    prisma.orgEmployee.count({ where: { orgUnitId: id } }),
    prisma.orgUnit.count({ where: { parentId: id } }),
  ]);

  if (koltuk > 0) {
    return NextResponse.json(
      { error: `"${birim.name}" silinemez: ${koltuk} üye kaydı bağlı. Önce üyeleri taşıyın.`, kod: "KOLTUK_VAR", koltuk },
      { status: 400 },
    );
  }
  if (cocuk > 0) {
    return NextResponse.json(
      { error: `"${birim.name}" silinemez: ${cocuk} alt birimi var. Önce alt birimleri taşıyın (silinirse kök olurlar).`, kod: "ALT_BIRIM_VAR", cocuk },
      { status: 400 },
    );
  }

  await prisma.orgUnit.delete({ where: { id } });

  await logAuditEvent({
    action: "ORG_BIRIM_SIL",
    actorId: session.user.id,
    targetType: "ORG_UNIT",
    targetId: birim.code,
    details: { name: birim.name, unitType: birim.unitType },
  });

  return NextResponse.json({ ok: true, silinen: birim });
}
