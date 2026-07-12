import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";

function recruitAccess(session: { user: { permissions?: string[] } }) {
  const perms = session.user.permissions ?? [];
  return { isAdmin: perms.includes("recruitment.admin"), canView: perms.includes("recruitment.view") };
}

// GET — maliyet kayıtları. ?publicJobApplicationId= ile başvuru bazlı, yoksa tümü.
export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { isAdmin, canView } = recruitAccess(session);
  if (!isAdmin && !canView) return NextResponse.json({ error: "Bu modüle erişim yetkiniz yok" }, { status: 403 });
  const appId = req.nextUrl.searchParams.get("publicJobApplicationId");
  const costs = await prisma.recruitmentCost.findMany({
    where: appId ? { publicJobApplicationId: appId } : {},
    orderBy: { createdAt: "desc" },
    include: { item: { select: { name: true, type: true, unitRate: true } } },
  });
  return NextResponse.json(costs);
}

// POST — maliyet kaydı ekle (admin). Tutar SUNUCUDA hesaplanır ve SNAPSHOT yazılır.
// SAATLIK: amount = quantity × item.unitRate. SABIT: amount = body.amount (miktar=1).
// publicJobApplicationId opsiyonel (null = genel maliyet: ilan/ajans).
export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;
  if (!recruitAccess(session).isAdmin) return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });

  const body = await req.json();
  const { itemId, publicJobApplicationId, quantity, amount, note } = body ?? {};
  if (!itemId) return NextResponse.json({ error: "Maliyet kalemi zorunlu" }, { status: 400 });

  const item = await prisma.recruitmentCostItem.findUnique({
    where: { id: itemId },
    select: { id: true, type: true, unitRate: true, isActive: true },
  });
  if (!item) return NextResponse.json({ error: "Kalem bulunamadı" }, { status: 404 });
  if (!item.isActive) return NextResponse.json({ error: "Kalem pasif" }, { status: 400 });

  // Başvuru bağı verildiyse geçerliliğini doğrula.
  if (publicJobApplicationId) {
    const app = await prisma.publicJobApplication.findUnique({ where: { id: publicJobApplicationId }, select: { id: true } });
    if (!app) return NextResponse.json({ error: "Başvuru bulunamadı" }, { status: 404 });
  }

  // Tutar SNAPSHOT hesabı — client'tan gelen tutara güvenilmez (SAATLIK'te sunucu hesaplar).
  let hesapMiktar = 1;
  let hesapTutar: number;
  if (item.type === "SAATLIK") {
    const saat = Number(quantity);
    if (!saat || saat <= 0) return NextResponse.json({ error: "Saat (miktar) zorunlu" }, { status: 400 });
    hesapMiktar = saat;
    hesapTutar = Math.round(saat * (item.unitRate ?? 0) * 100) / 100;
  } else {
    const tutar = Number(amount);
    if (!tutar || tutar <= 0) return NextResponse.json({ error: "Tutar (TL) zorunlu" }, { status: 400 });
    hesapTutar = Math.round(tutar * 100) / 100;
  }

  const created = await prisma.recruitmentCost.create({
    data: {
      itemId,
      publicJobApplicationId: publicJobApplicationId || null,
      quantity: hesapMiktar,
      amount: hesapTutar,
      note: note ? String(note) : null,
      enteredByEmail: session.user.email ?? null,
    },
    include: { item: { select: { name: true, type: true } } },
  });
  return NextResponse.json(created, { status: 201 });
}
