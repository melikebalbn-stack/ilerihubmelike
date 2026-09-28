import { prisma } from "@/lib/prisma";

// DB'den doğrulandı (2026-09-21): `SELECT bolum, COUNT(*) FROM "Personnel" GROUP BY bolum`
// çıktısında mühendislik departmanına karşılık gelen tek satır bu — tahmin değil.
export const MUHENDISLIK_BOLUM = "Mühendislik Müdürlüğü";

export type MuhendislikKisi = {
  id: string; // User.id
  name: string | null;
  email: string;
};

// Bu departmanda aktif VE bir User hesabına bağlı personel — bildirim/mail
// atabilmek için User.id/email şart, hesabı olmayan personel listeye girmez.
// Hem Sorumlu Mühendis dropdown'ını hem bildirim alıcılarını besler.
export async function getMuhendislikEkibi(): Promise<MuhendislikKisi[]> {
  const personeller = await prisma.personnel.findMany({
    where: {
      bolum: MUHENDISLIK_BOLUM,
      aktif: true,
      user: { isNot: null },
    },
    select: {
      adSoyad: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { adSoyad: "asc" },
  });

  return personeller
    .map((p) => p.user)
    .filter((u): u is MuhendislikKisi => u !== null);
}
