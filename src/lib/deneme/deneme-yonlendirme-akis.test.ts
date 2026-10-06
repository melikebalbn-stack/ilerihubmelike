import { describe, it, expect } from "vitest";
import { yonlendirmeAkisDuzeltmesi, type YonlendirmeAkisGirdi } from "./deneme-yonlendirme-akis";

// 06.10.2026 canlı vakası (ILR-01118, BEYAZ, İdari İşler): İV 1. değerlendiriciyi
// başka bölümün müdür yardımcısına yönlendirdi → rol TAKIM_LIDERI, form tek puanlı
// kaldı, "Gönder" matriste tıkandı. Saf karar fonksiyonu bunu kurala bağlar.

const TEMEL: YonlendirmeAkisGirdi = {
  sira: 1,
  rol: "TAKIM_LIDERI",
  durum: "DEGERLENDIRICI1_BEKLIYOR",
  mevcutDeg2Id: null,
  mevcutOnaylayanId: null,
  mudurId: "mudur",
  mudurYardimcisiId: "myrd",
  personnelId: "kisi",
  hedefId: "hedef",
};

describe("yonlendirmeAkisDuzeltmesi · 1. adım (YENİ)", () => {
  it("takım lideri hedef + müdür yrd. VAR → deg2 = müdür yrd., onay = müdür", () => {
    const s = yonlendirmeAkisDuzeltmesi(TEMEL);
    expect(s.eklenenDeg2).toEqual({ id: "myrd", rol: "MUDUR_YARDIMCISI" });
    expect(s.onaylayanId).toBe("mudur");
    expect(s.durum).toBe("DEGERLENDIRICI1_BEKLIYOR"); // adım sahibi değişmez
    expect(s.hata).toBeUndefined();
  });

  it("takım lideri hedef + müdür yrd. YOK → deg2 = müdür, onay YOK", () => {
    // İdari İşler'in durumu (mudurYardimcisiId NULL) — canlı vakanın birebiri.
    const s = yonlendirmeAkisDuzeltmesi({ ...TEMEL, mudurYardimcisiId: null });
    expect(s.eklenenDeg2).toEqual({ id: "mudur", rol: "MUDUR" });
    expect(s.onaylayanId).toBeNull();
    expect(s.hata).toBeUndefined();
  });

  it("müdür hedef → DEĞİŞİKLİK YOK (tek puanlı form kendi başına kapanır)", () => {
    const s = yonlendirmeAkisDuzeltmesi({ ...TEMEL, rol: "MUDUR", hedefId: "mudur" });
    expect(s.eklenenDeg2).toBeNull();
    expect(s.onaylayanId).toBeNull(); // mevcutOnaylayanId korunur
    expect(s.durum).toBe("DEGERLENDIRICI1_BEKLIYOR");
  });

  it("müdür yrd. hedef → DEĞİŞİKLİK YOK", () => {
    const s = yonlendirmeAkisDuzeltmesi({ ...TEMEL, rol: "MUDUR_YARDIMCISI", hedefId: "myrd" });
    expect(s.eklenenDeg2).toBeNull();
    expect(s.durum).toBe("DEGERLENDIRICI1_BEKLIYOR");
  });

  it("form ZATEN iki puanlıysa 1. adım yönlendirmesi akışa dokunmaz", () => {
    const s = yonlendirmeAkisDuzeltmesi({ ...TEMEL, mevcutDeg2Id: "myrd", mevcutOnaylayanId: "mudur" });
    expect(s.eklenenDeg2).toBeNull();
    expect(s.onaylayanId).toBe("mudur");
  });

  it("müdür yrd. = değerlendirilen kişinin kendisi → müdüre düşer", () => {
    const s = yonlendirmeAkisDuzeltmesi({ ...TEMEL, mudurYardimcisiId: "kisi" });
    expect(s.eklenenDeg2).toEqual({ id: "mudur", rol: "MUDUR" });
    expect(s.onaylayanId).toBeNull();
  });

  it("müdür yrd. = hedefin kendisi → müdüre düşer (aynı kişi iki rolde olamaz)", () => {
    const s = yonlendirmeAkisDuzeltmesi({ ...TEMEL, mudurYardimcisiId: "hedef" });
    expect(s.eklenenDeg2).toEqual({ id: "mudur", rol: "MUDUR" });
  });

  it("müdür = hedefin kendisi + müdür yrd. var → onay kurulmaz (deg2 müdür yrd.)", () => {
    const s = yonlendirmeAkisDuzeltmesi({ ...TEMEL, mudurId: "hedef" });
    expect(s.eklenenDeg2).toEqual({ id: "myrd", rol: "MUDUR_YARDIMCISI" });
    expect(s.onaylayanId).toBeNull();
  });

  it("ne müdür yrd. ne müdür kullanılabilir → HATA (yönlendirme reddedilir)", () => {
    const s = yonlendirmeAkisDuzeltmesi({ ...TEMEL, mudurYardimcisiId: null, mudurId: null });
    expect(s.eklenenDeg2).toBeNull();
    expect(s.hata).toContain("2. değerlendirici adımı kurulamıyor");
  });
});

describe("yonlendirmeAkisDuzeltmesi · 2. adım (REGRESYON — davranış değişmedi)", () => {
  const IKI: YonlendirmeAkisGirdi = { ...TEMEL, sira: 2, mevcutDeg2Id: "eski", durum: "MUDUR_YRD_BEKLIYOR" };

  it("müdür hedef → onay NULL, MUDUR_YRD_BEKLIYOR → MUDUR_BEKLIYOR", () => {
    const s = yonlendirmeAkisDuzeltmesi({ ...IKI, rol: "MUDUR", hedefId: "mudur" });
    expect(s.onaylayanId).toBeNull();
    expect(s.durum).toBe("MUDUR_BEKLIYOR");
    expect(s.eklenenDeg2).toBeNull();
  });

  it("müdür yrd. hedef → onay = müdür, MUDUR_BEKLIYOR → MUDUR_YRD_BEKLIYOR", () => {
    const s = yonlendirmeAkisDuzeltmesi({ ...IKI, rol: "MUDUR_YARDIMCISI", durum: "MUDUR_BEKLIYOR", hedefId: "myrd" });
    expect(s.onaylayanId).toBe("mudur");
    expect(s.durum).toBe("MUDUR_YRD_BEKLIYOR");
  });

  it("müdür yrd. hedef + müdür = hedefin kendisi → onay NULL, durum SABİT", () => {
    const s = yonlendirmeAkisDuzeltmesi({ ...IKI, rol: "MUDUR_YARDIMCISI", durum: "MUDUR_BEKLIYOR", hedefId: "mudur", mudurId: "mudur" });
    expect(s.onaylayanId).toBeNull();
    expect(s.durum).toBe("MUDUR_BEKLIYOR");
  });

  it("2. adımda takım lideri hedef → deg2 EKLENMEZ (adım zaten var)", () => {
    const s = yonlendirmeAkisDuzeltmesi({ ...IKI, rol: "TAKIM_LIDERI", durum: "MUDUR_BEKLIYOR" });
    expect(s.eklenenDeg2).toBeNull();
    expect(s.onaylayanId).toBe("mudur"); // müdür yrd.-dışı rol → müdür onaylar
  });
});
