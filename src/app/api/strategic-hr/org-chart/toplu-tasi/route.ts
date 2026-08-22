import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { logAuditEvent } from "@/lib/audit-log";
import { orgYonetimYetkisi, tasimaKontrol } from "@/lib/org/yonetim";

// POST - Coklu uye tasima. TEK TRANSACTION: bir islem bile gecersizse HICBIRI uygulanmaz.
// Temizlik betigi bu ucu kullanir; ekran arayuzu yok.
export async function POST(req: Request) {
  const { session, error } = await requireSession();
  if (error || !session) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { hasFullAccess } = orgYonetimYetkisi(session);
  if (!hasFullAccess) {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }

  const body = await req.json();
  const islemler = body?.islemler;
  if (!Array.isArray(islemler) || islemler.length === 0) {
    return NextResponse.json({ error: "islemler dizisi zorunludur" }, { status: 400 });
  }
  if (islemler.length > 500) {
    return NextResponse.json({ error: "Tek seferde en fazla 500 işlem gönderilebilir" }, { status: 400 });
  }

  // 1) TUM islemler once dogrulanir — biri bile gecersizse hicbiri uygulanmaz.
  const redler: { sira: number; orgEmployeeId: unknown; kod: string; mesaj: string }[] = [];
  const hedefler = new Set<string>();

  for (let i = 0; i < islemler.length; i++) {
    const { orgEmployeeId, hedefOrgUnitId } = islemler[i] ?? {};
    if (typeof orgEmployeeId !== "string" || typeof hedefOrgUnitId !== "string") {
      redler.push({ sira: i, orgEmployeeId, kod: "EKSIK_ALAN", mesaj: "orgEmployeeId ve hedefOrgUnitId zorunludur" });
      continue;
    }
    // Ayni hedefe iki uye gonderilirse tek tek gecerli gorunur ama birlikte 1:1'i bozar.
    if (hedefler.has(hedefOrgUnitId)) {
      redler.push({ sira: i, orgEmployeeId, kod: "HEDEF_TEKRARI", mesaj: "Aynı hedef kutuya bu partide birden fazla üye gönderilmiş" });
      continue;
    }
    hedefler.add(hedefOrgUnitId);

    const hata = await tasimaKontrol(orgEmployeeId, hedefOrgUnitId);
    if (hata) redler.push({ sira: i, orgEmployeeId, kod: hata.kod, mesaj: hata.mesaj });
  }

  if (redler.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        uygulandi: 0,
        toplam: islemler.length,
        message: `${redler.length} işlem geçersiz — HİÇBİRİ uygulanmadı.`,
        redler,
      },
      { status: 400 },
    );
  }

  // 2) Hepsi gecerli → TEK transaction
  const sonuc = await prisma.$transaction(
    islemler.map((i: { orgEmployeeId: string; hedefOrgUnitId: string }) =>
      prisma.orgEmployee.update({
        where: { id: i.orgEmployeeId },
        data: { orgUnitId: i.hedefOrgUnitId },
        select: { id: true, orgUnitId: true, displayName: true },
      }),
    ),
  );

  await logAuditEvent({
    action: "ORG_TOPLU_TASIMA",
    actorId: session.user.id,
    targetType: "ORG_UNIT",
    targetId: "TOPLU",
    details: { adet: sonuc.length, tasinanlar: sonuc.map((s) => ({ orgEmployeeId: s.id, hedefOrgUnitId: s.orgUnitId, ad: s.displayName })) },
  });

  return NextResponse.json({ ok: true, uygulandi: sonuc.length, toplam: islemler.length, redler: [] });
}
