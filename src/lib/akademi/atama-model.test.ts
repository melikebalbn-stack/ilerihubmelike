// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  kursZorunluMu,
  siniflandirDurum,
  atamaKpiHesap,
  kursAra,
  previewHesap,
} from "./atama-model";
import { audienceWhere } from "./atama-audience";

const NOW = new Date("2026-09-27T12:00:00Z");

describe("kursZorunluMu", () => {
  it("kategori 'Zorunlu' (normalizeTr) → zorunlu", () => {
    expect(kursZorunluMu("Zorunlu")).toBe(true);
    expect(kursZorunluMu("ZORUNLU")).toBe(true);
    expect(kursZorunluMu("Genel")).toBe(false);
    expect(kursZorunluMu(null)).toBe(false);
  });
});

describe("siniflandirDurum", () => {
  it("tamamlandı → BITTI", () => {
    expect(siniflandirDurum({ progressPercent: 100, isCompleted: true, dueDate: "2020-01-01" }, NOW)).toBe("BITTI");
  });
  it("tamamlanmadı + son tarih geçmiş → GECIKTI (başlamamış olsa bile)", () => {
    expect(siniflandirDurum({ progressPercent: 0, isCompleted: false, dueDate: "2026-09-01" }, NOW)).toBe("GECIKTI");
    expect(siniflandirDurum({ progressPercent: 40, isCompleted: false, dueDate: "2026-09-01" }, NOW)).toBe("GECIKTI");
  });
  it("ilerleme var, süre geçmemiş → DEVAM", () => {
    expect(siniflandirDurum({ progressPercent: 40, isCompleted: false, dueDate: "2026-12-01" }, NOW)).toBe("DEVAM");
  });
  it("ilerleme yok, süresiz → BASLAMADI", () => {
    expect(siniflandirDurum({ progressPercent: 0, isCompleted: false, dueDate: null }, NOW)).toBe("BASLAMADI");
  });
});

describe("atamaKpiHesap", () => {
  it("atamalı kurs / toplam / gecikmiş / tamamlanma %", () => {
    const rows = [
      { courseId: "a", isCompleted: true, dueDate: "2026-09-01" },
      { courseId: "a", isCompleted: false, dueDate: "2026-09-01" }, // gecikmiş
      { courseId: "b", isCompleted: false, dueDate: "2026-12-01" }, // devam, gecikmemiş
      { courseId: "b", isCompleted: true, dueDate: null },
    ];
    expect(atamaKpiHesap(rows, NOW)).toEqual({
      atamaliKurs: 2,
      toplamAtama: 4,
      gecikmis: 1,
      tamamlanmaYuzde: 50,
    });
  });
  it("boş → sıfır", () => {
    expect(atamaKpiHesap([], NOW)).toEqual({ atamaliKurs: 0, toplamAtama: 0, gecikmis: 0, tamamlanmaYuzde: 0 });
  });
});

describe("kursAra (normalizeTr, ad + kategori)", () => {
  const kurslar = [
    { title: "İş Güvenliği", category: "Zorunlu" },
    { title: "Rekabet Hukuku", category: "Hukuk" },
  ];
  it("ada göre Türkçe toleranslı", () => {
    expect(kursAra(kurslar, "is guvenligi").map((k) => k.title)).toEqual(["İş Güvenliği"]);
  });
  it("kategoriye göre", () => {
    expect(kursAra(kurslar, "zorunlu").map((k) => k.title)).toEqual(["İş Güvenliği"]);
  });
  it("boş sorgu hepsini döndürür", () => {
    expect(kursAra(kurslar, "  ")).toHaveLength(2);
  });
});

describe("previewHesap (yaka+departman kesişimi sonrası atanmış düşme)", () => {
  it("audience ∖ atanmış = atanacak; kesişim = zaten", () => {
    const audience = ["u1", "u2", "u3", "u3"]; // u3 tekrarlı
    const atanmis = ["u2", "u9"];
    expect(previewHesap(audience, atanmis)).toEqual({ atanacak: 2, zatenAtanmis: 1 });
  });
  it("hepsi atanmışsa atanacak 0", () => {
    expect(previewHesap(["a", "b"], ["a", "b", "c"])).toEqual({ atanacak: 0, zatenAtanmis: 2 });
  });
});

describe("audienceWhere (segment → where)", () => {
  it("kişi seçimi → id in", () => {
    expect(audienceWhere({ userIds: ["u1", "u2"] })).toEqual({ isActive: true, id: { in: ["u1", "u2"] } });
  });
  it("tüm şirket → isActive", () => {
    expect(audienceWhere({ tumSirket: true })).toEqual({ isActive: true });
  });
  it("yaka + departman BİRLİKTE daraltır (AND, aktif personel)", () => {
    expect(audienceWhere({ yakalar: ["MAVI", "GRI"], departmanlar: ["Üretim"] })).toEqual({
      isActive: true,
      personnel: { aktif: true, yakaRengi: { in: ["MAVI", "GRI"] }, bolum: { in: ["Üretim"] } },
    });
  });
  it("yalnız yaka", () => {
    expect(audienceWhere({ yakalar: ["BEYAZ"] })).toEqual({
      isActive: true,
      personnel: { aktif: true, yakaRengi: { in: ["BEYAZ"] } },
    });
  });
  it("filtre yok → tüm şirket", () => {
    expect(audienceWhere({})).toEqual({ isActive: true });
  });
});
