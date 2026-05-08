import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import type { BolumWithCount } from "@/types/akademi-package";

export async function GET() {
  const { error } = await requirePermission('akademi.kurs.edit');
  if (error) return error;

  const rows = await prisma.personnel.groupBy({
    by: ["bolum"],
    where: {
      bolum: { not: "" },
      user: { isNot: null },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  const result: BolumWithCount[] = rows
    .filter((r) => r.bolum !== null && r.bolum.length > 0)
    .map((r) => ({
      bolum: r.bolum as string,
      userCount: r._count.id,
    }));

  return NextResponse.json({ bolums: result });
}
