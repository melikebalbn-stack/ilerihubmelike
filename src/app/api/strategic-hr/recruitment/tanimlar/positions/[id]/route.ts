import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";

function isAdmin(session: { user: { permissions?: string[] } }) {
  return (session.user.permissions ?? []).includes("recruitment.admin");
}

// PATCH — pozisyon İK alanlarını düzenle (yaka / İngilizce / hedef TtH / aktiflik).
// SİLME YOK — pasife çekilir (isActive:false). IFS senkron alanlarına (code/title) dokunulmaz.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession();
  if (error) return error;
  if (!isAdmin(session)) return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.yaka !== undefined) data.yaka = body.yaka || null; // MAVI | BEYAZ | null
  if (body.ingilizceZorunlu !== undefined) data.ingilizceZorunlu = Boolean(body.ingilizceZorunlu);
  if (body.hedefTimeToHire !== undefined) data.hedefTimeToHire = body.hedefTimeToHire != null && body.hedefTimeToHire !== "" ? Number(body.hedefTimeToHire) : null;
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  const updated = await prisma.position.update({ where: { id }, data });
  return NextResponse.json(updated);
}
