import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAkademiUserId } from "@/lib/akademi-user";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = await resolveAkademiUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const certs = await prisma.akademiCertificate.findMany({
    where: { userId },
    include: {
      course: { select: { id: true, title: true } },
      _count: { select: { downloads: true } },
    },
    orderBy: { issuedAt: "desc" },
  });

  return NextResponse.json({ certificates: certs });
}
