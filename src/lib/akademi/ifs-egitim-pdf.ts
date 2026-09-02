import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  PoppinsRegular,
  PoppinsBold,
  PoppinsSemiBold,
} from "@/lib/pdf/fonts/poppins";

// IFS EĞİTİMLER export'unun PDF tarafı.
//
// ifs-rapor-pdf.ts ile AYNI desen: jsPDF + autoTable, Poppins (Türkçe
// karakter), ILERI lacivert #1B4F72 başlık şeridi, aynı renkler ve tablo
// stilleri. Yeni kütüphane getirilmedi.
//
// Oradaki üç üretici belirli veri tiplerine bağlı (IfsRaporData /
// IfsBolumReport / IfsBolumKisi). Buradaki üçü de (özet, departman, kişi)
// tek bir tablodan ibaret, üç ayrı üretici yazmak yerine başlık + satır
// dizisi alan TEK genel üretici var — üç kırılım aynı görünümü paylaşsın.

const ILERI: [number, number, number] = [27, 79, 114]; // #1B4F72
const HEAD: [number, number, number] = [41, 128, 185];
const LIGHT: [number, number, number] = [245, 247, 250];
const DARK: [number, number, number] = [70, 70, 70];
const MUTED: [number, number, number] = [120, 120, 120];

export interface IfsEgitimPdfOpts {
  baslik: string;
  altBaslik: string;
  basliklar: string[];
  /** Satır × sütun, başlık sırasıyla. Hücreler zaten metne çevrilmiş olmalı. */
  satirlar: string[][];
  generatedAt: string;
}

export function generateIfsEgitimPdfBuffer(opts: IfsEgitimPdfOpts): Buffer {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.addFileToVFS("Poppins-Regular.ttf", PoppinsRegular);
  doc.addFileToVFS("Poppins-Bold.ttf", PoppinsBold);
  doc.addFileToVFS("Poppins-SemiBold.ttf", PoppinsSemiBold);
  doc.addFont("Poppins-Regular.ttf", "Poppins", "normal");
  doc.addFont("Poppins-Bold.ttf", "Poppins", "bold");
  doc.addFont("Poppins-SemiBold.ttf", "Poppins", "semibold");
  doc.setFont("Poppins", "normal");

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;

  // ── Başlık şeridi ──
  doc.setFillColor(...ILERI);
  doc.rect(margin, yPos, contentWidth, 14, "F");
  doc.setFont("Poppins", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(opts.baslik, margin + 4, yPos + 9);
  doc.setFont("Poppins", "normal");
  doc.setFontSize(8.5);
  doc.text(opts.generatedAt, pageWidth - margin - 4, yPos + 9, {
    align: "right",
  });
  yPos += 20;

  // ── Alt başlık (özet satırı) ──
  if (opts.altBaslik) {
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    const satirlar = doc.splitTextToSize(opts.altBaslik, contentWidth);
    satirlar.forEach((line: string) => {
      doc.text(line, margin, yPos);
      yPos += 5;
    });
    yPos += 2;
  }

  if (opts.satirlar.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("Kayıt yok.", margin, yPos);
    return Buffer.from(doc.output("arraybuffer"));
  }

  autoTable(doc, {
    startY: yPos,
    head: [opts.basliklar],
    body: opts.satirlar,
    margin: { left: margin, right: margin },
    styles: {
      font: "Poppins",
      fontSize: 7.5,
      cellPadding: 2,
      textColor: DARK,
      lineColor: [210, 210, 210],
      lineWidth: 0.1,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: HEAD,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.5,
    },
    alternateRowStyles: { fillColor: LIGHT },
  });

  // ── Sayfa numaraları ──
  const sayfa = doc.getNumberOfPages();
  doc.setFont("Poppins", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  for (let i = 1; i <= sayfa; i++) {
    doc.setPage(i);
    doc.text(
      `${i} / ${sayfa}`,
      pageWidth - margin,
      doc.internal.pageSize.getHeight() - 6,
      { align: "right" }
    );
  }

  return Buffer.from(doc.output("arraybuffer"));
}
