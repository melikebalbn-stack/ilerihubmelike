import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/prisma";
import { projeDetaySchema } from "../_lib/proje-detay-schema";
import { projeDetayAlanlari } from "../_lib/proje-detay-map";
import { resolveCanSeeProjeFiyat } from "@/lib/proje-takip/can-see-fiyat.server";
import { generateProjeNo } from "../_lib/proje-no";
import { projeAcildiBildirimGonder } from "../_lib/bildirim";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await req.json();
  const parsed = projeDetaySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Geçersiz form verisi", detay: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const projeNo = await generateProjeNo();
  const canSeeFiyat = await resolveCanSeeProjeFiyat(user);
  const alanlar = projeDetayAlanlari(parsed.data, { canSeeFiyat });

  const kayit = await prisma.projeTakip.create({
    data: {
      ...alanlar,
      projeNo,
      olusturanId: user.id,
      durum: "YENI_DEVAM_EDEN",
      muhendislikDoldurmaDurumu: "BEKLIYOR",
    },
  });

  await prisma.projeTakipLog.create({
    data: {
      projeTakipId: kayit.id,
      islemTipi: "OLUSTURULDU",
      yapanId: user.id,
      detay: `Proje ${projeNo} satış tarafından oluşturuldu.`,
    },
  });

  await projeAcildiBildirimGonder(kayit);

  await prisma.projeTakip.update({
    where: { id: kayit.id },
    data: {
      muhendislikBildirimGonderildiMi: true,
      muhendislikBildirimTarihi: new Date(),
    },
  });

  return NextResponse.json({ projeNo: kayit.projeNo });
}
