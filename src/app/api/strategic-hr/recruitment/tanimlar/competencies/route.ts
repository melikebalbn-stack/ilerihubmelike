import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import type { CompetencyCategory } from "@/generated/prisma";

function recruitAccess(session: { user: { permissions?: string[] } }) {
  const perms = session.user.permissions ?? [];
  return { isAdmin: perms.includes("recruitment.admin"), canView: perms.includes("recruitment.view") };
}

const KATEGORILER = new Set(["CORE", "LEADERSHIP", "TECHNICAL", "BEHAVIORAL", "FUNCTIONAL"]);

// GET — yetkinlik kataloğu (mevcut Competency tablosu — yeni tablo açılmaz).
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;
  const { isAdmin, canView } = recruitAccess(session);
  if (!isAdmin && !canView) return NextResponse.json({ error: "Bu modüle erişim yetkiniz yok" }, { status: 403 });
  const items = await prisma.competency.findMany({
    orderBy: [{ isActive: "desc" }, { category: "asc" }, { name: "asc" }],
    select: { id: true, code: true, name: true, category: true, isActive: true },
  });
  return NextResponse.json(items);
}

// POST — yeni yetkinlik (admin). code + name + kategori.
export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;
  if (!recruitAccess(session).isAdmin) return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  const body = await req.json();
  const { code, name, category } = body ?? {};
  if (!code?.trim() || !name?.trim() || !KATEGORILER.has(category)) {
    return NextResponse.json({ error: "Kod, ad ve geçerli kategori zorunlu" }, { status: 400 });
  }
  const created = await prisma.competency.create({
    data: { code: String(code).trim().toUpperCase(), name: String(name).trim(), category: category as CompetencyCategory },
  }).catch((e: unknown) => {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") return null;
    throw e;
  });
  if (!created) return NextResponse.json({ error: "Bu kod zaten var" }, { status: 409 });
  return NextResponse.json(created, { status: 201 });
}
