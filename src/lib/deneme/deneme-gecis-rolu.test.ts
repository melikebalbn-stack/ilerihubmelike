// IV-FR-27 — 1. adımın geçiş rolü ve matris kapsamı.
//
// 30.09.2026 hatası: `adimSahibiRol` 1. adımda HER ZAMAN TAKIM_LIDERI
// döndürüyordu; gri/beyaz yakada 1. puanı müdür yrd./müdür verdiği için
// hedef (IK_BEKLIYOR / ONAY_BEKLIYOR) matriste bulunamıyor ve gönderim
// "Bu geçişe izin verilmiyor" ile 400 alıyordu.

import { describe, it, expect } from "vitest";
import { gecisRolu, adimSahibiRol } from "./deneme-yetki";
import { gecisIzinli } from "./deneme-transitions";

describe("gecisRolu", () => {
  it("1. adımda rolü formun degerlendirici1Rol alanından okur", () => {
    expect(gecisRolu("DEGERLENDIRICI1_BEKLIYOR", "TAKIM_LIDERI")).toBe("TAKIM_LIDERI");
    expect(gecisRolu("DEGERLENDIRICI1_BEKLIYOR", "MUDUR_YARDIMCISI")).toBe("MUDUR_YARDIMCISI");
    expect(gecisRolu("DEGERLENDIRICI1_BEKLIYOR", "MUDUR")).toBe("MUDUR");
  });

  it("alan boşsa (eski kayıt) TAKIM_LIDERI varsayar", () => {
    expect(gecisRolu("DEGERLENDIRICI1_BEKLIYOR", null)).toBe("TAKIM_LIDERI");
    expect(gecisRolu("DEGERLENDIRICI1_BEKLIYOR", undefined)).toBe("TAKIM_LIDERI");
  });

  it("1. adım dışındaki adımlarda adimSahibiRol ile aynıdır", () => {
    for (const durum of ["MUDUR_YRD_BEKLIYOR", "MUDUR_BEKLIYOR", "ONAY_BEKLIYOR", "IK_BEKLIYOR", "TASLAK", "TAMAMLANDI", "IPTAL"] as const) {
      expect(gecisRolu(durum, "MUDUR")).toBe(adimSahibiRol(durum));
    }
  });
});

describe("1. adım gönderimi — dört zincir de matristen geçer", () => {
  it("mavi yaka: takım lideri → müdür yrd.", () => {
    expect(gecisIzinli("DEGERLENDIRICI1_BEKLIYOR", gecisRolu("DEGERLENDIRICI1_BEKLIYOR", "TAKIM_LIDERI")!, "MUDUR_YRD_BEKLIYOR")).toBe(true);
  });

  it("mavi yaka: müdür yrd. koltuğu boşsa takım lideri → müdür", () => {
    expect(gecisIzinli("DEGERLENDIRICI1_BEKLIYOR", gecisRolu("DEGERLENDIRICI1_BEKLIYOR", "TAKIM_LIDERI")!, "MUDUR_BEKLIYOR")).toBe(true);
  });

  it("gri yaka: müdür yrd. doldurdu → İK (onay adımı yok)", () => {
    expect(gecisIzinli("DEGERLENDIRICI1_BEKLIYOR", gecisRolu("DEGERLENDIRICI1_BEKLIYOR", "MUDUR_YARDIMCISI")!, "IK_BEKLIYOR")).toBe(true);
  });

  it("beyaz yaka: müdür doldurdu, GMY'ye bağlı → onaya", () => {
    expect(gecisIzinli("DEGERLENDIRICI1_BEKLIYOR", gecisRolu("DEGERLENDIRICI1_BEKLIYOR", "MUDUR")!, "ONAY_BEKLIYOR")).toBe(true);
  });

  it("beyaz yaka: kişi kendi bölümünün müdürü, GMY doldurdu → doğrudan İK (30.09 hatası)", () => {
    expect(gecisIzinli("DEGERLENDIRICI1_BEKLIYOR", gecisRolu("DEGERLENDIRICI1_BEKLIYOR", "MUDUR")!, "IK_BEKLIYOR")).toBe(true);
  });

  it("bölüme özel zincir: müdür yrd. doldurdu → 2. puan müdüre", () => {
    expect(gecisIzinli("DEGERLENDIRICI1_BEKLIYOR", gecisRolu("DEGERLENDIRICI1_BEKLIYOR", "MUDUR_YARDIMCISI")!, "MUDUR_BEKLIYOR")).toBe(true);
  });
});

describe("matris hâlâ deny-by-default", () => {
  it("1. adımdan TAMAMLANDI'ya hiçbir rolle gidilemez", () => {
    for (const rol of ["TAKIM_LIDERI", "MUDUR_YARDIMCISI", "MUDUR"] as const) {
      expect(gecisIzinli("DEGERLENDIRICI1_BEKLIYOR", rol, "TAMAMLANDI")).toBe(false);
    }
  });

  it("takım lideri formu İK'ya ya da onaya atlatamaz", () => {
    expect(gecisIzinli("DEGERLENDIRICI1_BEKLIYOR", "TAKIM_LIDERI", "IK_BEKLIYOR")).toBe(false);
    expect(gecisIzinli("DEGERLENDIRICI1_BEKLIYOR", "TAKIM_LIDERI", "ONAY_BEKLIYOR")).toBe(false);
  });

  it("müdür 1. adımda formu müdür yrd. adımına gönderemez", () => {
    expect(gecisIzinli("DEGERLENDIRICI1_BEKLIYOR", "MUDUR", "MUDUR_YRD_BEKLIYOR")).toBe(false);
  });
});
