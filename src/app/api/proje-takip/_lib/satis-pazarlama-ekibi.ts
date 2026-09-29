import { prisma } from "@/lib/prisma";
import { normalizeTr } from "@/lib/normalize-tr";

// DB'den doğrulandı (2026-09-29): normalizeTr ile bu ada eşleşen tek bölüm yazımı
// "Satış & Pazarlama Müdürlüğü" (6 aktif+hesaplı kişi). "SATIŞ PAZARLAMA MÜDÜRLÜĞÜ"
// ('&' yok) ve "Asansör Satış Pazarlama" eşleşmez — bilinçli, can-see-fiyat.ts ile aynı.
export const SATIS_PAZARLAMA_BOLUM = "Satış & Pazarlama Müdürlüğü";

export type SatisPazarlamaKisi = {
  id: string; // User.id
  name: string | null;
  email: string;
};

// Bu departmanda aktif VE bir User hesabına bağlı personel — bildirim/mail
// atabilmek için User.id/email şart, hesabı olmayan personel listeye girmez.
// muhendislik-ekibi.ts (getMuhendislikEkibi) ile aynı desen; bölüm adı
// normalizeTr ile TAM eşleşir (büyük/küçük harf, Türkçe karakter farkı tolere edilir).
export async function getSatisPazarlamaEkibi(): Promise<SatisPazarlamaKisi[]> {
  const bolumler = await prisma.personnel.groupBy({ by: ["bolum"] });
  const hedef = normalizeTr(SATIS_PAZARLAMA_BOLUM);
  const eslesenBolumler = bolumler
    .map((b) => b.bolum)
    .filter((b) => normalizeTr(b) === hedef);
  if (eslesenBolumler.length === 0) return [];

  const personeller = await prisma.personnel.findMany({
    where: {
      bolum: { in: eslesenBolumler },
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
    .filter((u): u is SatisPazarlamaKisi => u !== null);
}
