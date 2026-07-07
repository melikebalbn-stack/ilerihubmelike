// Sağlık beyanı özeti (İK görünümü) — saf mantık.
// VAR işaretli maddeler (1-25), astım EVET cevapları, ameliyat.
import { F13_56 } from "@/content/f13-37-56";

export interface HealthItemLike {
  itemNo: number;
  itemLabel: string;
  deger: boolean;
}
export interface HealthLike {
  ameliyatOlduMu: boolean | null;
  ameliyatNotu: string | null;
  astimSoru1: boolean | null;
  astimSoru1_1: boolean | null;
  astimSoru1_2: boolean | null;
  astimSoru2: boolean | null;
  astimSoru3: boolean | null;
  astimSoru4: boolean | null;
  astimSoru5: boolean | null;
  astimSoru6: boolean | null;
  astimSoru7: boolean | null;
}

export interface HealthSummary {
  varItems: { itemNo: number; itemLabel: string }[]; // 1-25 VAR
  astimEvetler: { no: string; metin: string }[]; // EVET cevaplı astım soruları
  ameliyat: { oldu: boolean; not: string | null };
  bosMu: boolean; // hiçbir VAR/EVET/ameliyat yoksa (beyan edilen hastalık yok)
}

export function buildHealthSummary(
  health: HealthLike,
  items: HealthItemLike[]
): HealthSummary {
  const varItems = items
    .filter((i) => i.deger === true && i.itemNo <= 25)
    .map((i) => ({ itemNo: i.itemNo, itemLabel: i.itemLabel }))
    .sort((a, b) => a.itemNo - b.itemNo);

  const astimEvetler = F13_56.sorular
    .filter((s) => (health as unknown as Record<string, unknown>)[s.key] === true)
    .map((s) => ({ no: s.no, metin: s.metin }));

  const ameliyat = { oldu: health.ameliyatOlduMu === true, not: health.ameliyatNotu };

  const bosMu = varItems.length === 0 && astimEvetler.length === 0 && !ameliyat.oldu;

  return { varItems, astimEvetler, ameliyat, bosMu };
}
