import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { format } from "date-fns";
import { generateKadroTalepPdfBuffer } from "@/lib/pdf/kadro-talep-pdf";

// GET .../personnel-requests/bos-form/pdf — elle doldurulabilir BOŞ IV-FR-24 formu.
// Yetki: oturum yeterli (İK dışı da yazdırabilsin). Filigran YOK (zaten boş form).
// Not: 'bos-form' statik segment olduğundan [id] dinamik route'undan önce eşleşir.
export async function GET() {
  try {
    const { error } = await requireSession();
    if (error) return error; // oturumsuz → 401

    const buffer = generateKadroTalepPdfBuffer(null, { bosForm: true });
    const fileName = `IV-FR-24_bos-form_${format(new Date(), "yyyyMMdd")}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    console.error("Kadro boş form PDF hatası:", err);
    return NextResponse.json(
      { error: "PDF oluşturulurken hata oluştu" },
      { status: 500 }
    );
  }
}
