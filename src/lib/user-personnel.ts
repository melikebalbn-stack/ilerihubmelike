import { prisma } from "@/lib/prisma";

export async function resolveUserPersonnel(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { personnel: true },
  });
  return user?.personnel ?? null;
}

export async function resolveUserBolum(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { personnel: { select: { bolum: true } } },
  });
  return user?.personnel?.bolum ?? null;
}

export async function getUsersByBolum(bolum: string) {
  return prisma.user.findMany({
    where: {
      personnel: { bolum },
    },
    select: {
      id: true,
      name: true,
      email: true,
      personnelId: true,
    },
  });
}

export async function getLinkedBolums(): Promise<string[]> {
  const rows = await prisma.personnel.findMany({
    where: {
      bolum: { not: "" },
      user: { isNot: null },
    },
    select: { bolum: true },
    distinct: ["bolum"],
    orderBy: { bolum: "asc" },
  });
  return rows.map((r) => r.bolum).filter(Boolean) as string[];
}
