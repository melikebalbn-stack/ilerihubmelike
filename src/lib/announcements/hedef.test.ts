// @vitest-environment node
import { describe, it, expect } from "vitest";
import { bolumEsit, normalizeBolum } from "./hedef";

describe("bolumEsit — hedef departman normalize eşleşmesi", () => {
  it("form değeri ↔ AD 'Departmanı' ↔ büyük harf 'MÜDÜRLÜĞÜ' hepsi eşit", () => {
    expect(bolumEsit("Sistem Geliştirme", "Sistem Geliştirme Departmanı")).toBe(true);
    expect(bolumEsit("Sistem Geliştirme", "SİSTEM GELİŞTİRME MÜDÜRLÜĞÜ")).toBe(true);
    expect(bolumEsit("Sistem Geliştirme Departmanı", "SİSTEM GELİŞTİRME MÜDÜRLÜĞÜ")).toBe(true);
  });

  it("Türkçe harf varyasyonları (ı/i, ş/s, ğ/g) tolere edilir", () => {
    expect(bolumEsit("Sistem Gelistirme Mudurlugu", "Sistem Geliştirme Departmanı")).toBe(true);
  });

  it("farklı bölüm eşit DEĞİL", () => {
    expect(bolumEsit("Sistem", "Sistem Geliştirme")).toBe(false);
    expect(bolumEsit("İnsan Varlıkları", "Sistem Geliştirme")).toBe(false);
  });

  it("boş/null eşleşmez", () => {
    expect(bolumEsit("", "Sistem Geliştirme")).toBe(false);
    expect(bolumEsit(null, null)).toBe(false);
    expect(bolumEsit("Departmanı", "")).toBe(false); // yalnız ek → boş normalize
  });
});

describe("normalizeBolum — ek soyma", () => {
  it("sondaki kurumsal eki soyar", () => {
    expect(normalizeBolum("Sistem Geliştirme Departmanı")).toBe("sistem gelistirme");
    expect(normalizeBolum("Kalite Müdürlüğü")).toBe("kalite");
    expect(normalizeBolum("Üretim Bölümü")).toBe("uretim");
    expect(normalizeBolum("Sistem Geliştirme")).toBe("sistem gelistirme");
  });
  it("ortadaki 'departman' kelimesini soymaz (yalnız sondaki ek)", () => {
    expect(normalizeBolum("Departman Yönetimi")).toBe("departman yonetimi");
  });
});
