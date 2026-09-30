import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { musteriAraCanli } from "@/lib/proje-takip/ifs-musteri";

export const dynamic = "force-dynamic";

// Canlı arama: Müşteri Firma autocomplete'i (MusteriAramaInput) yazdıkça çağırır.
// En az 2 karakter — altında IFS'e gidilmez. IFS'e ulaşılamazsa (env yok / token /
// HTTP hatası) KONTROL_EDILEMEDI döner — bu "müşteri yok" DEĞİLDİR, UI "Satışa
// Bildir" göstermez.
const MIN_KARAKTER = 2;

export async function GET(req: NextRequest) {
  const { error } = await requireUser();
  if (error) return error;

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < MIN_KARAKTER) {
    return NextResponse.json(
      { error: `En az ${MIN_KARAKTER} karakter gerekli` },
      { status: 400 }
    );
  }

  try {
    const musteriler = await musteriAraCanli(q);
    return NextResponse.json({ durum: "TAMAM", musteriler });
  } catch (e) {
    console.error("[proje-takip] IFS müşteri araması yapılamadı:", e);
    return NextResponse.json({ durum: "KONTROL_EDILEMEDI" }, { status: 503 });
  }
}
