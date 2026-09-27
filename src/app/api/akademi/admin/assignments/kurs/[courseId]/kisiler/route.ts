import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require-permission";
import { kursKisileri } from "@/lib/akademi/kurs-kisileri";

// GET - Bir kursun atanmış kişileri (kurs seçilmeden ASLA çağrılmaz). Kişi arama,
// durum/departman/yaka filtresi (sunucu), sayfalama 50.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { error } = await requirePermission("akademi.admin");
  if (error) return error;

  const { courseId } = await params;
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));

  const { filtreli, durumSayilar, departmanlar, yakalar } = await kursKisileri(courseId, {
    search: searchParams.get("search") ?? "",
    durum: searchParams.get("durum") ?? "all",
    departman: searchParams.get("departman") ?? "all",
    yaka: searchParams.get("yaka") ?? "all",
  });

  const toplam = filtreli.length;
  const sayfa = filtreli.slice((page - 1) * limit, page * limit);

  return NextResponse.json({ kisiler: sayfa, toplam, page, limit, durumSayilar, departmanlar, yakalar });
}
