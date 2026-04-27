import { NextRequest, NextResponse } from "next/server";
import { requireAkademiAdmin } from "@/lib/akademi-admin-guard";
import { prisma } from "@/lib/prisma";
import type { AdminPackageBolumsUpdateInput } from "@/types/akademi-package";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAkademiAdmin();
  if (error) return error;

  const { id } = await params;

  let body: AdminPackageBolumsUpdateInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.bolums)) {
    return NextResponse.json(
      { error: "bolums bir dizi olmalı" },
      { status: 400 }
    );
  }

  const pkg = await prisma.coursePackage.findUnique({ where: { id } });
  if (!pkg) {
    return NextResponse.json({ error: "Paket bulunamadı" }, { status: 404 });
  }

  const cleanBolums = Array.from(
    new Set(body.bolums.map((b) => b.trim()).filter((b) => b.length > 0))
  );

  await prisma.$transaction([
    prisma.departmentPackage.deleteMany({ where: { packageId: id } }),
    prisma.departmentPackage.createMany({
      data: cleanBolums.map((bolum) => ({ packageId: id, bolum })),
    }),
  ]);

  return NextResponse.json({ success: true, count: cleanBolums.length });
}
