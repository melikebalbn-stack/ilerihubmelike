import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";

// DELETE — maliyet kaydını sil (admin).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession();
  if (error) return error;
  if (!(session.user.permissions ?? []).includes("recruitment.admin")) {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }
  const { id } = await params;
  await prisma.recruitmentCost.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
