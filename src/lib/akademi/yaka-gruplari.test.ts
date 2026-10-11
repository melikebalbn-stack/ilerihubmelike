import { describe, expect, it } from "vitest";
import {
  bosYakaSayaci,
  parseYakaGrubu,
  yakaGrubu,
  yakaGrubuWhere,
  YAKA_GRUPLARI,
} from "./yaka-gruplari";

describe("yakaGrubu", () => {
  it("müdür kademeleri yönetici sayılır", () => {
    for (const d of [
      "BEYAZ_GENEL_MDR",
      "BEYAZ_GMUDUR_YRD",
      "BEYAZ_MUDUR",
      "BEYAZ_MUDUR_YRD",
      "BEYAZ_MUHENDIS_MUDUR",
      "BEYAZ_MUHENDIS_MDRYRD",
    ]) {
      expect(yakaGrubu({ yakaRengi: "BEYAZ", yakaDetayi: d })).toBe("YONETICI");
    }
  });

  it("mühendis ve tekniker yönetici DEĞİL", () => {
    expect(
      yakaGrubu({ yakaRengi: "BEYAZ", yakaDetayi: "BEYAZ_MUHENDIS" })
    ).toBe("BEYAZ");
    expect(
      yakaGrubu({ yakaRengi: "BEYAZ", yakaDetayi: "BEYAZ_SORUMLU_TEKNIKER" })
    ).toBe("BEYAZ");
  });

  it("yakaDetayi null ise yalnız renge bakılır", () => {
    expect(yakaGrubu({ yakaRengi: "BEYAZ", yakaDetayi: null })).toBe("BEYAZ");
    expect(yakaGrubu({ yakaRengi: "MAVI", yakaDetayi: null })).toBe("MAVI");
    expect(yakaGrubu({ yakaRengi: "GRI", yakaDetayi: null })).toBe("GRI");
  });

  it("gri vekalet gri kalır", () => {
    expect(yakaGrubu({ yakaRengi: "GRI", yakaDetayi: "GRI_VEKALET" })).toBe(
      "GRI"
    );
  });

  it("mavi yaka mavi kalır", () => {
    expect(yakaGrubu({ yakaRengi: "MAVI", yakaDetayi: "MAVI" })).toBe("MAVI");
  });

  it("her personel tam olarak bir gruba düşer", () => {
    const ornekler = [
      { yakaRengi: "BEYAZ", yakaDetayi: "BEYAZ_MUDUR" },
      { yakaRengi: "BEYAZ", yakaDetayi: "BEYAZ" },
      { yakaRengi: "GRI", yakaDetayi: "GRI" },
      { yakaRengi: "MAVI", yakaDetayi: null },
    ];
    const gruplar = ornekler.map(yakaGrubu);
    expect(new Set(gruplar).size).toBe(4);
    for (const g of gruplar) expect(YAKA_GRUPLARI).toContain(g);
  });
});

describe("yakaGrubuWhere", () => {
  it("beyaz grubu yöneticileri dışlar", () => {
    const w = yakaGrubuWhere("BEYAZ");
    expect(w.yakaRengi).toBe("BEYAZ");
    expect(w.NOT).toBeDefined();
  });

  it("yönetici grubu yalnız detay listesine bakar, renge değil", () => {
    const w = yakaGrubuWhere("YONETICI");
    expect(w.yakaRengi).toBeUndefined();
    expect(w.yakaDetayi).toBeDefined();
  });

  it("mavi ve gri yalnız renkle süzülür", () => {
    expect(yakaGrubuWhere("MAVI")).toEqual({ yakaRengi: "MAVI" });
    expect(yakaGrubuWhere("GRI")).toEqual({ yakaRengi: "GRI" });
  });
});

describe("parseYakaGrubu", () => {
  it("geçerli değeri döndürür, küçük harf kabul eder", () => {
    expect(parseYakaGrubu("YONETICI")).toBe("YONETICI");
    expect(parseYakaGrubu("mavi")).toBe("MAVI");
  });

  it("geçersiz / boş değerde null", () => {
    expect(parseYakaGrubu("")).toBeNull();
    expect(parseYakaGrubu(null)).toBeNull();
    expect(parseYakaGrubu("YESIL")).toBeNull();
  });
});

describe("bosYakaSayaci", () => {
  it("dört grup sıfırla başlar", () => {
    expect(bosYakaSayaci()).toEqual({ YONETICI: 0, BEYAZ: 0, GRI: 0, MAVI: 0 });
  });
});
