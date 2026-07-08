import { describe, it, expect } from "vitest";
import { validateHealthInput, type HealthInput } from "./health-validation";

// 26 maddenin tamamı cevaplı temel geçerli girdi.
function fullItems(ameliyat = false) {
  return Array.from({ length: 26 }, (_, i) => ({
    itemNo: i + 1,
    deger: i + 1 === 26 ? ameliyat : false,
  }));
}
const base: HealthInput = {
  items: fullItems(false),
  astimSoru1: false,
  astimSoru2: false,
  astimSoru3: false,
  astimSoru4: false,
  astimSoru5: false,
  astimSoru6: false,
  astimSoru7: false,
  cinsiyet: "BAY",
  dogumTarihi: "1990-05-10",
  beyanAccepted: true,
  telefonGunduz: "0555 000 00 00",
};

describe("validateHealthInput", () => {
  it("tüm alanlar geçerli → ok", () => {
    const r = validateHealthInput(base);
    expect(r.ok).toBe(true);
  });

  it("eksik madde → 400 + eksikItemNo listesi", () => {
    const r = validateHealthInput({ ...base, items: fullItems(false).slice(0, 24) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.eksikItemNo).toEqual([25, 26]);
  });

  it("madde deger boolean değilse eksik sayılır", () => {
    const items = fullItems(false);
    // 5. maddeyi boz
    (items[4] as { deger: unknown }).deger = "belki";
    const r = validateHealthInput({ ...base, items });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.eksikItemNo).toContain(5);
  });

  it("ameliyat (26) EVET + not boş → 400", () => {
    const r = validateHealthInput({ ...base, items: fullItems(true), ameliyatNotu: "  " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("ameliyat");
  });

  it("ameliyat EVET + not dolu → ok, ameliyatOlduMu=true", () => {
    const r = validateHealthInput({ ...base, items: fullItems(true), ameliyatNotu: "Apandisit" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.ameliyatOlduMu).toBe(true);
      expect(r.data.ameliyatNotu).toBe("Apandisit");
    }
  });

  it("astım soru1 cevapsız → 400", () => {
    const r = validateHealthInput({ ...base, astimSoru1: null });
    expect(r.ok).toBe(false);
  });

  it("astım soru1 EVET + 1.1/1.2 cevapsız → 400", () => {
    const r = validateHealthInput({ ...base, astimSoru1: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("1.1");
  });

  it("astım soru1 EVET + 1.1/1.2 dolu → ok, değerler korunur", () => {
    const r = validateHealthInput({
      ...base,
      astimSoru1: true,
      astimSoru1_1: true,
      astimSoru1_2: false,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.astimSoru1_1).toBe(true);
      expect(r.data.astimSoru1_2).toBe(false);
    }
  });

  it("astım soru1 HAYIR iken 1.1/1.2 gönderilse bile null'a zorlanır", () => {
    const r = validateHealthInput({
      ...base,
      astimSoru1: false,
      astimSoru1_1: true,
      astimSoru1_2: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.astimSoru1_1).toBeNull();
      expect(r.data.astimSoru1_2).toBeNull();
    }
  });

  it("beyan onaylanmadı → 400", () => {
    const r = validateHealthInput({ ...base, beyanAccepted: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("beyan");
  });

  it("gündüz telefonu boş → 400", () => {
    const r = validateHealthInput({ ...base, telefonGunduz: "  " });
    expect(r.ok).toBe(false);
  });

  it("astım soru 2-7 cevapsız → 400", () => {
    expect(validateHealthInput({ ...base, astimSoru4: null }).ok).toBe(false);
    expect(validateHealthInput({ ...base, astimSoru7: undefined }).ok).toBe(false);
  });

  it("cinsiyet yok/geçersiz → 400", () => {
    expect(validateHealthInput({ ...base, cinsiyet: null }).ok).toBe(false);
    expect(validateHealthInput({ ...base, cinsiyet: "OTHER" }).ok).toBe(false);
  });

  it("doğum tarihi yok/geçersiz → 400", () => {
    expect(validateHealthInput({ ...base, dogumTarihi: null }).ok).toBe(false);
    expect(validateHealthInput({ ...base, dogumTarihi: "abc" }).ok).toBe(false);
  });

  it("normalized items 1..26 sıralı ve boolean", () => {
    const r = validateHealthInput(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.items).toHaveLength(26);
      expect(r.data.items[0].itemNo).toBe(1);
      expect(r.data.items[25].itemNo).toBe(26);
      expect(r.data.items.every((i) => typeof i.deger === "boolean")).toBe(true);
    }
  });
});
