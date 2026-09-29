import { describe, expect, it } from "vitest";
import {
  geriAlinabilirMi, adimBeklemeDurumu, geriAlmaSonrasiPuanlar, type GeriAlinacakForm,
} from "./deneme-puan-geri-alma";
import { denemeOrtalama, denemeBasariliMi } from "./deneme-transitions";

/**
 * 29.09.2026 vakası: Bedri Güler, Fatma Topkara'nın 6 ay formunu 49 puanla
 * gönderdi (yanlış), form MUDUR_BEKLIYOR'a geçti ve düzeltilemedi — yönlendirme
 * ucu "puanlanmış adım yönlendirilemez" diyor. Geri alma bu boşluğu kapatır.
 */

const TEMEL: GeriAlinacakForm = {
  durum: "MUDUR_BEKLIYOR",
  degerlendirici1At: new Date("2026-09-25T11:20:34Z"),
  degerlendirici2At: null,
  degerlendirici2Id: "p-samet",
  degerlendirici2Rol: "MUDUR",
  puanSatirSayisi: { sira1: 20, sira2: 0 },
};
const f = (over: Partial<GeriAlinacakForm> = {}): GeriAlinacakForm => ({ ...TEMEL, ...over });

describe("geriAlinabilirMi", () => {
  it("gönderilmiş 1. adım geri alınabilir → DEGERLENDIRICI1_BEKLIYOR", () => {
    expect(geriAlinabilirMi(1, f())).toEqual({ ok: true, hedefDurum: "DEGERLENDIRICI1_BEKLIYOR" });
  });

  it("SONRAKİ adım puanlıysa 1. adım geri ALINAMAZ (damgadan)", () => {
    const r = geriAlinabilirMi(1, f({ degerlendirici2At: new Date(), durum: "IK_BEKLIYOR" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.sebep).toContain("2. değerlendirici puan girmiş");
  });

  it("SONRAKİ adımda yalnız TASLAK puan satırı olsa bile geri ALINAMAZ", () => {
    const r = geriAlinabilirMi(1, f({ puanSatirSayisi: { sira1: 20, sira2: 6 } }));
    expect(r.ok).toBe(false);
  });

  it("damga yoksa (yalnız taslak) geri alınacak puan yoktur", () => {
    const r = geriAlinabilirMi(1, f({ degerlendirici1At: null }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.sebep).toContain("henüz göndermemiş");
  });

  it("kapalı formda geri alma yok", () => {
    for (const durum of ["TAMAMLANDI", "IPTAL"] as const) {
      const r = geriAlinabilirMi(1, f({ durum }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.sebep).toContain("Kapanmış");
    }
  });

  it("2. adım: müdür yrd. ise MUDUR_YRD_BEKLIYOR'a döner", () => {
    const r = geriAlinabilirMi(2, f({
      durum: "ONAY_BEKLIYOR", degerlendirici2At: new Date(),
      degerlendirici2Rol: "MUDUR_YARDIMCISI", puanSatirSayisi: { sira1: 20, sira2: 20 },
    }));
    expect(r).toEqual({ ok: true, hedefDurum: "MUDUR_YRD_BEKLIYOR" });
  });

  it("2. adım: müdür ise MUDUR_BEKLIYOR'a döner", () => {
    const r = geriAlinabilirMi(2, f({
      durum: "IK_BEKLIYOR", degerlendirici2At: new Date(),
      degerlendirici2Rol: "MUDUR", puanSatirSayisi: { sira1: 20, sira2: 20 },
    }));
    expect(r).toEqual({ ok: true, hedefDurum: "MUDUR_BEKLIYOR" });
  });

  it("tek puanlı yakada 2. adım yok", () => {
    const r = geriAlinabilirMi(2, f({ degerlendirici2Id: null }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.sebep).toContain("2. değerlendirici adımı yok");
  });

  it("2. adım geri alınırken 1. adımın puanlı olması ENGEL DEĞİL", () => {
    const r = geriAlinabilirMi(2, f({
      degerlendirici2At: new Date(), puanSatirSayisi: { sira1: 20, sira2: 20 },
    }));
    expect(r.ok).toBe(true);
  });
});

describe("adimBeklemeDurumu", () => {
  it("1. sıra her zaman DEGERLENDIRICI1_BEKLIYOR", () => {
    expect(adimBeklemeDurumu(1, "MUDUR")).toBe("DEGERLENDIRICI1_BEKLIYOR");
    expect(adimBeklemeDurumu(1, null)).toBe("DEGERLENDIRICI1_BEKLIYOR");
  });
  it("2. sıra role göre", () => {
    expect(adimBeklemeDurumu(2, "MUDUR_YARDIMCISI")).toBe("MUDUR_YRD_BEKLIYOR");
    expect(adimBeklemeDurumu(2, "MUDUR")).toBe("MUDUR_BEKLIYOR");
    expect(adimBeklemeDurumu(2, null)).toBe("MUDUR_BEKLIYOR");
  });
});

describe("geri alma sonrası puan/ortalama/başarılı", () => {
  it("1. puan silinince tek başına kalan 2. puan ortalamadır", () => {
    const y = geriAlmaSonrasiPuanlar(1, { puan1: 49, puan2: 80 });
    expect(y).toEqual({ puan1: null, puan2: 80 });
    const ort = denemeOrtalama(y.puan1, y.puan2);
    expect(ort).toBe(80);
    expect(denemeBasariliMi(ort)).toBe(true);
  });

  it("tek puan geri alınınca ortalama ve başarılı NULL olur", () => {
    const y = geriAlmaSonrasiPuanlar(1, { puan1: 49, puan2: null });
    expect(y).toEqual({ puan1: null, puan2: null });
    const ort = denemeOrtalama(y.puan1, y.puan2);
    expect(ort).toBeNull();
    expect(denemeBasariliMi(ort)).toBeNull();
  });

  it("2. puan geri alınınca 1. puan korunur (Fatma vakası tersi)", () => {
    const y = geriAlmaSonrasiPuanlar(2, { puan1: 49, puan2: 70 });
    expect(y).toEqual({ puan1: 49, puan2: null });
    expect(denemeOrtalama(y.puan1, y.puan2)).toBe(49);
    expect(denemeBasariliMi(49)).toBe(false);
  });
});
