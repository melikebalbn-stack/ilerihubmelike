import type { Prisma, YakaDetayi, YakaRengi } from "@/generated/prisma";

/**
 * Raporlarda kullanılan yaka grupları (Melih, 11.10.2026).
 *
 * Personnel.yakaRengi üç değer tutar (MAVI/BEYAZ/GRI) ama "yönetici" ayrı bir
 * renk değil — yakaDetayi'ndeki müdür/müdür yrd./genel müdür kademeleridir.
 * Rapor kırılımı bu yüzden dört grup: Yönetici, Beyaz yaka, Gri yaka, Mavi yaka.
 *
 * Gri yakayı da gösteriyoruz; aksi halde grupların toplamı personel sayısını
 * tutmaz ve tablo yanıltır.
 */
export const YAKA_GRUPLARI = ["YONETICI", "BEYAZ", "GRI", "MAVI"] as const;
export type YakaGrubu = (typeof YAKA_GRUPLARI)[number];

export const YAKA_GRUP_ETIKETI: Record<YakaGrubu, string> = {
  YONETICI: "Yönetici",
  BEYAZ: "Beyaz yaka",
  GRI: "Gri yaka",
  MAVI: "Mavi yaka",
};

/** Yönetici sayılan yakaDetayi değerleri. */
export const YONETICI_YAKA_DETAYLARI = [
  "BEYAZ_GENEL_MDR",
  "BEYAZ_GMUDUR_YRD",
  "BEYAZ_MUDUR",
  "BEYAZ_MUDUR_YRD",
  "BEYAZ_MUHENDIS_MUDUR",
  "BEYAZ_MUHENDIS_MDRYRD",
] as const satisfies readonly YakaDetayi[];

const YONETICI_KUMESI = new Set<string>(YONETICI_YAKA_DETAYLARI);

/**
 * Bir personelin rapor grubu. yakaDetayi null ise (eski kayıtlar) yalnız
 * yakaRengi'ne bakılır — o kişi yönetici sayılmaz, beyaz/gri/mavi kalır.
 */
export function yakaGrubu(p: {
  yakaRengi: YakaRengi | string;
  yakaDetayi?: YakaDetayi | string | null;
}): YakaGrubu {
  if (p.yakaDetayi && YONETICI_KUMESI.has(p.yakaDetayi)) return "YONETICI";
  if (p.yakaRengi === "MAVI") return "MAVI";
  if (p.yakaRengi === "GRI") return "GRI";
  return "BEYAZ";
}

/** Verilen grup için Personnel where parçası (liste süzgeçlerinde kullanılır). */
export function yakaGrubuWhere(grup: YakaGrubu): Prisma.PersonnelWhereInput {
  switch (grup) {
    case "YONETICI":
      return { yakaDetayi: { in: [...YONETICI_YAKA_DETAYLARI] } };
    case "MAVI":
      return { yakaRengi: "MAVI" };
    case "GRI":
      return { yakaRengi: "GRI" };
    case "BEYAZ":
      // Beyaz ama yönetici değil.
      return {
        yakaRengi: "BEYAZ",
        NOT: { yakaDetayi: { in: [...YONETICI_YAKA_DETAYLARI] } },
      };
  }
}

/**
 * Sorgu parametresini güvenli şekilde gruba çevirir; geçersizse null.
 *
 * Grup anahtarları ASCII enum değeridir, Türkçe metin değil: burada düz
 * toUpperCase() kullanılır. toLocaleUpperCase("tr-TR") "mavi" → "MAVİ"
 * üretir ve eşleşme kaçar.
 */
export function parseYakaGrubu(deger: string | null | undefined): YakaGrubu | null {
  if (!deger) return null;
  const buyuk = deger.toUpperCase();
  return (YAKA_GRUPLARI as readonly string[]).includes(buyuk)
    ? (buyuk as YakaGrubu)
    : null;
}

/** Boş sayaç — bölüm kırılımı tabloları için. */
export function bosYakaSayaci(): Record<YakaGrubu, number> {
  return { YONETICI: 0, BEYAZ: 0, GRI: 0, MAVI: 0 };
}
