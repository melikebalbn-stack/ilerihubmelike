import { describe, it, expect } from "vitest";
import { buildHealthSummary, type HealthLike, type HealthItemLike } from "./health-summary";

function items(varItemNos: number[], ameliyat = false): HealthItemLike[] {
  return Array.from({ length: 26 }, (_, i) => ({
    itemNo: i + 1,
    itemLabel: `Madde ${i + 1}`,
    deger: i + 1 === 26 ? ameliyat : varItemNos.includes(i + 1),
  }));
}
const emptyAstim: HealthLike = {
  ameliyatOlduMu: false, ameliyatNotu: null,
  astimSoru1: false, astimSoru1_1: null, astimSoru1_2: null,
  astimSoru2: false, astimSoru3: false, astimSoru4: false,
  astimSoru5: false, astimSoru6: false, astimSoru7: false,
};

describe("buildHealthSummary", () => {
  it("hiçbir VAR/EVET/ameliyat yok → bosMu true", () => {
    const s = buildHealthSummary(emptyAstim, items([]));
    expect(s.bosMu).toBe(true);
    expect(s.varItems).toHaveLength(0);
    expect(s.astimEvetler).toHaveLength(0);
    expect(s.ameliyat.oldu).toBe(false);
  });

  it("VAR maddeler (1-25) özetlenir, 26 (ameliyat) varItems'a girmez", () => {
    const s = buildHealthSummary(
      { ...emptyAstim, ameliyatOlduMu: true, ameliyatNotu: "Fıtık" },
      items([4, 6], true) // 4,6 VAR + 26 ameliyat EVET
    );
    expect(s.varItems.map((v) => v.itemNo)).toEqual([4, 6]);
    expect(s.ameliyat).toEqual({ oldu: true, not: "Fıtık" });
    expect(s.bosMu).toBe(false);
  });

  it("astım EVET cevapları listelenir (no ile)", () => {
    const s = buildHealthSummary(
      { ...emptyAstim, astimSoru1: true, astimSoru1_1: true, astimSoru3: true },
      items([])
    );
    const nolar = s.astimEvetler.map((a) => a.no);
    expect(nolar).toContain("1");
    expect(nolar).toContain("1.1");
    expect(nolar).toContain("3");
    expect(nolar).not.toContain("2");
    expect(s.bosMu).toBe(false);
  });
});
