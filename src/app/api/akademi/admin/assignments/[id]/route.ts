import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission('akademi.admin');
  if (error) return error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID gerekli" }, { status: 400 });
  }

  const existing = await prisma.userCourseAssignment.findUnique({
    where: { id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Atama bulunamadı" }, { status: 404 });
  }

  await prisma.userCourseAssignment.delete({ where: { id } });

  return NextResponse.json({
    id,
    message: "Atama kaldırıldı",
  });
}
