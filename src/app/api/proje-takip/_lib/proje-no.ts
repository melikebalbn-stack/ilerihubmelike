import { prisma } from "@/lib/prisma";

// Advisory-lock tabanlı atomik proje numarası üretimi (OR-2026-00001 pattern'ının aynısı)
export async function generateProjeNo(): Promise<string> {
  const yil = new Date().getFullYear();
  const lockKey = 987654321; // proje-takip modülüne özel sabit lock anahtarı

  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${lockKey})`);

    const sayac = await tx.projeTakip.count({
      where: { projeNo: { startsWith: `PRJ-${yil}-` } },
    });

    const siraNo = (sayac + 1).toString().padStart(5, "0");
    return `PRJ-${yil}-${siraNo}`;
  });
}
