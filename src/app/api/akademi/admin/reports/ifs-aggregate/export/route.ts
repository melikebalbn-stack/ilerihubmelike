import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as XLSX from "xlsx";
import { requirePermission } from "@/lib/auth/require-permission";
import { getUserPermissions } from "@/lib/auth/get-user-permissions";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { resolveUserBolum, getLinkedBolums } from "@/lib/user-personnel";
import {
  buildIfsRaporData,
  computeIfsBolumReport,
  BOLUM_BELIRSIZ,
  type IfsRaporData,
  type IfsBolumReport,
  type IfsDurum,
  type Seviye,
} from "@/lib/akademi/ifs-aggregate";
import {
  generateIfsRaporPdfBuffer,
  generateIfsBolumPdfBuffer,
  generateIfsKisiPdfBuffer,
} from "@/lib/akademi/ifs-rapor-pdf";

export const dynamic = "force-dynamic";

// IFS Eğitim İlerleme Raporu export — Excel (xlsx) veya PDF.
// mode=paket (varsayılan): paket bazlı (buildIfsRaporData).
// mode=bolum: bölüm-öncelikli rapor (computeIfsBolumReport) — xlsx + pdf.
// mode=kisi: tek kişinin IFS durumu — pdf.
// Scope ifs-aggregate ile AYNI: admin=tüm bölümler, değilse kendi bölümü.
const querySchema = z.object({
  format: z.enum(["xlsx", "pdf"]).default("xlsx"),
  mode: z.enum(["paket", "bolum", "kisi"]).default("paket"),
  packageId: z.string().trim().min(1).optional(),
  bolum: z.string().trim().min(1).optional(),
  userId: z.string().trim().min(1).optional(),
  all: z.coerce.boolean().optional(),
});

const DURUM_LABEL: Record<IfsDurum, string> = {
  YOLUNDA: "Yolunda",
  GECIKTI: "Gecikti",
  TARIHSIZ: "Tarihsiz",
};
function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

const SEVIYE_LABEL: Record<string, string> = {
  BASARILI: "Başarılı",
  EGITIM_GEREKLI: "Eğitim Gerekli",
  BASARISIZ: "Başarısız",
  DEGERLENDIRILMEDI: "Değerlendirilmedi",
};
const seviyeText = (s: Seviye | null): string =>
  s ? SEVIYE_LABEL[s] ?? s : SEVIYE_LABEL.DEGERLENDIRILMEDI;

const TR_MAP: Record<string, string> = {
  ç: "c", Ç: "C", ğ: "g", Ğ: "G", ı: "i", İ: "I", ö: "o", Ö: "O",
  ş: "s", Ş: "S", ü: "u", Ü: "U",
};
function sanitizeFilename(s: string): string {
  return s
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => TR_MAP[c] ?? c)
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "Rapor";
}
function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

export async function GET(req: NextRequest) {
  const { session, error } = await requirePermission("akademi.report.view");
  if (error) return error;
  const callerId = await resolveAkademiUserId(session);
  if (!callerId) {
    return NextResponse.json(
      { error: "Kullanıcı çözümlenemedi" },
      { status: 401 }
    );
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams)
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Geçersiz parametre" },
      { status: 400 }
    );
  }
  const { packageId, format, mode, bolum, userId, all } = parsed.data;

  // Scope: admin=tüm bölümler, değilse kendi bölümü.
  const perms = await getUserPermissions(callerId);
  const fullScope = perms.has("akademi.admin");
  const ownBolum = fullScope ? null : await resolveUserBolum(callerId);
  const now = new Date();

  const pdfResponse = (buffer: Buffer, name: string) =>
    new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  const xlsxResponse = (buffer: Buffer, name: string) =>
    new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });

  // ── mode=bolum / mode=kisi ──
  if (mode === "bolum" || mode === "kisi") {
    if (!bolum) {
      return NextResponse.json({ error: "bolum gerekli" }, { status: 400 });
    }
    if (!fullScope && ownBolum !== bolum) {
      return NextResponse.json(
        { error: "Bu bölümü görüntüleme yetkiniz yok" },
        { status: 403 }
      );
    }
    const report = await computeIfsBolumReport({ bolum, now });
    const bolumFn = sanitizeFilename(bolum === BOLUM_BELIRSIZ ? "Belirsiz" : bolum);

    if (mode === "kisi") {
      if (!userId) {
        return NextResponse.json({ error: "userId gerekli" }, { status: 400 });
      }
      const kisi = report.kisiler.find((k) => k.userId === userId);
      if (!kisi) {
        return NextResponse.json({ error: "Kişi bulunamadı" }, { status: 404 });
      }
      const buffer = generateIfsKisiPdfBuffer(kisi, {
        bolum,
        generatedAt: now.toLocaleDateString("tr-TR"),
      });
      return pdfResponse(
        buffer,
        `IFS-Kisi-${sanitizeFilename(kisi.adSoyad)}-${ymd(now)}`
      );
    }

    const baseName = `IFS-Bolum-Raporu-${bolumFn}-${ymd(now)}`;
    if (format === "pdf") {
      const buffer = generateIfsBolumPdfBuffer(report, {
        generatedAt: now.toLocaleDateString("tr-TR"),
      });
      return pdfResponse(buffer, baseName);
    }
    return xlsxResponse(buildBolumXlsx(report), baseName);
  }

  // ── mode=paket (varsayılan) ──
  if (!packageId) {
    return NextResponse.json({ error: "packageId gerekli" }, { status: 400 });
  }
  const bolums = fullScope
    ? await getLinkedBolums()
    : ownBolum
      ? [ownBolum]
      : [];

  const data = await buildIfsRaporData({
    packageId,
    bolums,
    includeEmpty: !!all,
  });
  if (!data) {
    return NextResponse.json({ error: "Paket bulunamadı" }, { status: 404 });
  }

  const baseName = `IFS-Egitim-Raporu-${sanitizeFilename(data.packageName)}-${ymd(now)}`;
  if (format === "pdf") {
    return pdfResponse(
      generateIfsRaporPdfBuffer(data, {
        generatedAt: now.toLocaleDateString("tr-TR"),
      }),
      baseName
    );
  }
  return xlsxResponse(buildXlsx(data), baseName);
}

function buildBolumXlsx(report: IfsBolumReport): Buffer {
  const wb = XLSX.utils.book_new();

  // Sayfa 1: Bölüm Özeti (tek satır)
  const s = report.summary;
  const ozetHeaders = [
    "Bölüm",
    "Kişi Sayısı",
    "Toplam Görev",
    "BAŞARILI",
    "Ortalama %",
    "Geciken Kişi",
  ];
  const wsOzet = XLSX.utils.json_to_sheet(
    [
      {
        Bölüm: report.bolum,
        "Kişi Sayısı": s.kisiSayisi,
        "Toplam Görev": s.toplamGorev,
        BAŞARILI: s.basariliGorev,
        "Ortalama %": s.ortalamaPct,
        "Geciken Kişi": s.gecikenKisi,
      },
    ],
    { header: ozetHeaders }
  );
  wsOzet["!cols"] = ozetHeaders.map((h) => ({ wch: Math.max(h.length + 2, 12) }));
  XLSX.utils.book_append_sheet(wb, wsOzet, "Bölüm Özeti");

  // Sayfa 2: Kişi Detayı (kişi × kurs)
  const detayHeaders = [
    "Ad Soyad",
    "Eğitim",
    "Görev",
    "BAŞARILI",
    "%",
    "Son Tarih",
    "Durum",
  ];
  const detay: Record<string, string | number>[] = [];
  for (const k of report.kisiler)
    for (const c of k.kurslar)
      detay.push({
        "Ad Soyad": k.adSoyad,
        Eğitim: c.kursAd,
        Görev: c.gorevCount,
        BAŞARILI: c.basarili,
        "%": c.pct,
        "Son Tarih": fmtDate(c.dueDate),
        Durum: DURUM_LABEL[c.durum],
      });
  const wsDetay = XLSX.utils.json_to_sheet(detay, { header: detayHeaders });
  wsDetay["!cols"] = [
    { wch: 26 },
    { wch: 34 },
    { wch: 10 },
    { wch: 10 },
    { wch: 8 },
    { wch: 14 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDetay, "Kişi Detayı");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

function buildXlsx(data: IfsRaporData): Buffer {
  const wb = XLSX.utils.book_new();

  // Sayfa 1: Bölüm Özeti
  const ozet = data.bolumSummary.map((b) => ({
    Bölüm: b.bolum,
    "Kişi Sayısı": b.userCount,
    "Toplam Görev": b.totalGorev,
    "BAŞARILI Görev": b.basariliGorev,
    "Ortalama %": b.avgPct,
    Başarılı: b.seviyeDist.BASARILI,
    "Eğitim Gerekli": b.seviyeDist.EGITIM_GEREKLI,
    Başarısız: b.seviyeDist.BASARISIZ,
    Bekleyen: b.pending,
  }));
  ozet.push({
    Bölüm: "TOPLAM",
    "Kişi Sayısı": data.totals.userCount,
    "Toplam Görev": data.totals.totalGorev,
    "BAŞARILI Görev": data.totals.basariliGorev,
    "Ortalama %": data.totals.avgPct,
    Başarılı: data.totals.seviyeDist.BASARILI,
    "Eğitim Gerekli": data.totals.seviyeDist.EGITIM_GEREKLI,
    Başarısız: data.totals.seviyeDist.BASARISIZ,
    Bekleyen: data.totals.pending,
  });
  const ozetHeaders = [
    "Bölüm",
    "Kişi Sayısı",
    "Toplam Görev",
    "BAŞARILI Görev",
    "Ortalama %",
    "Başarılı",
    "Eğitim Gerekli",
    "Başarısız",
    "Bekleyen",
  ];
  const wsOzet = XLSX.utils.json_to_sheet(ozet, { header: ozetHeaders });
  wsOzet["!cols"] = ozetHeaders.map((h) => ({
    wch: Math.max(h.length + 2, 12),
  }));
  XLSX.utils.book_append_sheet(wb, wsOzet, "Bölüm Özeti");

  // Sayfa 2: Kişi Detayı (kişi × kurs)
  const detayHeaders = [
    "Bölüm",
    "Ad Soyad",
    "Kurs",
    "Görev Sayısı",
    "BAŞARILI",
    "%",
    "Kurs Seviyesi",
    "Not",
  ];
  const detay = data.kisiDetay.map((r) => ({
    Bölüm: r.bolum,
    "Ad Soyad": r.ad,
    Kurs: r.kurs,
    "Görev Sayısı": r.gorevCount,
    BAŞARILI: r.basariliGorev,
    "%": r.pct,
    "Kurs Seviyesi": seviyeText(r.seviye),
    Not: r.not ?? "",
  }));
  const wsDetay = XLSX.utils.json_to_sheet(detay, { header: detayHeaders });
  wsDetay["!cols"] = [
    { wch: 22 },
    { wch: 24 },
    { wch: 30 },
    { wch: 13 },
    { wch: 10 },
    { wch: 8 },
    { wch: 16 },
    { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDetay, "Kişi Detayı");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
