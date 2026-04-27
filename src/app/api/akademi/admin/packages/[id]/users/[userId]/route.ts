import { NextRequest, NextResponse } from "next/server";
import { requireAkademiAdmin } from "@/lib/akademi-admin-guard";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { error } = await requireAkademiAdmin();
  if (error) return error;

  const { id, userId } = await params;

  await prisma.userPackageAssignment.deleteMany({
    where: { packageId: id, userId },
  });

  return NextResponse.json({ success: true });
}
