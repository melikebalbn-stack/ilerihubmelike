import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { musteriAra } from "@/lib/proje-takip/ifs-musteri";

export const dynamic = "force-dynamic";

// Salt okuma: Yeni Proje formunda Müşteri Firma alanından çıkılınca çağrılır.
// IFS'e ulaşılamazsa (env yok / token / HTTP hatası) KONTROL_EDILEMEDI döner —
// bu "müşteri yok" DEĞİLDİR, UI "Satışa Bildir" göstermez.
export async function GET(req: NextRequest) {
  const { error } = await requireUser();
  if (error) return error;

  // Değer müşteri adı ya da CustomerId olabilir (bkz. musteriAra).
  const ad = req.nextUrl.searchParams.get("ad")?.trim() ?? "";
  if (!ad) {
    return NextResponse.json({ error: "Müşteri adı/kodu gerekli" }, { status: 400 });
  }

  try {
    const sonuc = await musteriAra(ad);
    return NextResponse.json(sonuc);
  } catch (e) {
    console.error("[proje-takip] IFS müşteri kontrolü yapılamadı:", e);
    return NextResponse.json({ durum: "KONTROL_EDILEMEDI" }, { status: 503 });
  }
}
