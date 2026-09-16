import { NextResponse } from "next/server";
import { ifsKuyrugaEkle } from "@/lib/ifs/personel-sync/kuyruk";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { logAuditEvent } from "@/lib/audit-log";
import { orgYonetimYetkisi } from "@/lib/org/yonetim";

const GECERLI_TIPLER = ["DEPARTMENT", "POSITION", "GROUP"] as const;

// POST - Yeni birim ekler. pozisyon-ekle yalniz POSITION uretebiliyordu;
// bu uc DEPARTMENT ve GROUP da acabiliyor. Kod verilmezse ust birimin kodundan turetilir.
export async function POST(req: Request) {
  const { session, error } = await requireSession();
  if (error || !session) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { hasFullAccess } = orgYonetimYetkisi(session);
  if (!hasFullAccess) return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });

  const body = await req.json();
  const { name, unitType, parentId, code, approvedHeadcount } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name zorunludur" }, { status: 400 });
  }
  if (!GECERLI_TIPLER.includes(unitType)) {
    return NextResponse.json(
      { error: `unitType şunlardan biri olmalı: ${GECERLI_TIPLER.join(", ")}` },
      { status: 400 },
    );
  }

  let level = 0;
  let parent: { id: string; code: string; level: number } | null = null;
  if (parentId) {
    if (typeof parentId !== "string") return NextResponse.json({ error: "parentId geçersiz" }, { status: 400 });
    parent = await prisma.orgUnit.findUnique({ where: { id: parentId }, select: { id: true, code: true, level: true } });
    if (!parent) return NextResponse.json({ error: "Üst birim bulunamadı" }, { status: 404 });
    level = parent.level + 1;
  }

  // Kod: verildiyse benzersizlik kontrolu, verilmediyse ust koddan otomatik.
  let yeniKod = typeof code === "string" && code.trim() ? code.trim() : "";
  if (yeniKod) {
    const cakisma = await prisma.orgUnit.findUnique({ where: { code: yeniKod }, select: { id: true } });
    if (cakisma) return NextResponse.json({ error: `"${yeniKod}" kodu zaten kullanılıyor` }, { status: 400 });
  } else {
    const on = parent ? parent.code : "ORG";
    const kardesler = await prisma.orgUnit.findMany({
      where: { code: { startsWith: `${on}-` } },
      select: { code: true },
    });
    const no = kardesler.length + 1;
    yeniKod = `${on}-N${String(no).padStart(3, "0")}`;
    let sayac = no;
    while (await prisma.orgUnit.findUnique({ where: { code: yeniKod }, select: { id: true } })) {
      sayac += 1;
      yeniKod = `${on}-N${String(sayac).padStart(3, "0")}`;
    }
  }

  const sonKardes = await prisma.orgUnit.findFirst({
    where: { parentId: parentId ?? null },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const created = await prisma.orgUnit.create({
    data: {
      code: yeniKod,
      name: name.trim(),
      unitType,
      parentId: parentId ?? null,
      level,
      sortOrder: (sonKardes?.sortOrder ?? -1) + 1,
      approvedHeadcount: typeof approvedHeadcount === "number" ? approvedHeadcount : unitType === "POSITION" ? 1 : null,
    },
    select: { id: true, code: true, name: true, unitType: true, parentId: true, level: true },
  });

  await logAuditEvent({
    action: "ORG_BIRIM_EKLE",
    actorId: session.user.id,
    targetType: "ORG_UNIT",
    targetId: created.code,
    details: { name: created.name, unitType: created.unitType, parentId: created.parentId },
  });

  await ifsKuyrugaEkle(prisma, [{ varlikTipi: created.unitType === "POSITION" ? "POZISYON" : "ORG", hubId: created.id }], "HOOK:org-birim-ekle");

  return NextResponse.json({ ok: true, birim: created });
}
