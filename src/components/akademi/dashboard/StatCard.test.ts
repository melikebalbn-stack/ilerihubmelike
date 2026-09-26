// @vitest-environment node
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { StatCard } from "./StatCard";
import { SplitBadge } from "@/components/akademi/SplitBadge";

describe("StatCard — compact (courses/exams KPI)", () => {
  const html = renderToStaticMarkup(
    createElement(StatCard, {
      compact: true,
      icon: "bookOpen",
      label: "Toplam Eğitim",
      value: 12,
      color: "accent",
    })
  );

  it("sayı + etiketi gösterir", () => {
    expect(html).toContain("12");
    expect(html).toContain("Toplam Eğitim");
  });

  it("ikon kutusu YOK (yükseklik ~yarıya iner)", () => {
    expect(html).not.toContain("w-10 h-10");
    expect(html).not.toContain("-glow"); // ikon arka planı yok
    expect(html).not.toContain("<svg");
  });

  it("tek satır: sayı + etiket yan yana", () => {
    expect(html).toContain("items-baseline");
    expect(html).toContain("justify-between");
  });

  it("padding ana sayfayla aynı (p-5)", () => {
    expect(html).toContain("p-5");
  });

  it("sayı renk kimliğini korur (ikon yok → sayı renkli)", () => {
    expect(html).toContain("var(--ak-accent)");
  });

  it("suffix (ör. %) render edilir", () => {
    const withSuffix = renderToStaticMarkup(
      createElement(StatCard, {
        compact: true,
        icon: "trophy",
        label: "Ortalama Puan",
        value: 80,
        suffix: "%",
        color: "accent",
      })
    );
    expect(withSuffix).toContain("80%");
  });
});

describe("StatCard — default (ana sayfa DEĞİŞMEZ)", () => {
  const html = renderToStaticMarkup(
    createElement(StatCard, {
      icon: "bookOpen",
      label: "Toplam Eğitim",
      value: 12,
      color: "accent",
    })
  );

  it("ikon kutusu KORUNUR", () => {
    expect(html).toContain("w-10 h-10");
    expect(html).toContain("<svg");
  });

  it("compact düzeni kullanmaz", () => {
    expect(html).not.toContain("items-baseline");
  });
});

describe("SplitBadge — download (PDF İndir) overlay fix", () => {
  const html = renderToStaticMarkup(
    createElement(SplitBadge, {
      color: "green",
      left: "Geçerli",
      right: "PDF İndir",
      href: "/api/akademi/certificates/cert1/download",
      download: true,
    })
  );

  it("düz <a>, DAİMA yeni sekme (target=_blank + rel=noopener), download", () => {
    expect(html).toContain("<a");
    expect(html).toContain('target="_blank"');
    expect(html).toContain("noopener");
    expect(html).toContain("download");
    expect(html).toContain('href="/api/akademi/certificates/cert1/download"');
  });

  it("next/link'e (soft-nav/prefetch) düşmez", () => {
    // düz <a> render'ında next/link'in eklediği data-* öznitelikleri olmaz
    expect(html).not.toContain("router");
  });
});
