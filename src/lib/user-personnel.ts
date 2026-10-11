import { prisma } from "@/lib/prisma";

/**
 * Akademi/rapor listelerinde kullanılan ortak "aktif personel" kapısı.
 *
 * Personnel.aktif = false olan kişi işten ayrılmıştır; bugünkü bölüm
 * listelerinde, panolarda ve raporlarda görünmemelidir. Geçmiş kayıtları
 * (atama, ilerleme, sertifika) SİLİNMEZ — yalnız listeden düşer.
 *
 * Kullanım: `where: { personnel: { bolum, ...AKTIF_PERSONEL } }`
 */
export const AKTIF_PERSONEL = { aktif: true } as const;

/** Personnel üzerinden filtreleyen User sorguları için hazır parça. */
export const AKTIF_PERSONEL_USER_WHERE = {
  personnel: { is: AKTIF_PERSONEL },
} as const;

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
      personnel: { bolum, ...AKTIF_PERSONEL },
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
      ...AKTIF_PERSONEL,
    },
    select: { bolum: true },
    distinct: ["bolum"],
    orderBy: { bolum: "asc" },
  });
  return rows.map((r) => r.bolum).filter(Boolean) as string[];
}
