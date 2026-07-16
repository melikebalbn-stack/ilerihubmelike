import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";

function isAdmin(session: { user: { permissions?: string[] } }) {
  return (session.user.permissions ?? []).includes("recruitment.admin");
}

// PATCH — yetkinlik düzenle/pasifleştir (admin).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession();
  if (error) return error;
  if (!isAdmin(session)) return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name != null) data.name = String(body.name).trim();
  if (body.isActive != null) data.isActive = Boolean(body.isActive);
  const updated = await prisma.competency.update({ where: { id }, data });
  return NextResponse.json(updated);
}

// DELETE — kullanılmıyorsa sil, pozisyona bağlıysa pasifleştir (SİLME YOK kuralı).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession();
  if (error) return error;
  if (!isAdmin(session)) return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  const { id } = await params;
  const kullanim = await prisma.positionCompetency.count({ where: { competencyId: id } });
  if (kullanim > 0) {
    await prisma.competency.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ ok: true, pasiflestirildi: true, kullanim });
  }
  await prisma.competency.delete({ where: { id } });
  return NextResponse.json({ ok: true, silindi: true });
}
