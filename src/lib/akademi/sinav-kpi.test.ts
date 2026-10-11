import { describe, expect, it } from "vitest";
import {
  kisiDurumu,
  puanDagilimi,
  sinavKpiHesapla,
  type SinavDenemeGirdi,
} from "./sinav-kpi";

const d = (
  userId: string,
  status: string,
  passed: boolean | null = null,
  score: number | null = null
): SinavDenemeGirdi => ({ userId, status, passed, score });

describe("kisiDurumu", () => {
  it("tamamlanmış ve geçmiş deneme → GECTI", () => {
    expect(kisiDurumu([d("u1", "COMPLETED", true, 80)])).toBe("GECTI");
  });

  it("önce kalmış sonra geçmiş → GECTI (en iyi sonuç sayılır)", () => {
    expect(
      kisiDurumu([
        d("u1", "COMPLETED", false, 40),
        d("u1", "COMPLETED", true, 85),
      ])
    ).toBe("GECTI");
  });

  it("tamamlanmış ama hiçbiri geçmemiş → KALDI", () => {
    expect(
      kisiDurumu([
        d("u1", "COMPLETED", false, 30),
        d("u1", "COMPLETED", false, 55),
      ])
    ).toBe("KALDI");
  });

  it("yalnız devam eden deneme → DEVAM", () => {
    expect(kisiDurumu([d("u1", "IN_PROGRESS")])).toBe("DEVAM");
    expect(kisiDurumu([d("u1", "PENDING_REVIEW")])).toBe("DEVAM");
    expect(kisiDurumu([d("u1", "SUBMITTED")])).toBe("DEVAM");
  });

  it("hiç deneme yok → BASLAMADI", () => {
    expect(kisiDurumu([])).toBe("BASLAMADI");
  });

  it("yalnız EXPIRED deneme → BASLAMADI (iptal deneme sayılmaz)", () => {
    expect(kisiDurumu([d("u1", "EXPIRED")])).toBe("BASLAMADI");
  });
});

describe("sinavKpiHesapla", () => {
  it("atanan ama hiç girmeyen kişi BASLAMADI sayılır", () => {
    const k = sinavKpiHesapla(["u1", "u2", "u3"], [d("u1", "COMPLETED", true, 90)]);
    expect(k.atanan).toBe(3);
    expect(k.gecti).toBe(1);
    expect(k.baslamadi).toBe(2);
    expect(k.kapsam).toBe(3);
  });

  it("her kişi tek durumda sayılır — toplam kapsama eşit", () => {
    const k = sinavKpiHesapla(
      ["u1", "u2", "u3", "u4"],
      [
        d("u1", "COMPLETED", true, 90),
        d("u2", "COMPLETED", false, 20),
        d("u2", "COMPLETED", false, 45),
        d("u3", "IN_PROGRESS"),
      ]
    );
    expect(k.gecti + k.kaldi + k.devam + k.baslamadi).toBe(k.kapsam);
    expect(k).toMatchObject({ gecti: 1, kaldi: 1, devam: 1, baslamadi: 1 });
  });

  it("atanmadan sınava giren kişi kapsama eklenir", () => {
    const k = sinavKpiHesapla(["u1"], [d("u9", "COMPLETED", true, 75)]);
    expect(k.atanan).toBe(1);
    expect(k.kapsam).toBe(2);
    expect(k.gecti).toBe(1);
    expect(k.baslamadi).toBe(1);
  });

  it("çok denemeli kişi atanan sayısını şişirmez", () => {
    const k = sinavKpiHesapla(
      ["u1"],
      [d("u1", "COMPLETED", false, 10), d("u1", "COMPLETED", true, 95)]
    );
    expect(k.atanan).toBe(1);
    expect(k.kapsam).toBe(1);
    expect(k.toplamDeneme).toBe(2);
  });

  it("başarı oranı yalnız tamamlayanlar üzerinden — girmeyenler paydada yok", () => {
    const k = sinavKpiHesapla(
      ["u1", "u2", "u3", "u4"],
      [d("u1", "COMPLETED", true, 80), d("u2", "COMPLETED", false, 30)]
    );
    expect(k.basariOrani).toBe(50);
  });

  it("hiç tamamlanmış deneme yoksa oran ve puan null", () => {
    const k = sinavKpiHesapla(["u1"], []);
    expect(k.basariOrani).toBeNull();
    expect(k.ortPuan).toBeNull();
  });

  it("ortalama puan yalnız tamamlanmış denemelerden", () => {
    const k = sinavKpiHesapla(
      ["u1", "u2"],
      [
        d("u1", "COMPLETED", true, 80),
        d("u2", "COMPLETED", false, 40),
        d("u2", "IN_PROGRESS", null, null),
      ]
    );
    expect(k.ortPuan).toBe(60);
  });

  it("atama yok, deneme yok → hepsi sıfır", () => {
    const k = sinavKpiHesapla([], []);
    expect(k).toMatchObject({ atanan: 0, kapsam: 0, gecti: 0, baslamadi: 0 });
  });
});

describe("puanDagilimi", () => {
  it("tamamlanmış denemeleri 10'luk kovalara koyar", () => {
    const dag = puanDagilimi([
      d("u1", "COMPLETED", true, 95),
      d("u2", "COMPLETED", true, 92),
      d("u3", "COMPLETED", false, 45),
    ]);
    expect(dag.find((x) => x.aralik === "90-100")?.adet).toBe(2);
    expect(dag.find((x) => x.aralik === "40-49")?.adet).toBe(1);
  });

  it("100 puan son kovaya düşer, taşmaz", () => {
    const dag = puanDagilimi([d("u1", "COMPLETED", true, 100)]);
    expect(dag).toHaveLength(10);
    expect(dag[9].adet).toBe(1);
  });

  it("tamamlanmamış ve puansız denemeler sayılmaz", () => {
    const dag = puanDagilimi([
      d("u1", "IN_PROGRESS", null, null),
      d("u2", "COMPLETED", true, null),
    ]);
    expect(dag.reduce((t, x) => t + x.adet, 0)).toBe(0);
  });
});
