import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as XLSX from "xlsx";
import { requirePermission } from "@/lib/auth/require-permission";
import { getUserPermissions } from "@/lib/auth/get-user-permissions";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { resolveUserBolum, getLinkedBolums } from "@/lib/user-personnel";
import {
  buildIfsRaporData,
  type IfsRaporData,
  type Seviye,
} from "@/lib/akademi/ifs-aggregate";
import { generateIfsRaporPdfBuffer } from "@/lib/akademi/ifs-rapor-pdf";

export const dynamic = "force-dynamic";

// IFS Eğitim İlerleme Raporu export — Excel (xlsx) veya PDF.
// Scope ifs-aggregate ile AYNI: admin=tüm bölümler, değilse kendi bölümü.
// Metrik ortak katmandan (buildIfsRaporData → computeIfsAggregate).
const querySchema = z.object({
  packageId: z.string().trim().min(1),
  format: z.enum(["xlsx", "pdf"]).default("xlsx"),
  all: z.coerce.boolean().optional(),
});

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
  const { packageId, format, all } = parsed.data;

  // Scope: admin=tüm bölümler, değilse kendi bölümü.
  const perms = await getUserPermissions(callerId);
  const fullScope = perms.has("akademi.admin");
  const ownBolum = fullScope ? null : await resolveUserBolum(callerId);
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

  const now = new Date();
  const baseName = `IFS-Egitim-Raporu-${sanitizeFilename(data.packageName)}-${ymd(now)}`;

  if (format === "pdf") {
    const buffer = generateIfsRaporPdfBuffer(data, {
      generatedAt: now.toLocaleDateString("tr-TR"),
    });
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // ── Excel ──
  const buffer = buildXlsx(data);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
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
