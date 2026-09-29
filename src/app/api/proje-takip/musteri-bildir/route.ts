import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import {
  musteriAcmaBildirimGonder,
  MusteriBildirimHatasi,
} from "@/app/api/proje-takip/_lib/musteri-bildirim";

export const dynamic = "force-dynamic";

const govdeSchema = z.object({
  musteriFirma: z.string().trim().min(1).max(200),
});

// "Satışa Bildir": müşteri IFS'te bulunamadığında IFS'te müşteri açılması için
// Azra İleri'ye email + in-app bildirim (bkz. _lib/musteri-bildirim.ts).
export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const sonuc = govdeSchema.safeParse(await req.json().catch(() => null));
  if (!sonuc.success) {
    return NextResponse.json({ error: "Geçersiz müşteri adı" }, { status: 400 });
  }

  try {
    await musteriAcmaBildirimGonder(sonuc.data.musteriFirma, {
      name: user.name,
      email: user.email,
    });
  } catch (e) {
    console.error("[proje-takip] müşteri açma bildirimi gönderilemedi:", e);
    const mesaj = e instanceof MusteriBildirimHatasi ? e.message : "Bildirim gönderilemedi";
    return NextResponse.json({ error: mesaj }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
