import { chromium } from "playwright-core";
import QRCode from "qrcode";
import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import {
  renderCertificateHtml,
  type CertificateSignature,
} from "./certificate-template";

type CertificateData = {
  certificateNo: string;
  verificationCode: string;
  userName: string;
  courseName: string;
  issuedAt: Date;
  validUntil?: Date | null;
  templateId?: string | null;
};

const STORAGE_DIR = path.join(
  process.cwd(),
  "public",
  "uploads",
  "akademi",
  "certificates"
);

// Sabit imzalar — AkademiCertificateTemplate şemasında imza alanı YOK, bu yüzden
// şimdilik sabit (bkz. commit notu). Şablona alan eklenirse buraya taşınır.
const SABIT_IMZALAR: CertificateSignature[] = [
  { ad: "Halit İleri", unvan: "Genel Müdür" },
  { ad: "Elif Yıldırım", unvan: "İnsan Varlıkları Müdürü" },
];

function trTarih(d: Date): string {
  return d.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * Chromium çalıştırılabilir yolu — prod'da PM2 env'inde CHROMIUM_PATH set edilir
 * (ör. Playwright chromium_headless_shell). Yol yoksa AÇIK hata; sessiz fallback YOK.
 */
function chromiumExecutable(): string {
  const p = process.env.CHROMIUM_PATH;
  if (!p) {
    throw new Error(
      "CHROMIUM_PATH tanımlı değil — sertifika PDF'i Chromium (HTML→PDF) ile üretilir; " +
        "sunucudaki Chromium yolunu CHROMIUM_PATH env'ine yazın."
    );
  }
  return p;
}

export async function generateCertificatePdf(
  data: CertificateData
): Promise<string> {
  await fs.mkdir(STORAGE_DIR, { recursive: true });

  // (Şablon rengi/logosu için ileride kullanılabilir; imza alanı yok → sabit.)
  if (data.templateId) {
    await prisma.akademiCertificateTemplate
      .findUnique({ where: { id: data.templateId } })
      .catch(() => null);
  }

  const baseUrl = (
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://hub.ilerigroup.com"
  ).replace(/\/+$/, "");
  const dogrulaUrl = `${baseUrl}/akademi/verify/${data.verificationCode}`;
  const qrDataUrl = await QRCode.toDataURL(dogrulaUrl, { width: 240, margin: 1 });

  const html = renderCertificateHtml({
    adSoyad: data.userName,
    egitimAdi: data.courseName,
    tarih: trTarih(data.issuedAt),
    sertifikaNo: data.certificateNo,
    gecerlilik: data.validUntil ? trTarih(data.validUntil) : "Süresiz",
    imzalar: SABIT_IMZALAR,
    qrDataUrl,
    dogrulaUrl,
  });

  const executablePath = chromiumExecutable();
  // Chromium sistem kütüphaneleri PATH'te değilse CHROMIUM_LD_LIBRARY_PATH ile
  // tarayıcı sürecine geçirilir (paketlenmemiş sunucularda gerekli).
  const ldPath = process.env.CHROMIUM_LD_LIBRARY_PATH;
  const browser = await chromium.launch({
    executablePath,
    args: ["--no-sandbox"],
    ...(ldPath
      ? { env: { ...process.env, LD_LIBRARY_PATH: ldPath } as NodeJS.ProcessEnv }
      : {}),
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      width: "297mm",
      height: "210mm",
      printBackground: true,
      preferCSSPageSize: true,
    });
    const fileName = `${data.certificateNo}.pdf`;
    const fullPath = path.join(STORAGE_DIR, fileName);
    await fs.writeFile(fullPath, pdf);
    return `/uploads/akademi/certificates/${fileName}`;
  } finally {
    await browser.close();
  }
}
