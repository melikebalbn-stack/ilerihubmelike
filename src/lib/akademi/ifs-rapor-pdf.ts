import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { PoppinsRegular, PoppinsBold, PoppinsSemiBold } from "@/lib/pdf/fonts/poppins";
import type {
  IfsRaporData,
  Seviye,
  IfsBolumReport,
  IfsBolumKisi,
  IfsDurum,
} from "@/lib/akademi/ifs-aggregate";

// IFS Eğitim İlerleme Raporu (yönetim) — bölüm özeti + bölüm-bölüm kişi tabloları.
// jsPDF + autoTable, Poppins (Türkçe karakter). ILERI lacivert #1B4F72 şeridi.

const ILERI: [number, number, number] = [27, 79, 114]; // #1B4F72
const HEAD: [number, number, number] = [41, 128, 185];
const LIGHT: [number, number, number] = [245, 247, 250];
const DARK: [number, number, number] = [70, 70, 70];
const MUTED: [number, number, number] = [120, 120, 120];

const SEVIYE_LABEL: Record<string, string> = {
  BASARILI: "Başarılı",
  EGITIM_GEREKLI: "Eğitim Gerekli",
  BASARISIZ: "Başarısız",
  DEGERLENDIRILMEDI: "Değerlendirilmedi",
};

function seviyeText(s: Seviye | null): string {
  return s ? SEVIYE_LABEL[s] ?? s : SEVIYE_LABEL.DEGERLENDIRILMEDI;
}

const DURUM_LABEL: Record<IfsDurum, string> = {
  YOLUNDA: "Yolunda",
  GECIKTI: "Gecikti",
  TARIHSIZ: "Tarihsiz",
};
const DURUM_COLOR: Record<IfsDurum, [number, number, number]> = {
  YOLUNDA: [22, 163, 74],
  GECIKTI: [220, 38, 38],
  TARIHSIZ: [120, 120, 120],
};
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function generateIfsRaporPdfBuffer(
  data: IfsRaporData,
  opts: { generatedAt: string }
): Buffer {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.addFileToVFS("Poppins-Regular.ttf", PoppinsRegular);
  doc.addFileToVFS("Poppins-Bold.ttf", PoppinsBold);
  doc.addFileToVFS("Poppins-SemiBold.ttf", PoppinsSemiBold);
  doc.addFont("Poppins-Regular.ttf", "Poppins", "normal");
  doc.addFont("Poppins-Bold.ttf", "Poppins", "bold");
  doc.addFont("Poppins-SemiBold.ttf", "Poppins", "semibold");
  doc.setFont("Poppins", "normal");

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;

  // ── Başlık şeridi ──
  doc.setFillColor(...ILERI);
  doc.rect(margin, yPos, contentWidth, 14, "F");
  doc.setFont("Poppins", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(
    `IFS Eğitim İlerleme Raporu — ${data.packageName}`,
    margin + 4,
    yPos + 9
  );
  doc.setFont("Poppins", "normal");
  doc.setFontSize(8.5);
  doc.text(opts.generatedAt, pageWidth - margin - 4, yPos + 9, {
    align: "right",
  });
  yPos += 20;

  // ── Genel özet satırı ──
  const t = data.totals;
  doc.setFont("Poppins", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  const kurslar = data.courseTitles.length
    ? data.courseTitles.join(", ")
    : "—";
  doc.text(
    `Personel: ${t.userCount}   ·   Paket Toplam Görev: ${t.totalGorev}   ·   Ortalama Başarı: %${t.avgPct}   ·   Başarılı Ders: ${t.seviyeDist.BASARILI}`,
    margin,
    yPos
  );
  yPos += 5;
  const kursLines = doc.splitTextToSize(`Kurslar: ${kurslar}`, contentWidth);
  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  kursLines.forEach((line: string) => {
    doc.text(line, margin, yPos);
    yPos += 4;
  });
  yPos += 3;

  // ── Bölüm Özeti tablosu ──
  sectionHeader("Bölüm Özeti");
  autoTable(doc, {
    startY: yPos,
    head: [
      [
        "Bölüm",
        "Kişi",
        "Toplam Görev",
        "Başarılı Görev",
        "Ort. %",
        "Başarılı",
        "Eğitim Gerekli",
        "Başarısız",
        "Bekleyen",
      ],
    ],
    body: data.bolumSummary.map((b) => [
      b.bolum,
      String(b.userCount),
      String(b.totalGorev),
      String(b.basariliGorev),
      `%${b.avgPct}`,
      String(b.seviyeDist.BASARILI),
      String(b.seviyeDist.EGITIM_GEREKLI),
      String(b.seviyeDist.BASARISIZ),
      String(b.pending),
    ]),
    foot: [
      [
        "TOPLAM",
        String(t.userCount),
        String(t.totalGorev),
        String(t.basariliGorev),
        `%${t.avgPct}`,
        String(t.seviyeDist.BASARILI),
        String(t.seviyeDist.EGITIM_GEREKLI),
        String(t.seviyeDist.BASARISIZ),
        String(t.pending),
      ],
    ],
    margin: { left: margin, right: margin },
    styles: {
      font: "Poppins",
      fontSize: 8,
      cellPadding: 2.5,
      textColor: DARK,
      lineColor: [210, 210, 210],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: HEAD,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    footStyles: {
      fillColor: ILERI,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 14, halign: "center" },
      2: { cellWidth: 24, halign: "center" },
      3: { cellWidth: 26, halign: "center" },
      4: { cellWidth: 18, halign: "center" },
      5: { cellWidth: 20, halign: "center" },
      6: { cellWidth: 26, halign: "center" },
      7: { cellWidth: 20, halign: "center" },
      8: { cellWidth: 20, halign: "center" },
    },
  });
  yPos = lastY() + 8;

  // ── Bölüm-bölüm kişi tabloları ──
  const byBolum = new Map<string, typeof data.kisiDetay>();
  for (const r of data.kisiDetay) {
    const arr = byBolum.get(r.bolum) ?? [];
    arr.push(r);
    byBolum.set(r.bolum, arr);
  }
  const bolumOrder = data.bolumSummary.map((b) => b.bolum);

  for (const bolum of bolumOrder) {
    const rows = byBolum.get(bolum);
    if (!rows || rows.length === 0) continue;
    checkPageBreak(24);
    sectionHeader(`${bolum} — Kişi Detayı`);
    autoTable(doc, {
      startY: yPos,
      head: [
        ["Ad Soyad", "Kurs", "Görev", "Başarılı", "%", "Ders Seviyesi", "Not"],
      ],
      body: rows.map((r) => [
        r.ad,
        r.kurs,
        String(r.gorevCount),
        String(r.basariliGorev),
        `%${r.pct}`,
        seviyeText(r.seviye),
        r.not ?? "",
      ]),
      margin: { left: margin, right: margin },
      styles: {
        font: "Poppins",
        fontSize: 7.5,
        cellPadding: 2,
        textColor: DARK,
        lineColor: [215, 215, 215],
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
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 55 },
        2: { cellWidth: 16, halign: "center" },
        3: { cellWidth: 18, halign: "center" },
        4: { cellWidth: 14, halign: "center" },
        5: { cellWidth: 30 },
        6: { cellWidth: "auto" },
      },
    });
    yPos = lastY() + 7;
  }

  // ── Sayfa numaraları ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("Poppins", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(`Sayfa ${i} / ${totalPages}`, pageWidth - margin, pageHeight - 6, {
      align: "right",
    });
    doc.text(
      "IFS Eğitim İlerleme Raporu | ILERIHub Akademi",
      margin,
      pageHeight - 6
    );
  }

  return Buffer.from(doc.output("arraybuffer"));

  // ── helpers ──
  function sectionHeader(title: string) {
    checkPageBreak(14);
    doc.setFillColor(...ILERI);
    doc.rect(margin, yPos, contentWidth, 7, "F");
    doc.setFont("Poppins", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(title, margin + 3, yPos + 4.8);
    yPos += 10;
  }
  function checkPageBreak(space: number) {
    if (yPos + space > pageHeight - 12) {
      doc.addPage();
      yPos = margin;
    }
  }
  function lastY(): number {
    return (
      doc as jsPDF & { lastAutoTable: { finalY: number } }
    ).lastAutoTable.finalY;
  }
}

function initDoc(orientation: "portrait" | "landscape"): jsPDF {
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  doc.addFileToVFS("Poppins-Regular.ttf", PoppinsRegular);
  doc.addFileToVFS("Poppins-Bold.ttf", PoppinsBold);
  doc.addFileToVFS("Poppins-SemiBold.ttf", PoppinsSemiBold);
  doc.addFont("Poppins-Regular.ttf", "Poppins", "normal");
  doc.addFont("Poppins-Bold.ttf", "Poppins", "bold");
  doc.addFont("Poppins-SemiBold.ttf", "Poppins", "semibold");
  doc.setFont("Poppins", "normal");
  return doc;
}

function pageFooter(doc: jsPDF, label: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("Poppins", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(`Sayfa ${i} / ${totalPages}`, pageWidth - 12, pageHeight - 6, {
      align: "right",
    });
    doc.text(label, 12, pageHeight - 6);
  }
}

// PR-IFS-RAPOR-2b: BÖLÜM raporu PDF — özet + kişi×kurs tablosu (Son Tarih + Durum).
export function generateIfsBolumPdfBuffer(
  report: IfsBolumReport,
  opts: { generatedAt: string }
): Buffer {
  const doc = initDoc("landscape");
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;

  doc.setFillColor(...ILERI);
  doc.rect(margin, yPos, contentWidth, 14, "F");
  doc.setFont("Poppins", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(
    `IFS Eğitim İlerleme Raporu — ${report.bolum}`,
    margin + 4,
    yPos + 9
  );
  doc.setFont("Poppins", "normal");
  doc.setFontSize(8.5);
  doc.text(opts.generatedAt, pageWidth - margin - 4, yPos + 9, {
    align: "right",
  });
  yPos += 20;

  const s = report.summary;
  doc.setFont("Poppins", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text(
    `Kişi: ${s.kisiSayisi}   ·   Toplam Görev: ${s.toplamGorev}   ·   BAŞARILI: ${s.basariliGorev}   ·   Ortalama: %${s.ortalamaPct}   ·   Geciken: ${s.gecikenKisi}`,
    margin,
    yPos
  );
  yPos += 6;

  const body: string[][] = [];
  for (const k of report.kisiler)
    for (const c of k.kurslar)
      body.push([
        k.adSoyad,
        c.kursAd,
        String(c.gorevCount),
        String(c.basarili),
        `%${c.pct}`,
        fmtDate(c.dueDate),
        DURUM_LABEL[c.durum],
      ]);

  const durumSeq: IfsDurum[] = [];
  for (const k of report.kisiler) for (const c of k.kurslar) durumSeq.push(c.durum);

  autoTable(doc, {
    startY: yPos,
    head: [["Ad Soyad", "Eğitim", "Görev", "BAŞARILI", "%", "Son Tarih", "Durum"]],
    body,
    margin: { left: margin, right: margin },
    styles: {
      font: "Poppins",
      fontSize: 8,
      cellPadding: 2,
      textColor: DARK,
      lineColor: [215, 215, 215],
      lineWidth: 0.1,
      overflow: "linebreak",
    },
    headStyles: { fillColor: HEAD, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 18, halign: "center" },
      3: { cellWidth: 22, halign: "center" },
      4: { cellWidth: 16, halign: "center" },
      5: { cellWidth: 28, halign: "center" },
      6: { cellWidth: 26, halign: "center" },
    },
    didParseCell: (d) => {
      if (d.section === "body" && d.column.index === 6) {
        const durum = durumSeq[d.row.index];
        if (durum) {
          d.cell.styles.textColor = DURUM_COLOR[durum];
          d.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  pageFooter(doc, "IFS Bölüm Raporu | ILERIHub Akademi");
  return Buffer.from(doc.output("arraybuffer"));
}

// PR-IFS-RAPOR-2b: TEK KİŞİ PDF — kişinin tüm IFS kurs/görev durumu.
export function generateIfsKisiPdfBuffer(
  kisi: IfsBolumKisi,
  opts: { bolum: string; generatedAt: string }
): Buffer {
  const doc = initDoc("portrait");
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;

  doc.setFillColor(...ILERI);
  doc.rect(margin, yPos, contentWidth, 16, "F");
  doc.setFont("Poppins", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(`IFS Eğitim Durumu — ${kisi.adSoyad}`, margin + 4, yPos + 7);
  doc.setFont("Poppins", "normal");
  doc.setFontSize(8.5);
  doc.text(
    `Bölüm: ${opts.bolum}   ·   ${opts.generatedAt}`,
    margin + 4,
    yPos + 12.5
  );
  yPos += 22;

  const gorev = kisi.kurslar.reduce((n, c) => n + c.gorevCount, 0);
  const basarili = kisi.kurslar.reduce((n, c) => n + c.basarili, 0);
  const geciken = kisi.kurslar.filter((c) => c.durum === "GECIKTI").length;
  doc.setFont("Poppins", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text(
    `Eğitim: ${kisi.kurslar.length}   ·   Toplam Görev: ${gorev}   ·   BAŞARILI: ${basarili}   ·   Ortalama: %${gorev > 0 ? Math.round((basarili / gorev) * 100) : 0}   ·   Geciken Eğitim: ${geciken}`,
    margin,
    yPos
  );
  yPos += 6;

  const durumSeq = kisi.kurslar.map((c) => c.durum);
  autoTable(doc, {
    startY: yPos,
    head: [["Eğitim", "Görev", "BAŞARILI", "%", "Son Tarih", "Durum"]],
    body: kisi.kurslar.map((c) => [
      c.kursAd,
      String(c.gorevCount),
      String(c.basarili),
      `%${c.pct}`,
      fmtDate(c.dueDate),
      DURUM_LABEL[c.durum],
    ]),
    margin: { left: margin, right: margin },
    styles: {
      font: "Poppins",
      fontSize: 8.5,
      cellPadding: 2.5,
      textColor: DARK,
      lineColor: [215, 215, 215],
      lineWidth: 0.1,
      overflow: "linebreak",
    },
    headStyles: { fillColor: HEAD, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 18, halign: "center" },
      2: { cellWidth: 22, halign: "center" },
      3: { cellWidth: 16, halign: "center" },
      4: { cellWidth: 28, halign: "center" },
      5: { cellWidth: 24, halign: "center" },
    },
    didParseCell: (d) => {
      if (d.section === "body" && d.column.index === 5) {
        const durum = durumSeq[d.row.index];
        if (durum) {
          d.cell.styles.textColor = DURUM_COLOR[durum];
          d.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  pageFooter(doc, "IFS Kişi Raporu | ILERIHub Akademi");
  return Buffer.from(doc.output("arraybuffer"));
}
