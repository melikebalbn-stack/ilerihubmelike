import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";
import { kursKisileri } from "@/lib/akademi/kurs-kisileri";
import { DURUM_ETIKET } from "@/lib/akademi/atama-model";

const YAKA_ET: Record<string, string> = { MAVI: "Mavi", BEYAZ: "Beyaz", GRI: "Gri" };

// GET - Filtreli tam kişi listesini Excel olarak indir (server-side).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { error } = await requirePermission("akademi.admin");
  if (error) return error;

  const { courseId } = await params;
  const { searchParams } = new URL(request.url);

  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { title: true } });
  const { filtreli } = await kursKisileri(courseId, {
    search: searchParams.get("search") ?? "",
    durum: searchParams.get("durum") ?? "all",
    departman: searchParams.get("departman") ?? "all",
    yaka: searchParams.get("yaka") ?? "all",
  });

  const trTarih = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("tr-TR") : "");
  const rows = filtreli.map((k) => ({
    "Kullanıcı": k.ad,
    "Departman": k.departman,
    "Yaka": k.yaka ? YAKA_ET[k.yaka] ?? k.yaka : "",
    "Atandı": trTarih(k.atandi),
    "Son Tarih": trTarih(k.dueDate),
    "İlerleme %": k.ilerleme,
    "Durum": DURUM_ETIKET[k.durum],
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Atamalar");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const safeTitle = (course?.title ?? "kurs").replace(/[^\p{L}\p{N}_-]+/gu, "_").slice(0, 40);
  const fileName = `atama-${safeTitle}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
