import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/prisma";
import { projeAcildiBildirimGonder } from "@/app/api/proje-takip/_lib/bildirim";

export const dynamic = "force-dynamic";

// Manuel/yeniden bildirim gönderimi - Kaydet'ten bağımsız, ayrı bir aksiyon.
// Kaydedilmemiş form değişikliklerini DEĞİL, o an DB'de duran (en son
// kaydedilmiş) proje verisini kullanır.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireUser();
  if (error) return error;

  const { id } = await params;

  const proje = await prisma.projeTakip.findUnique({ where: { id } });
  if (!proje) {
    return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
  }

  await projeAcildiBildirimGonder(proje);

  return NextResponse.json({ ok: true });
}
