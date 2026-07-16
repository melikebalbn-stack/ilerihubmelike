import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import type { RejectionReasonCategory } from "@/generated/prisma";

// Recruitment yetki deseni: admin yönetir, view görebilir.
function recruitAccess(session: { user: { permissions?: string[] } }) {
  const perms = session.user.permissions ?? [];
  return { isAdmin: perms.includes("recruitment.admin"), canView: perms.includes("recruitment.view") };
}

const KATEGORILER = new Set(["TEKLIF_REDDI", "ISE_ALMAMA", "SUREC_KAYBI"]);

// GET — ret nedeni sözlüğü (kategori + ad). ?activeOnly=1 → yalnız aktifler (dropdown için).
export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { isAdmin, canView } = recruitAccess(session);
  if (!isAdmin && !canView) {
    return NextResponse.json({ error: "Bu modüle erişim yetkiniz yok" }, { status: 403 });
  }
  const activeOnly = req.nextUrl.searchParams.get("activeOnly") === "1";
  const reasons = await prisma.rejectionReason.findMany({
    where: activeOnly ? { isActive: true } : {},
    orderBy: [{ category: "asc" }, { order: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(reasons);
}

// POST — yeni ret nedeni (admin).
export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;
  if (!recruitAccess(session).isAdmin) {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }
  const body = await req.json();
  const { category, name, order } = body ?? {};
  if (!category || !KATEGORILER.has(category) || !name?.trim()) {
    return NextResponse.json({ error: "Geçerli kategori ve ad zorunlu" }, { status: 400 });
  }
  const created = await prisma.rejectionReason.create({
    data: {
      category: category as RejectionReasonCategory,
      name: String(name).trim(),
      order: order != null ? Number(order) : 0,
    },
  }).catch((e: unknown) => {
    // @@unique([category, name]) çakışması
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") return null;
    throw e;
  });
  if (!created) {
    return NextResponse.json({ error: "Bu kategoride aynı ad zaten var" }, { status: 409 });
  }
  return NextResponse.json(created, { status: 201 });
}
