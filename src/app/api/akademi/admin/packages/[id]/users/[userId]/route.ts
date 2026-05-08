import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { error } = await requirePermission('akademi.kurs.edit');
  if (error) return error;

  const { id, userId } = await params;

  await prisma.userPackageAssignment.deleteMany({
    where: { packageId: id, userId },
  });

  return NextResponse.json({ success: true });
}
