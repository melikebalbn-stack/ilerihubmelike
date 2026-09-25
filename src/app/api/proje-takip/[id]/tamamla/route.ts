import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Kaydet'ten ayrı, kendi başına bir aksiyon: sadece muhendislikDoldurmaDurumu
// bayrağını TAMAMLANDI yapar - kullanıcıdan alınan bir veri yok, bu yüzden
// projeDetaySchema'nın tam-form validasyonuna tabi değil.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { id } = await params;

  const guncellenen = await prisma.projeTakip.update({
    where: { id },
    data: { muhendislikDoldurmaDurumu: "TAMAMLANDI" },
  });

  await prisma.projeTakipLog.create({
    data: {
      projeTakipId: guncellenen.id,
      islemTipi: "MUHENDISLIK_DOLDURDU",
      yapanId: user.id,
      detay: "Mühendislik girişi tamamlandı olarak işaretlendi.",
    },
  });

  return NextResponse.json({ ok: true });
}
