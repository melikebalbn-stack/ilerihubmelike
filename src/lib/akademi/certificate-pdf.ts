import { PDFDocument, StandardFonts, rgb, PageSizes } from "pdf-lib";
import QRCode from "qrcode";
import fs from "fs/promises";
import path from "path";

type CertificateData = {
  certificateNo: string;
  verificationCode: string;
  userName: string;
  courseName: string;
  issuedAt: Date;
};

const STORAGE_DIR = path.join(
  process.cwd(),
  "public",
  "uploads",
  "akademi",
  "certificates"
);

/**
 * pdf-lib StandardFonts WinAnsi destekli, Türkçe karakterleri kayıpsız basmıyor.
 * Görsel kalite için Türkçe diyakritikleri ASCII karşılıklarıyla değiştir.
 */
function asciiSafe(s: string): string {
  return s
    .replace(/İ/g, "I")
    .replace(/ı/g, "i")
    .replace(/Ş/g, "S")
    .replace(/ş/g, "s")
    .replace(/Ğ/g, "G")
    .replace(/ğ/g, "g")
    .replace(/Ü/g, "U")
    .replace(/ü/g, "u")
    .replace(/Ö/g, "O")
    .replace(/ö/g, "o")
    .replace(/Ç/g, "C")
    .replace(/ç/g, "c");
}

export async function generateCertificatePdf(
  data: CertificateData
): Promise<string> {
  await fs.mkdir(STORAGE_DIR, { recursive: true });

  const pdfDoc = await PDFDocument.create();
  // A4 landscape (842 x 595)
  const page = pdfDoc.addPage([PageSizes.A4[1], PageSizes.A4[0]]);
  const { width, height } = page.getSize();

  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const navy = rgb(0.05, 0.15, 0.35);
  const gold = rgb(0.7, 0.55, 0.15);
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

  const title = "SERTIFIKA";
  const titleSize = 42;
  const titleWidth = helveticaBold.widthOfTextAtSize(title, titleSize);
  page.drawText(title, {
    x: (width - titleWidth) / 2,
    y: height - 110,
    size: titleSize,
    font: helveticaBold,
    color: navy,
  });

  const subtitle = "ILERI AKADEMI";
  const subSize = 14;
  const subWidth = helvetica.widthOfTextAtSize(subtitle, subSize);
  page.drawText(subtitle, {
    x: (width - subWidth) / 2,
    y: height - 140,
    size: subSize,
    font: helvetica,
    color: gold,
  });

  const intro = "Bu sertifika";
  const introSize = 13;
  const introWidth = helvetica.widthOfTextAtSize(intro, introSize);
  page.drawText(intro, {
    x: (width - introWidth) / 2,
    y: height - 200,
    size: introSize,
    font: helvetica,
    color: slate,
  });

  const userNameSafe = asciiSafe(data.userName);
  const userNameSize = 30;
  const userNameWidth = helveticaBold.widthOfTextAtSize(
    userNameSafe,
    userNameSize
  );
  page.drawText(userNameSafe, {
    x: (width - userNameWidth) / 2,
    y: height - 245,
    size: userNameSize,
    font: helveticaBold,
    color: navy,
  });

  page.drawLine({
    start: { x: width / 2 - 200, y: height - 255 },
    end: { x: width / 2 + 200, y: height - 255 },
    color: gold,
    thickness: 1,
  });

  const desc1 = asciiSafe(
    "tarafindan asagidaki kursu basariyla tamamlandigi icin verilmistir."
  );
  const descSize = 12;
  const desc1Width = helvetica.widthOfTextAtSize(desc1, descSize);
  page.drawText(desc1, {
    x: (width - desc1Width) / 2,
    y: height - 285,
    size: descSize,
    font: helvetica,
    color: slate,
  });

  const courseNameSafe = asciiSafe(data.courseName);
  const courseSize = 22;
  const courseWidth = helveticaItalic.widthOfTextAtSize(
    courseNameSafe,
    courseSize
  );
  page.drawText(courseNameSafe, {
    x: (width - courseWidth) / 2,
    y: height - 335,
    size: courseSize,
    font: helveticaItalic,
    color: navy,
  });

  const dateStr = data.issuedAt.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const dateLabel = asciiSafe(`Duzenlenme Tarihi: ${dateStr}`);
  const dateSize = 11;
  const dateWidth = helvetica.widthOfTextAtSize(dateLabel, dateSize);
  page.drawText(dateLabel, {
    x: (width - dateWidth) / 2,
    y: height - 380,
    size: dateSize,
    font: helvetica,
    color: slate,
  });

  page.drawText(`Sertifika No: ${data.certificateNo}`, {
    x: margin + 30,
    y: margin + 60,
    size: 10,
    font: helvetica,
    color: slate,
  });
  page.drawText(`Dogrulama Kodu: ${data.verificationCode}`, {
    x: margin + 30,
    y: margin + 45,
    size: 10,
    font: helvetica,
    color: slate,
  });

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
    page.drawText(asciiSafe("Dogrulamak icin tarayin"), {
      x: width - margin - 30 - qrSize - 5,
      y: margin + 18,
      size: 8,
      font: helvetica,
      color: slate,
    });
  } catch (e) {
    console.error("[certificate-pdf] QR generation failed:", e);
    page.drawText(`Dogrula: ${verifyUrl}`, {
      x: width - margin - 280,
      y: margin + 30,
      size: 8,
      font: helvetica,
      color: slate,
    });
  }

  const pdfBytes = await pdfDoc.save();
  const fileName = `${data.certificateNo}.pdf`;
  const fullPath = path.join(STORAGE_DIR, fileName);
  await fs.writeFile(fullPath, pdfBytes);

  return `/uploads/akademi/certificates/${fileName}`;
}
