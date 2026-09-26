// @vitest-environment node
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { SplitBadge } from "@/components/akademi/SplitBadge";
import {
  buildCourseCardModel,
  sureEtiketi,
  type CourseCardInput,
} from "./course-card-model";

const NOW = new Date("2026-10-01T09:00:00Z");
const base: CourseCardInput = {
  id: "c1",
  title: "Rekabet Hukuku",
  thumbnail: null,
  category: "Zorunlu",
  duration: 30,
  videoCount: 1,
  examQuestionCount: 15,
  progressPercent: 0,
  isCompleted: false,
  dueDate: null,
  assignedAt: null,
};

describe("buildCourseCardModel — durum → renk", () => {
  it("başlanmadı (progress 0) → kırmızı Başla", () => {
    const m = buildCourseCardModel({ ...base }, NOW);
    expect(m.badge.color).toBe("red");
    expect(m.badge.left).toBe("Zorunlu");
    expect(m.badge.right).toBe("Başla");
    expect(m.badge.href).toBe("/akademi/courses/c1");
  });

  it("devam eden (0<progress<100) → mavi %NN Devam et", () => {
    const m = buildCourseCardModel({ ...base, progressPercent: 45 }, NOW);
    expect(m.badge.color).toBe("blue");
    expect(m.badge.left).toBe("%45");
    expect(m.badge.right).toBe("Devam et");
  });

  it("tamamlandı → yeşil Sertifika (→ /akademi/certificates)", () => {
    const m = buildCourseCardModel(
      { ...base, progressPercent: 100, isCompleted: true },
      NOW
    );
    expect(m.badge.color).toBe("green");
    expect(m.badge.left).toBe("Tamamlandı");
    expect(m.badge.right).toBe("Sertifika");
    expect(m.badge.href).toBe("/akademi/certificates");
    expect(m.tag).toEqual({ label: "Tamamlandı", color: "green" });
    expect(m.due).toEqual({ label: "Sertifika hazır", warn: false });
  });

  it("son tarih ≤3 gün → amber 'N gün kaldı' + uyarı", () => {
    const m = buildCourseCardModel(
      { ...base, progressPercent: 10, dueDate: "2026-10-03T20:59:59.999Z" },
      NOW
    );
    expect(m.badge.color).toBe("amber");
    expect(m.badge.left).toBe("2 gün kaldı");
    expect(m.due?.warn).toBe(true);
  });

  it("meta satırı gerçek sayılardan + Zorunlu etiketi", () => {
    const m = buildCourseCardModel({ ...base }, NOW);
    expect(m.metaLine).toBe("Zorunlu · 1 video · 15 soru sınav");
    expect(m.tag).toEqual({ label: "Zorunlu", color: "red" });
  });
});

describe("sureEtiketi", () => {
  it("dakika → okunur süre", () => {
    expect(sureEtiketi(30)).toBe("30 dk");
    expect(sureEtiketi(70)).toBe("1 sa 10 dk");
    expect(sureEtiketi(120)).toBe("2 sa");
    expect(sureEtiketi(0)).toBeNull();
    expect(sureEtiketi(null)).toBeNull();
  });
});

describe("SplitBadge render", () => {
  it("iki parça + href + renk sınıfı", () => {
    const html = renderToStaticMarkup(
      createElement(SplitBadge, {
        color: "blue",
        left: "%45",
        right: "Devam et",
        href: "/akademi/courses/c1",
      })
    );
    expect(html).toContain("%45");
    expect(html).toContain("Devam et");
    expect(html).toContain('href="/akademi/courses/c1"');
    expect(html).toContain("bg-[#2563eb]"); // mavi
    expect(html).toContain("↗");
  });

  it("renk → sınıf eşlemesi (4 renk)", () => {
    const cases: Array<[string, string]> = [
      ["red", "bg-[#dc2626]"],
      ["blue", "bg-[#2563eb]"],
      ["green", "bg-[#16a34a]"],
      ["amber", "bg-[#d97706]"],
    ];
    for (const [color, cls] of cases) {
      const html = renderToStaticMarkup(
        createElement(SplitBadge, {
          color: color as "red" | "blue" | "green" | "amber",
          left: "x",
          right: "y",
          href: "/z",
        })
      );
      expect(html).toContain(cls);
    }
  });
});
