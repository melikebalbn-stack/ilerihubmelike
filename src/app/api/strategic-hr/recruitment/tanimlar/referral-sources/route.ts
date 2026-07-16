import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";

function recruitAccess(session: { user: { permissions?: string[] } }) {
  const perms = session.user.permissions ?? [];
  return { isAdmin: perms.includes("recruitment.admin"), canView: perms.includes("recruitment.view") };
}

// GET — kaynak sözlüğü. ?activeOnly=1 → public form/dropdown için yalnız aktifler.
export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { isAdmin, canView } = recruitAccess(session);
  if (!isAdmin && !canView) return NextResponse.json({ error: "Bu modüle erişim yetkiniz yok" }, { status: 403 });
  const activeOnly = req.nextUrl.searchParams.get("activeOnly") === "1";
  const items = await prisma.referralSourceDef.findMany({
    where: activeOnly ? { isActive: true } : {},
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(items);
}

// POST — yeni kaynak (admin).
export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;
  if (!recruitAccess(session).isAdmin) return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  const body = await req.json();
  const { name, order } = body ?? {};
  if (!name?.trim()) return NextResponse.json({ error: "Kaynak adı zorunlu" }, { status: 400 });
  const created = await prisma.referralSourceDef.create({
    data: { name: String(name).trim(), order: order != null ? Number(order) : 0 },
  }).catch((e: unknown) => {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") return null;
    throw e;
  });
  if (!created) return NextResponse.json({ error: "Bu adda kaynak zaten var" }, { status: 409 });
  return NextResponse.json(created, { status: 201 });
}
