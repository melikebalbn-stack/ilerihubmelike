import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as XLSX from "xlsx";
import { requirePermission } from "@/lib/auth/require-permission";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import {
  IFS_EGITIM_OKUMA,
  ifsEgitimKapsami,
  ifsKapsamYok,
} from "@/lib/akademi/ifs-kapsam";
import {
  ifsEgitimYapisi,
  ifsPaketKisileri,
  ifsKisiGorevleri,
} from "@/lib/akademi/ifs-rapor-veri";
import { generateIfsEgitimPdfBuffer } from "@/lib/akademi/ifs-egitim-pdf";

export const dynamic = "force-dynamic";

// IFS EĞİTİM EXPORT — /ifs/degerlendirme ekranının üç kırılımı için xlsx/pdf.
//
// Yetki ve kapsam ifs-paket-kisiler ile AYNI: requirePermission(IFS_EGITIM_OKUMA)
// + ifsEgitimKapsami. Key user yalnız kendi bölümünü dışarı aktarabilir —
// daraltma veriyi üreten fonksiyonların İÇİNDE olduğu için ayrı bir süzgeç
// yazılmıyor, ekranda görmediğini dosyada da göremez.
//
// Veri TEK KAYNAK'tan (ifs-rapor-veri.ts) — ekranı besleyen fonksiyonların
// aynısı. Yüzdeler ifs-progress.ts'ten; burada YENİ FORMÜL YOK.
//
// Kütüphaneler mevcut desenle aynı: xlsx + jspdf/jspdf-autotable
// (ifs-aggregate/export ne kullanıyorsa o). Yeni bağımlılık getirilmedi.
const querySchema = z.object({
  kapsam: z.enum(["ozet", "departman", "kisi"]),
  format: z.enum(["xlsx", "pdf"]),
  packageId: z.string().trim().min(1).optional(),
  userId: z.string().trim().min(1).optional(),
});

const SEVIYE_LABEL: Record<string, string> = {
  BASARILI: "Başarılı",
  EGITIM_GEREKLI: "Eğitim Gerekli",
  BASARISIZ: "Başarısız",
};
const seviyeText = (s: string | null): string =>
  s ? (SEVIYE_LABEL[s] ?? s) : "Değerlendirilmedi";

const KURSIYER_LABEL: Record<string, string> = {
  BEKLIYOR: "Bekliyor",
  ORNEK_YAPILDI: "Örnek yapıldı",
  FARKLI_DEPARTMAN: "Farklı departman",
  EGITIM_GEREKLI: "Eğitim gerekli",
};
const ORNEK_LABEL: Record<string, string> = {
  PENDING: "Bekliyor",
  BASARILI: "Başarılı",
  TEKRAR_GEREKLI: "Tekrar gerekli",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

// Dosya adı temizliği ifs-aggregate/export ile aynı kural.
const TR_MAP: Record<string, string> = {
  ç: "c", Ç: "C", ğ: "g", Ğ: "G", ı: "i", İ: "I", ö: "o", Ö: "O",
  ş: "s", Ş: "S", ü: "u", Ü: "U",
};
function sanitizeFilename(s: string): string {
  return (
    s
      .replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => TR_MAP[c] ?? c)
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "Rapor"
  );
}
function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

type Satir = Record<string, string | number>;

/** Tek sayfalık çalışma kitabı; sütun genişlikleri başlıktan türetilir. */
function tekSayfaXlsx(
  sayfaAdi: string,
  basliklar: string[],
  satirlar: Satir[],
  genislikler?: number[]
): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(satirlar, { header: basliklar });
  ws["!cols"] = basliklar.map((h, i) => ({
    wch: genislikler?.[i] ?? Math.max(h.length + 2, 12),
  }));
  // Excel sayfa adı 31 karakteri aşamaz.
  XLSX.utils.book_append_sheet(wb, ws, sayfaAdi.slice(0, 31));
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

export async function GET(req: NextRequest) {
  const { session, error } = await requirePermission(IFS_EGITIM_OKUMA);
  if (error) return error;
  const callerId = await resolveAkademiUserId(session);
  if (!callerId) {
    return NextResponse.json(
      { error: "Kullanıcı çözümlenemedi" },
      { status: 401 }
    );
  }
  const kapsamBilgi = await ifsEgitimKapsami(callerId);
  if (!kapsamBilgi.yetkili) {
    return NextResponse.json(ifsKapsamYok(), { status: 403 });
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
  const { kapsam, format, packageId, userId } = parsed.data;

  if ((kapsam === "departman" || kapsam === "kisi") && !packageId) {
    return NextResponse.json({ error: "packageId gerekli" }, { status: 400 });
  }
  if (kapsam === "kisi" && !userId) {
    return NextResponse.json({ error: "userId gerekli" }, { status: 400 });
  }

  const now = new Date();
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
  const pdfResponse = (buffer: Buffer, name: string) =>
    new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name}.pdf"`,
        "Cache-Control": "no-store",
      },
    });

  // ══════════════════════════════════════════════ ozet — satır = departman
  if (kapsam === "ozet") {
    const veri = await ifsEgitimYapisi(kapsamBilgi);
    const basliklar = [
      "Departman",
      "Alan",
      "Görev",
      "Atanmış Kişi",
      "İlerleme %",
      "Eğitim Talebi",
      "Değerlendirilmemiş",
    ];
    const satirlar: Satir[] = veri.departmanlar.map((d) => ({
      Departman: d.ad,
      Alan: d.alanSayisi,
      Görev: d.gorevSayisi,
      "Atanmış Kişi": d.atanmisKisi,
      "İlerleme %": d.ilerlemePct,
      "Eğitim Talebi": d.egitimTalebi,
      // Kayıt var ama karar verilmemiş satır sayısı; 0 kayıt olan departmanda 0.
      Değerlendirilmemiş: Math.max(d.kayitSayisi - d.degerlendirilmisSatir, 0),
    }));
    const ad = `IFS-ozet-${ymd(now)}`;
    if (format === "pdf") {
      return pdfResponse(
        generateIfsEgitimPdfBuffer({
          baslik: "IFS Eğitimleri — Özet",
          altBaslik: `${veri.ozet.departmanSayisi} departman · ${veri.ozet.alanSayisi} alan · ${veri.ozet.gorevSayisi} görev`,
          basliklar,
          satirlar: satirlar.map((r) => basliklar.map((h) => String(r[h] ?? ""))),
          generatedAt: now.toLocaleDateString("tr-TR"),
        }),
        ad
      );
    }
    return xlsxResponse(
      tekSayfaXlsx("Özet", basliklar, satirlar, [34, 8, 10, 14, 12, 14, 20]),
      ad
    );
  }

  // ══════════════════════════════════════════ departman — satır = kişi
  if (kapsam === "departman") {
    const veri = await ifsPaketKisileri(kapsamBilgi, callerId, packageId!);
    if (!veri) {
      return NextResponse.json(
        { error: "IFS paketi bulunamadı" },
        { status: 404 }
      );
    }
    const basliklar = [
      "Kişi",
      "Bölüm",
      "Toplam Görev",
      "Tamamlanan",
      "İlerleme %",
      "Eğitmen Seviye",
      "Eğitmen Giren",
      "Eğitmen Tarih",
      "Key User Seviye",
      "Key User Giren",
      "Key User Tarih",
      "Eğitim Talebi",
    ];
    const satirlar: Satir[] = veri.satirlar.map((s) => ({
      Kişi: s.ad,
      Bölüm: s.bolum ?? "",
      "Toplam Görev": s.toplamGorev,
      Tamamlanan: s.tamamlananGorev,
      "İlerleme %": s.ilerlemePct,
      "Eğitmen Seviye": seviyeText(s.egitmen.seviye),
      "Eğitmen Giren": s.egitmen.girenAd ?? "",
      "Eğitmen Tarih": fmtDate(s.egitmen.girenAt),
      "Key User Seviye": seviyeText(s.keyUser.seviye),
      "Key User Giren": s.keyUser.girenAd ?? "",
      "Key User Tarih": fmtDate(s.keyUser.girenAt),
      "Eğitim Talebi": s.egitimIstenenSayisi,
    }));
    const ad = `IFS-departman-${sanitizeFilename(veri.ad)}-${ymd(now)}`;
    if (format === "pdf") {
      return pdfResponse(
        generateIfsEgitimPdfBuffer({
          baslik: `IFS Eğitimleri — ${veri.ad}`,
          altBaslik: `${veri.satirlar.length} kişi · ${veri.kursSayisi} alan · ${veri.gorevSayisi} görev`,
          basliklar,
          satirlar: satirlar.map((r) => basliklar.map((h) => String(r[h] ?? ""))),
          generatedAt: now.toLocaleDateString("tr-TR"),
        }),
        ad
      );
    }
    return xlsxResponse(
      tekSayfaXlsx("Kişiler", basliklar, satirlar, [
        26, 24, 13, 12, 11, 16, 20, 13, 16, 20, 13, 13,
      ]),
      ad
    );
  }

  // ══════════════════════════════════════════════ kisi — satır = görev
  // tumu=true: dokunulmamış görevler de dosyada olsun — dışarı aktarımda
  // "kayıt yok" satırının eksik olması eksik iş gibi okunuyor.
  const sonuc = await ifsKisiGorevleri(kapsamBilgi, userId!, packageId!, true);
  if (sonuc.hata === "kisi-yok") {
    return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
  }
  if (sonuc.hata === "kapsam-disi") {
    return NextResponse.json(ifsKapsamYok(), { status: 403 });
  }
  if (sonuc.hata === "paket-yok") {
    return NextResponse.json({ error: "IFS paketi bulunamadı" }, { status: 404 });
  }
  const veri = sonuc.veri;
  const basliklar = [
    "Alan",
    "Sıra",
    "Konu",
    "Modül",
    "Alt Modül",
    "IFS Ekranı",
    "Kursiyer Durumu",
    "Örnek Durumu",
    "Kursiyer Açıklaması",
    "Değerlendiren",
    "Değerlendirme Tarihi",
  ];
  const satirlar: Satir[] = veri.gorevler.map((g) => ({
    Alan: g.egitimAdi,
    Sıra: g.gorevSirasi,
    Konu: g.konu,
    Modül: g.modul ?? "",
    "Alt Modül": g.altModul ?? "",
    "IFS Ekranı": g.ifsEkran ?? "",
    "Kursiyer Durumu": KURSIYER_LABEL[g.kursiyerDurum] ?? g.kursiyerDurum,
    "Örnek Durumu": ORNEK_LABEL[g.ornekStatus] ?? g.ornekStatus,
    "Kursiyer Açıklaması": g.ornekAciklama ?? "",
    Değerlendiren: g.degerlendirenAd ?? "",
    "Değerlendirme Tarihi": fmtDate(g.degerlendirildiAt),
  }));
  const ad = `IFS-kisi-${sanitizeFilename(veri.ad)}-${ymd(now)}`;
  if (format === "pdf") {
    return pdfResponse(
      generateIfsEgitimPdfBuffer({
        baslik: `IFS Eğitimleri — ${veri.ad}`,
        altBaslik: [veri.bolum, veri.paketAdi].filter(Boolean).join(" · "),
        basliklar,
        satirlar: satirlar.map((r) => basliklar.map((h) => String(r[h] ?? ""))),
        generatedAt: now.toLocaleDateString("tr-TR"),
      }),
      ad
    );
  }
  return xlsxResponse(
    tekSayfaXlsx("Görevler", basliklar, satirlar, [
      26, 7, 40, 18, 18, 20, 18, 15, 40, 22, 20,
    ]),
    ad
  );
}
