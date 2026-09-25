import { prisma } from "@/lib/prisma";
import { normalizeTr } from "@/lib/normalize-tr";

// DB'den doğrulandı (2026-09-21): `SELECT bolum, COUNT(*) FROM "Personnel" GROUP BY bolum`
// çıktısında mühendislik departmanına karşılık gelen tek satır bu — tahmin değil.
export const MUHENDISLIK_BOLUM = "Mühendislik Müdürlüğü";

// 2026-09-24: isim bazlı hariç tutma (unvan bazlı DEĞİL, başka bir müdür
// gelirse etkilenmesin diye).
const HARIC_TUTULAN_ADSOYAD = "Rahmi Orkun Kırçuvaloğlu";

export type MuhendislikKisi = {
  id: string; // User.id
  name: string | null;
  email: string;
};

// Bu departmanda aktif VE bir User hesabına bağlı personel — bildirim/mail
// atabilmek için User.id/email şart, hesabı olmayan personel listeye girmez.
// HARIC_TUTULAN_ADSOYAD da (isim bazlı) listeden çıkarılır.
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
    .filter((p) => normalizeTr(p.adSoyad) !== normalizeTr(HARIC_TUTULAN_ADSOYAD))
    .map((p) => p.user)
    .filter((u): u is MuhendislikKisi => u !== null);
}
