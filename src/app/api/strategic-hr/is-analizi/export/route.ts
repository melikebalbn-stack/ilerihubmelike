// GET /api/strategic-hr/is-analizi/export?liste=ik|amir|calisan
// Rol bazlı iş analizi Excel export'u. Rol iaRolCozumle ile çözülür;
// istenen `liste` kapsamı role karşı doğrulanır (yetkisiz → 403).
//   ik      → İK incelemesindeki formlar (ik/liste ile aynı)
//   amir    → amirin onayındaki formlar (onay/liste ile aynı)
//   calisan → çalışanın kendi güncel formları (loglarim ile aynı)
// `liste` verilmezse öncelik: ik → amir → calisan.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { iaRolCozumle, iaYetkisiz } from "@/lib/is-analizi/ia-yetki";
import * as XLSX from "xlsx";
import { logAuditEvent } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

const DURUM_ETIKET: Record<string, string> = {
  TASLAK: "Taslak",
  AMIR_ONAYINDA: "Amir onayında",
  IK_INCELEMESINDE: "İK incelemesinde",
  ONAYLANDI: "Onaylandı",
  REVIZE_ISTENDI: "Revize istendi",
};

function tarih(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("tr-TR");
}

function xlsxYanit(data: Record<string, any>[], sheet: string, dosya: string, cols: number[]) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheet);
  worksheet["!cols"] = cols.map((wch) => ({ wch }));
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${dosya}_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}

export async function GET(request: NextRequest) {
  const { rol, error } = await iaRolCozumle();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const istenen = searchParams.get("liste");

  // Kapsam çözümü: istenen varsa role karşı doğrula; yoksa öncelik sırası.
  let kapsam: "ik" | "amir" | "calisan";
  if (istenen === "ik" || istenen === "amir" || istenen === "calisan") {
    kapsam = istenen;
  } else {
    kapsam = rol.ik ? "ik" : rol.amir ? "amir" : "calisan";
  }

  if (kapsam === "ik" && !rol.ik) return iaYetkisiz();
  if (kapsam === "amir" && !rol.amir) return iaYetkisiz();

  try {
    if (kapsam === "ik") {
      const formlar = await prisma.iaIsAnalizi.findMany({
        where: { durum: "IK_INCELEMESINDE" },
        orderBy: { amirOnayTarihi: "desc" },
        select: {
          adSoyad: true, sicilNo: true, bolum: true, versiyon: true,
          amir: true, amirPersonnelId: true, amirNotu: true, amirOnayTarihi: true,
          pozisyon: { select: { ad: true } },
          _count: { select: { yapilanIsler: true, yetkinlikler: true } },
        },
      });
      const data = formlar.map((f) => ({
        "Ad Soyad": f.adSoyad,
        "Sicil No": f.sicilNo,
        Bölüm: f.bolum,
        Pozisyon: f.pozisyon?.ad || "",
        Versiyon: f.versiyon,
        Amir: f.amir || "",
        "Amir Atandı": f.amirPersonnelId ? "Evet" : "Hayır",
        "Amir Notu": f.amirNotu || "",
        "Amir Onay Tarihi": tarih(f.amirOnayTarihi),
        "İş Sayısı": f._count.yapilanIsler,
        "Yetkinlik Sayısı": f._count.yetkinlikler,
      }));
      await logAuditEvent({
        action: "IS_ANALIZI_EXPORTED", actorId: rol.userId, targetType: "IS_ANALIZI",
        details: { kapsam: "ik", recordCount: formlar.length },
      });
      return xlsxYanit(data, "IK Incelemesi", "is-analizi-ik", [22, 12, 18, 22, 8, 18, 12, 30, 16, 10, 14]);
    }

    if (kapsam === "amir") {
      const personnelId = rol.personnelId;
      if (!personnelId) return NextResponse.json({ error: "Personel kaydınız bulunamadı." }, { status: 404 });
      const formlar = await prisma.iaIsAnalizi.findMany({
        where: { amirPersonnelId: personnelId, durum: "AMIR_ONAYINDA" },
        orderBy: { createdAt: "desc" },
        select: {
          adSoyad: true, sicilNo: true, bolum: true, durum: true, createdAt: true,
          pozisyon: { select: { ad: true } },
          _count: { select: { yapilanIsler: true, yetkinlikler: true, kararYetkileri: true, isIliskileri: true } },
        },
      });
      const data = formlar.map((f) => ({
        "Ad Soyad": f.adSoyad,
        "Sicil No": f.sicilNo,
        Bölüm: f.bolum,
        Pozisyon: f.pozisyon?.ad || "",
        Durum: DURUM_ETIKET[f.durum] || f.durum,
        Tarih: tarih(f.createdAt),
        "İş Sayısı": f._count.yapilanIsler,
        "Yetkinlik Sayısı": f._count.yetkinlikler,
        "Karar Sayısı": f._count.kararYetkileri,
        "İlişki Sayısı": f._count.isIliskileri,
      }));
      await logAuditEvent({
        action: "IS_ANALIZI_EXPORTED", actorId: rol.userId, targetType: "IS_ANALIZI",
        details: { kapsam: "amir", recordCount: formlar.length },
      });
      return xlsxYanit(data, "Amir Onayi", "is-analizi-amir", [22, 12, 18, 22, 16, 12, 10, 14, 12, 12]);
    }

    // calisan → loglarim (güncel haller: zincirin ucundakiler)
    const personnelId = rol.personnelId;
    if (!personnelId) return NextResponse.json({ error: "Personel kaydınız bulunamadı." }, { status: 404 });
    const hepsi = await prisma.iaIsAnalizi.findMany({
      where: { personelId: personnelId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, durum: true, versiyon: true, oncekiVersiyonId: true, amirNotu: true, createdAt: true,
        pozisyon: { select: { ad: true } },
        _count: { select: { yapilanIsler: true, yetkinlikler: true } },
      },
    });
    const gecilmisIdler = new Set(hepsi.map((f) => f.oncekiVersiyonId).filter(Boolean) as string[]);
    const guncel = hepsi.filter((f) => !gecilmisIdler.has(f.id));
    const data = guncel.map((f) => ({
      Pozisyon: f.pozisyon?.ad || "İş Analizi",
      Versiyon: f.versiyon,
      Durum: DURUM_ETIKET[f.durum] || f.durum,
      Tarih: tarih(f.createdAt),
      "İş Sayısı": f._count.yapilanIsler,
      "Yetkinlik Sayısı": f._count.yetkinlikler,
      "Amir Notu": f.amirNotu || "",
    }));
    await logAuditEvent({
      action: "IS_ANALIZI_EXPORTED", actorId: rol.userId, targetType: "IS_ANALIZI",
      details: { kapsam: "calisan", recordCount: guncel.length },
    });
    return xlsxYanit(data, "Is Analizlerim", "is-analizi-loglarim", [24, 8, 18, 12, 10, 14, 30]);
  } catch (err) {
    console.error("[is-analizi/export] hata:", err);
    return NextResponse.json({ error: "Excel export sırasında bir hata oluştu" }, { status: 500 });
  }
}
