import { PDFDocument, rgb, PageSizes } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import fs from "fs/promises";
import path from "path";
import { loadInterFonts } from "./certificate-fonts";
import { prisma } from "@/lib/prisma";

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

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return [0.05, 0.15, 0.35];
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return [
    Number.isFinite(r) ? r : 0,
    Number.isFinite(g) ? g : 0,
    Number.isFinite(b) ? b : 0,
  ];
}

export async function generateCertificatePdf(
  data: CertificateData
): Promise<string> {
  await fs.mkdir(STORAGE_DIR, { recursive: true });

  let template = null;
  if (data.templateId) {
    template = await prisma.akademiCertificateTemplate.findUnique({
      where: { id: data.templateId },
    });
  }
  if (!template) {
    template = await prisma.akademiCertificateTemplate.findFirst({
      where: { isDefault: true },
    });
  }

  const primaryColor = template?.primaryColor || "#0d2659";
  const accentColor = template?.accentColor || "#b38c26";
  const logoPath = template?.logoPath || null;

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fonts = await loadInterFonts();
  const interRegular = await pdfDoc.embedFont(fonts.regular, { subset: true });
  const interBold = await pdfDoc.embedFont(fonts.bold, { subset: true });
  const interItalic = await pdfDoc.embedFont(fonts.italic, { subset: true });

  // A4 landscape (842 x 595)
  const page = pdfDoc.addPage([PageSizes.A4[1], PageSizes.A4[0]]);
  const { width, height } = page.getSize();

  const navy = rgb(...hexToRgb(primaryColor));
  const gold = rgb(...hexToRgb(accentColor));
  const slate = rgb(0.3, 0.3, 0.3);

  // Çerçeveler
  const margin = 30;
  page.drawRectangle({
    x: margin,
    y: margin,
    width: width - 2 * margin,
    height: height - 2 * margin,
    borderColor: navy,
    borderWidth: 3,
  });
  page.drawRectangle({
    x: margin + 12,
    y: margin + 12,
    width: width - 2 * (margin + 12),
    height: height - 2 * (margin + 12),
    borderColor: gold,
    borderWidth: 1,
  });

  // Logo (varsa) — üst orta
  let logoTopOffset = 0;
  if (logoPath) {
    try {
      const logoFullPath = path.join(process.cwd(), "public", logoPath);
      const logoBytes = await fs.readFile(logoFullPath);
      const ext = logoPath.toLowerCase().split(".").pop();
      const logoImage =
        ext === "jpg" || ext === "jpeg"
          ? await pdfDoc.embedJpg(logoBytes)
          : await pdfDoc.embedPng(logoBytes);
      const logoMaxHeight = 60;
      const logoScale = logoMaxHeight / logoImage.height;
      const logoW = logoImage.width * logoScale;
      const logoH = logoImage.height * logoScale;
      page.drawImage(logoImage, {
        x: (width - logoW) / 2,
        y: height - margin - 15 - logoH,
        width: logoW,
        height: logoH,
      });
      logoTopOffset = logoH + 10;
    } catch (e) {
      console.error("[certificate-pdf] Logo embed failed:", e);
    }
  }

  // Başlık: SERTİFİKA (Türkçe!)
  const title = "SERTİFİKA";
  const titleSize = 42;
  const titleWidth = interBold.widthOfTextAtSize(title, titleSize);
  page.drawText(title, {
    x: (width - titleWidth) / 2,
    y: height - 110 - logoTopOffset,
    size: titleSize,
    font: interBold,
    color: navy,
  });

  // Alt başlık: İLERİ AKADEMİ
  const subtitle = "İLERİ AKADEMİ";
  const subSize = 14;
  const subWidth = interRegular.widthOfTextAtSize(subtitle, subSize);
  page.drawText(subtitle, {
    x: (width - subWidth) / 2,
    y: height - 140 - logoTopOffset,
    size: subSize,
    font: interRegular,
    color: gold,
  });

  // Intro
  const intro = "Bu sertifika";
  const introSize = 13;
  const introWidth = interRegular.widthOfTextAtSize(intro, introSize);
  page.drawText(intro, {
    x: (width - introWidth) / 2,
    y: height - 200 - logoTopOffset,
    size: introSize,
    font: interRegular,
    color: slate,
  });

  // Kullanıcı adı
  const userNameSize = 30;
  const userNameWidth = interBold.widthOfTextAtSize(
    data.userName,
    userNameSize
  );
  page.drawText(data.userName, {
    x: (width - userNameWidth) / 2,
    y: height - 245 - logoTopOffset,
    size: userNameSize,
    font: interBold,
    color: navy,
  });

  page.drawLine({
    start: { x: width / 2 - 200, y: height - 255 - logoTopOffset },
    end: { x: width / 2 + 200, y: height - 255 - logoTopOffset },
    color: gold,
    thickness: 1,
  });

  const desc1 =
    "tarafından aşağıdaki kursu başarıyla tamamlandığı için verilmiştir.";
  const descSize = 12;
  const desc1Width = interRegular.widthOfTextAtSize(desc1, descSize);
  page.drawText(desc1, {
    x: (width - desc1Width) / 2,
    y: height - 285 - logoTopOffset,
    size: descSize,
    font: interRegular,
    color: slate,
  });

  // Kurs adı (italik)
  const courseSize = 22;
  const courseWidth = interItalic.widthOfTextAtSize(
    data.courseName,
    courseSize
  );
  page.drawText(data.courseName, {
    x: (width - courseWidth) / 2,
    y: height - 335 - logoTopOffset,
    size: courseSize,
    font: interItalic,
    color: navy,
  });

  // Tarih
  const dateStr = data.issuedAt.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const dateLabel = `Düzenlenme Tarihi: ${dateStr}`;
  const dateSize = 11;
  const dateWidth = interRegular.widthOfTextAtSize(dateLabel, dateSize);
  page.drawText(dateLabel, {
    x: (width - dateWidth) / 2,
    y: height - 380 - logoTopOffset,
    size: dateSize,
    font: interRegular,
    color: slate,
  });

  // Geçerlilik (varsa)
  if (data.validUntil) {
    const validStr = data.validUntil.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const validLabel = `Geçerlilik Tarihi: ${validStr}`;
    const validWidth = interRegular.widthOfTextAtSize(validLabel, dateSize);
    page.drawText(validLabel, {
      x: (width - validWidth) / 2,
      y: height - 398 - logoTopOffset,
      size: dateSize,
      font: interRegular,
      color: slate,
    });
  }

  // Alt sol: Sertifika No + Doğrulama Kodu
  page.drawText(`Sertifika No: ${data.certificateNo}`, {
    x: margin + 30,
    y: margin + 60,
    size: 10,
    font: interRegular,
    color: slate,
  });
  page.drawText(`Doğrulama Kodu: ${data.verificationCode}`, {
    x: margin + 30,
    y: margin + 45,
    size: 10,
    font: interRegular,
    color: slate,
  });

  // QR kod (alt sağ)
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://172.16.16.33";
  const verifyUrl = `${baseUrl.replace(/\/+$/, "")}/akademi/verify/${
    data.verificationCode
  }`;
  try {
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 200,
      margin: 1,
    });
    const qrPngBytes = Buffer.from(qrDataUrl.split(",")[1], "base64");
    const qrImage = await pdfDoc.embedPng(qrPngBytes);
    const qrSize = 80;
    page.drawImage(qrImage, {
      x: width - margin - 30 - qrSize,
      y: margin + 30,
      width: qrSize,
      height: qrSize,
    });
    page.drawText("Doğrulamak için tarayın", {
      x: width - margin - 30 - qrSize - 5,
      y: margin + 18,
      size: 8,
      font: interRegular,
      color: slate,
    });
  } catch (e) {
    console.error("[certificate-pdf] QR generation failed:", e);
    page.drawText(`Doğrula: ${verifyUrl}`, {
      x: width - margin - 280,
      y: margin + 30,
      size: 8,
      font: interRegular,
      color: slate,
    });
  }

  const pdfBytes = await pdfDoc.save();
  const fileName = `${data.certificateNo}.pdf`;
  const fullPath = path.join(STORAGE_DIR, fileName);
  await fs.writeFile(fullPath, pdfBytes);

  return `/uploads/akademi/certificates/${fileName}`;
}
