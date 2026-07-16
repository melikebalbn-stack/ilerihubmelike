// Sağlık beyanı doğrulama — SAF mantık (DB/isteğe bağımsız, test edilebilir).
// Task'ın açık validasyon listesi: 26 madde tam, ameliyat(26) EVET+not, astım soru1
// koşullu 1.1/1.2, beyan zorunlu, telefon gündüz zorunlu. Diğer astım soruları/cinsiyet/
// doğum tarihi OPSİYONEL (UI client-side isteyebilir) — gönderilirse saklanır.

export const AMELIYAT_ITEM_NO = 26;
export const TOTAL_ITEMS = 26;

export interface HealthItemInput {
  itemNo: number;
  deger: boolean;
}

export interface HealthInput {
  items?: HealthItemInput[];
  gecmisHastalikNotu?: string | null;
  ameliyatNotu?: string | null;
  astimSoru1?: boolean | null;
  astimSoru1_1?: boolean | null;
  astimSoru1_2?: boolean | null;
  astimSoru2?: boolean | null;
  astimSoru3?: boolean | null;
  astimSoru4?: boolean | null;
  astimSoru5?: boolean | null;
  astimSoru6?: boolean | null;
  astimSoru7?: boolean | null;
  dogumTarihi?: string | null;
  cinsiyet?: string | null;
  telefonGunduz?: string | null;
  telefonGece?: string | null;
  beyanAccepted?: boolean;
}

export interface NormalizedHealth {
  items: HealthItemInput[]; // 1..26, itemNo sıralı
  ameliyatOlduMu: boolean; // item 26
  ameliyatNotu: string | null;
  gecmisHastalikNotu: string | null;
  astimSoru1: boolean;
  astimSoru1_1: boolean | null; // soru1 HAYIR ise null'a zorlanır
  astimSoru1_2: boolean | null;
  astimSoru2: boolean | null;
  astimSoru3: boolean | null;
  astimSoru4: boolean | null;
  astimSoru5: boolean | null;
  astimSoru6: boolean | null;
  astimSoru7: boolean | null;
  cinsiyet: string | null;
  dogumTarihi: string | null;
  telefonGunduz: string;
  telefonGece: string | null;
}

export type HealthValidationResult =
  | { ok: true; data: NormalizedHealth }
  | { ok: false; error: string; eksikItemNo?: number[] };

function boolOrNull(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}
function trimOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s === "" ? null : s;
}

export function validateHealthInput(input: HealthInput): HealthValidationResult {
  // 1) 26 maddenin tamamı boolean cevaplı mı?
  const map = new Map<number, boolean>();
  for (const it of input.items ?? []) {
    if (it && typeof it.itemNo === "number" && typeof it.deger === "boolean") {
      map.set(it.itemNo, it.deger);
    }
  }
  const eksikItemNo: number[] = [];
  for (let n = 1; n <= TOTAL_ITEMS; n++) {
    if (typeof map.get(n) !== "boolean") eksikItemNo.push(n);
  }
  if (eksikItemNo.length > 0) {
    return {
      ok: false,
      error: `Tüm sağlık maddeleri işaretlenmelidir. Eksik: ${eksikItemNo.join(", ")}`,
      eksikItemNo,
    };
  }

  // 2) Ameliyat (26) EVET → not zorunlu.
  const ameliyatOlduMu = map.get(AMELIYAT_ITEM_NO) === true;
  const ameliyatNotu = trimOrNull(input.ameliyatNotu);
  if (ameliyatOlduMu && !ameliyatNotu) {
    return { ok: false, error: "Ameliyat oldunuz ise hangi ameliyat olduğunuzu belirtiniz" };
  }

  // 3) Astım soru1 zorunlu (koşulu sürükler); EVET → 1.1/1.2 zorunlu, HAYIR → null.
  if (typeof input.astimSoru1 !== "boolean") {
    return { ok: false, error: "Astım 1. soruyu cevaplayınız" };
  }
  let s1_1: boolean | null = null;
  let s1_2: boolean | null = null;
  if (input.astimSoru1 === true) {
    if (typeof input.astimSoru1_1 !== "boolean" || typeof input.astimSoru1_2 !== "boolean") {
      return { ok: false, error: "1.1 ve 1.2 sorularını cevaplayınız" };
    }
    s1_1 = input.astimSoru1_1;
    s1_2 = input.astimSoru1_2;
  }
  // soru1 HAYIR → s1_1/s1_2 null kalır (gönderilmiş olsa bile null'a zorlanır).

  // 3b) Astım soru 2-7 hepsi cevaplı (EVET/HAYIR) zorunlu.
  const astim27: (keyof HealthInput)[] = [
    "astimSoru2", "astimSoru3", "astimSoru4", "astimSoru5", "astimSoru6", "astimSoru7",
  ];
  for (const key of astim27) {
    if (typeof input[key] !== "boolean") {
      const no = key.replace("astimSoru", "");
      return { ok: false, error: `Astım ${no}. soruyu cevaplayınız` };
    }
  }

  // 4) Beyan checkbox zorunlu.
  if (input.beyanAccepted !== true) {
    return { ok: false, error: "Sağlık beyanını onaylamanız zorunludur" };
  }

  // 5) Cinsiyet (BAY/BAYAN) + doğum tarihi + gündüz telefonu zorunlu.
  const cinsiyet = trimOrNull(input.cinsiyet);
  if (cinsiyet !== "BAY" && cinsiyet !== "BAYAN") {
    return { ok: false, error: "Cinsiyet seçiniz" };
  }
  const dogumTarihi = trimOrNull(input.dogumTarihi);
  if (!dogumTarihi || Number.isNaN(new Date(dogumTarihi).getTime())) {
    return { ok: false, error: "Doğum tarihi zorunludur" };
  }
  const telefonGunduz = trimOrNull(input.telefonGunduz);
  if (!telefonGunduz) {
    return { ok: false, error: "Gündüz telefonu zorunludur" };
  }

  return {
    ok: true,
    data: {
      items: Array.from({ length: TOTAL_ITEMS }, (_, i) => ({
        itemNo: i + 1,
        deger: map.get(i + 1) as boolean,
      })),
      ameliyatOlduMu,
      ameliyatNotu: ameliyatOlduMu ? ameliyatNotu : null,
      gecmisHastalikNotu: trimOrNull(input.gecmisHastalikNotu),
      astimSoru1: input.astimSoru1,
      astimSoru1_1: s1_1,
      astimSoru1_2: s1_2,
      astimSoru2: boolOrNull(input.astimSoru2),
      astimSoru3: boolOrNull(input.astimSoru3),
      astimSoru4: boolOrNull(input.astimSoru4),
      astimSoru5: boolOrNull(input.astimSoru5),
      astimSoru6: boolOrNull(input.astimSoru6),
      astimSoru7: boolOrNull(input.astimSoru7),
      cinsiyet,
      dogumTarihi,
      telefonGunduz,
      telefonGece: trimOrNull(input.telefonGece),
    },
  };
}
