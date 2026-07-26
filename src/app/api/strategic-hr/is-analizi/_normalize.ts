// src/app/api/strategic-hr/is-analizi/_normalize.ts
// Personnel verisi kirli olabilir (_x000D_, cift bosluk, yazim hatasi).
// Kaynagi DEGISTIRMEDEN, okurken normalize ederiz.

const YAZIM_DUZELTME: Record<string, string> = {
  "KAYNKAK OPERATÖRÜ": "KAYNAK OPERATÖRÜ",
  "İDARİ İŞLERSORUMLUSU": "İDARİ İŞLER SORUMLUSU",
};

export function temizle(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .replace(/_x000D_/g, " ")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function gorevNormalize(s: string | null | undefined): string {
  const t = temizle(s);
  return YAZIM_DUZELTME[t] ?? t;
}

export function yakaNormalize(s: string | null | undefined): "MAVI" | "BEYAZ" {
  const t = temizle(s as string).toUpperCase();
  return t.includes("BEYAZ") ? "BEYAZ" : "MAVI";
}

export function eslesmeAnahtari(s: string | null | undefined): string {
  return gorevNormalize(s).toLocaleLowerCase("tr-TR");
}
