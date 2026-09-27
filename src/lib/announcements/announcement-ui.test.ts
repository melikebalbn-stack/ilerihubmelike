// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  announcementsKpi,
  canClosePopup,
  categoryColor,
  categoryLabel,
  cardBadge,
  heroBadge,
  selectPendingPopups,
  buildCategoryChips,
  matchesSearch,
  readingTimeMin,
  DEFAULT_CATEGORY_COLOR,
} from "./announcement-ui";

describe("categoryColor", () => {
  it("category.color varsa onu kullanır", () => {
    expect(categoryColor({ name: "Kalite", color: "#123456" })).toBe("#123456");
  });
  it("color yoksa ada göre eşler (normalizeTr, İ/ı toleranslı)", () => {
    expect(categoryColor({ name: "İnsan Varlıkları" })).toBe("#7c3aed");
    expect(categoryColor({ name: "IT" })).toBe("#0891b2");
    expect(categoryColor({ name: "Kalite" })).toBe("#dc2626");
    expect(categoryColor({ name: "Üretim" })).toBe("#ea580c");
    expect(categoryColor({ name: "Sosyal" })).toBe("#16a34a");
    expect(categoryColor({ name: "Genel" })).toBe("#1A5AA0");
  });
  it("bilinmeyen/null → default lacivert", () => {
    expect(categoryColor({ name: "Zübük" })).toBe(DEFAULT_CATEGORY_COLOR);
    expect(categoryColor(null)).toBe(DEFAULT_CATEGORY_COLOR);
  });
  it("categoryLabel null → 'Genel'", () => {
    expect(categoryLabel(null)).toBe("Genel");
    expect(categoryLabel({ name: "IT" })).toBe("IT");
  });
});

describe("announcementsKpi", () => {
  const NOW = new Date("2026-09-15T10:00:00Z");
  it("toplam / okunmamış / bu ay / sabitlenmiş", () => {
    const items = [
      { isRead: false, isPinned: true, publishedAt: "2026-09-01T00:00:00Z" }, // unread, pinned, bu ay
      { isRead: true, isPinned: false, publishedAt: "2026-09-10T00:00:00Z" }, // bu ay
      { isRead: false, isPinned: false, publishedAt: "2026-08-20T00:00:00Z" }, // unread, geçen ay
      { isRead: true, isPinned: false, createdAt: "2026-09-14T00:00:00Z" }, // bu ay (createdAt fallback)
    ];
    expect(announcementsKpi(items, NOW)).toEqual({
      total: 4,
      unread: 2,
      thisMonth: 3,
      pinned: 1,
    });
  });
});

describe("selectPendingPopups — görülmemiş seçimi", () => {
  it("seen=true olanlar listede YOK; seen=false EN YENİ önce", () => {
    const out = selectPendingPopups([
      { id: "eski", seen: false, publishedAt: "2026-09-01" },
      { id: "gorulmus", seen: true, publishedAt: "2026-09-20" },
      { id: "yeni", seen: false, publishedAt: "2026-09-10" },
    ]);
    expect(out.map((x) => x.id)).toEqual(["yeni", "eski"]);
  });
  it("hepsi görülmüşse boş", () => {
    expect(selectPendingPopups([{ id: "a", seen: true }])).toEqual([]);
  });
});

describe("canClosePopup — onayZorunlu kapatma kuralı", () => {
  it("onay zorunlu + işaretsiz → kapanamaz", () => {
    expect(canClosePopup(true, false)).toBe(false);
  });
  it("onay zorunlu + işaretli → kapanır", () => {
    expect(canClosePopup(true, true)).toBe(true);
  });
  it("onay zorunlu değil → her zaman kapanır", () => {
    expect(canClosePopup(false, false)).toBe(true);
  });
});

describe("cardBadge / heroBadge", () => {
  it("okunmamış: kart kırmızı 'Yeni|Oku', hero cyan 'Yeni|Duyuruyu oku'", () => {
    expect(cardBadge(false)).toEqual({ color: "red", left: "Yeni", right: "Oku" });
    expect(heroBadge(false)).toEqual({ color: "cyan", left: "Yeni", right: "Duyuruyu oku" });
  });
  it("okunmuş: her ikisi gri 'Okundu|Aç'", () => {
    expect(cardBadge(true)).toEqual({ color: "gray", left: "Okundu", right: "Aç" });
    expect(heroBadge(true)).toEqual({ color: "gray", left: "Okundu", right: "Aç" });
  });
});

describe("buildCategoryChips", () => {
  it("Tümü + kategori sayıları + renk", () => {
    const items = [
      { category: { id: "c1", name: "IT" } },
      { category: { id: "c1", name: "IT" } },
      { category: { id: "c2", name: "Kalite" } },
    ];
    const cats = [
      { id: "c1", name: "IT", color: null },
      { id: "c2", name: "Kalite", color: "#dc2626" },
    ];
    const chips = buildCategoryChips(items, cats);
    expect(chips[0]).toEqual({ id: "all", label: "Tümü", count: 3 });
    expect(chips.find((c) => c.id === "c1")).toMatchObject({ label: "IT", count: 2, color: "#0891b2" });
    expect(chips.find((c) => c.id === "c2")).toMatchObject({ label: "Kalite", count: 1, color: "#dc2626" });
  });
});

describe("matchesSearch (normalizeTr)", () => {
  it("Türkçe büyük/küçük ve İ toleranslı", () => {
    expect(matchesSearch({ title: "İzin Talebi" }, "izin")).toBe(true);
    expect(matchesSearch({ title: "Bordro", summary: "Maaş" }, "maas")).toBe(true);
    expect(matchesSearch({ title: "Bordro" }, "xyz")).toBe(false);
  });
  it("boş arama her şeyi geçer", () => {
    expect(matchesSearch({ title: "x" }, "  ")).toBe(true);
  });
});

describe("readingTimeMin", () => {
  it("HTML strip + min 1 dk", () => {
    expect(readingTimeMin("<p>kısa</p>")).toBe(1);
    expect(readingTimeMin("")).toBe(1);
    expect(readingTimeMin(null)).toBe(1);
    const long = "<p>" + "kelime ".repeat(600) + "</p>";
    expect(readingTimeMin(long)).toBe(3);
  });
});
