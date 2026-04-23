import { NextResponse } from "next/server";
import { requireAkademiAdmin } from "@/lib/akademi-admin-guard";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { error } = await requireAkademiAdmin();
  if (error) return error;

  const rows = await prisma.course.findMany({
    where: { category: { not: null } },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });

  const categories = rows
    .map((r) => r.category)
    .filter((c): c is string => c !== null && c.trim().length > 0);

  return NextResponse.json({ categories });
}
