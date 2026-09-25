// @vitest-environment node
import { describe, it, expect, vi, afterAll } from "vitest";
import fs from "fs/promises";
import path from "path";
import { renderCertificateHtml } from "./certificate-template";

const ORNEK = {
  adSoyad: "Ayşe Şıkğüöç Çelik",
  egitimAdi: "Rekabet Hukuku Farkındalık Eğitimi",
  tarih: "25 Eylül 2026",
  sertifikaNo: "CERT-2026-VITEST3",
  gecerlilik: "Süresiz",
  imzalar: [
    { ad: "Halit İleri", unvan: "Genel Müdür" },
    { ad: "Elif Yıldırım", unvan: "İnsan Varlıkları Müdürü" },
  ],
  qrDataUrl: "data:image/png;base64,QQ==",
  dogrulaUrl: "https://hub.ilerigroup.com/akademi/verify/VITEST-KODU",
};

describe("renderCertificateHtml", () => {
  const html = renderCertificateHtml(ORNEK);

  it("tek sayfa A4 yatay + self-contained (dış URL yok)", () => {
    expect(html).toContain("@page { size: 297mm 210mm; margin: 0; }");
    // Dış kaynak yok: http(s) ile başlayan src/href olmamalı (yalnız data: ve metin)
    expect(/src=['"]https?:\/\//.test(html)).toBe(false);
  });

  it("4 font ailesi @font-face olarak base64 gömülü", () => {
    for (const fam of [
      "Cormorant Garamond",
      "Great Vibes",
      "Archivo",
      "IBM Plex Sans",
    ]) {
      expect(html).toContain(`font-family: '${fam}'`);
    }
    const faceSayisi = (html.match(/@font-face/g) || []).length;
    expect(faceSayisi).toBeGreaterThanOrEqual(5);
    expect(html).toContain("data:font/woff2;base64,");
  });

  it("iki logo base64 gömülü", () => {
    const logoSayisi = (html.match(/data:image\/png;base64,/g) || []).length;
    // 2 logo (+ qrDataUrl PNG data). En az 2 logo beklenir.
    expect(logoSayisi).toBeGreaterThanOrEqual(2);
  });

  it("içerik alanları (ad, eğitim, no, doğrulama, imzalar) yerinde", () => {
    expect(html).toContain("SERTİFİKA");
    expect(html).toContain("Ayşe Şıkğüöç Çelik");
    expect(html).toContain("Rekabet Hukuku Farkındalık Eğitimi");
    expect(html).toContain("CERT-2026-VITEST3");
    expect(html).toContain("akademi/verify/VITEST-KODU");
    expect(html).toContain("Halit İleri");
    expect(html).toContain("İnsan Varlıkları Müdürü");
  });

  it("HTML escape — enjeksiyon güvenliği", () => {
    const kotu = renderCertificateHtml({
      ...ORNEK,
      adSoyad: '<script>alert(1)</script>',
    });
    expect(kotu).not.toContain("<script>alert(1)</script>");
    expect(kotu).toContain("&lt;script&gt;");
  });
});

// PDF üretimi Chromium gerektirir → CHROMIUM_PATH yoksa atla (CI'da kırılmasın).
const chromiumVar = !!process.env.CHROMIUM_PATH;
describe.skipIf(!chromiumVar)("generateCertificatePdf (Chromium)", () => {
  vi.mock("@/lib/prisma", () => ({
    prisma: {
      akademiCertificateTemplate: { findUnique: async () => null },
    },
  }));

  const CERT_NO = "CERT-2026-VITESTPDF";
  const outPath = path.join(
    process.cwd(),
    "public",
    "uploads",
    "akademi",
    "certificates",
    `${CERT_NO}.pdf`
  );
  afterAll(async () => {
    await fs.rm(outPath, { force: true });
  });

  it("Chromium ile PDF üretir, fontlar gömülü, metin okunuyor", async () => {
    const { generateCertificatePdf } = await import("./certificate-pdf");
    const rel = await generateCertificatePdf({
      certificateNo: CERT_NO,
      verificationCode: "VITESTPDF-KODU",
      userName: "Ayşe Şıkğüöç Çelik",
      courseName: "Rekabet Hukuku Farkındalık Eğitimi",
      issuedAt: new Date("2026-09-25T10:00:00Z"),
      validUntil: null,
    });
    expect(rel).toBe(`/uploads/akademi/certificates/${CERT_NO}.pdf`);

    const bytes = await fs.readFile(outPath);
    expect(bytes.length).toBeGreaterThan(50_000);
    // Gömülü font akışları (Chromium FontFile2 olarak gömer)
    const raw = bytes.toString("latin1");
    expect(raw).toContain("/FontFile");

    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(bytes),
      disableWorker: true,
    }).promise;
    const tc = await (await doc.getPage(1)).getTextContent();
    const metin = tc.items
      .map((i: unknown) => (i as { str?: string }).str ?? "")
      .join(" ")
      .replace(/\s+/g, " "); // pdfjs kelime arası fazladan boşluk koyar → normalize
    expect(metin).toContain("Rekabet Hukuku");
    expect(metin).toContain("Farkındalık");
  }, 60_000);
});
