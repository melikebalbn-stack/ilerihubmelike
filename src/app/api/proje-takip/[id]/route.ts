import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/prisma";
import { projeDetaySchema } from "@/app/api/proje-takip/_lib/proje-detay-schema";
import { projeDetayAlanlari } from "@/app/api/proje-takip/_lib/proje-detay-map";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { id } = await params;

  const mevcut = await prisma.projeTakip.findUnique({
    where: { id },
    select: { durum: true },
  });
  if (!mevcut) {
    return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
  }

  const body = await req.json();
  const sonuc = projeDetaySchema.safeParse(body);
  if (!sonuc.success) {
    return NextResponse.json(
      { error: "Geçersiz form verisi", detay: sonuc.error.flatten() },
      { status: 400 }
    );
  }

  const v = sonuc.data;

  const guncellenen = await prisma.projeTakip.update({
    where: { id },
    data: {
      ...projeDetayAlanlari(v),
      durum: v.durum,
    },
  });

  const durumDegisti = v.durum !== undefined && v.durum !== mevcut.durum;

  await prisma.projeTakipLog.create({
    data: {
      projeTakipId: guncellenen.id,
      islemTipi: durumDegisti ? "DURUM_DEGISTI" : "MUHENDISLIK_DOLDURDU",
      yapanId: user.id,
      detay: durumDegisti
        ? `Durum ${mevcut.durum} → ${v.durum} olarak değiştirildi.`
        : `Proje bilgileri güncellendi.`,
    },
  });

  return NextResponse.json({ ok: true, projeNo: guncellenen.projeNo });
}
