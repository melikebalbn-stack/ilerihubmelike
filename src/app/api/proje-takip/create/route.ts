import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/prisma";
import { yeniProjeSchema } from "../_lib/schema";
import { generateProjeNo } from "../_lib/proje-no";
import { projeAcildiBildirimGonder } from "../_lib/bildirim";
import { hesaplaYilHafta } from "@/lib/proje-takip/tarih-hesapla";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await req.json();
  const parsed = yeniProjeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Geçersiz form verisi", detay: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const v = parsed.data;
  const projeNo = await generateProjeNo();
  const rfpHesap = hesaplaYilHafta(v.rfpTarih);

  const kayit = await prisma.projeTakip.create({
    data: {
      projeNo,
      musteriFirma: v.musteriFirma,
      musteriYetkilisi: v.musteriYetkilisi,
      musteriKod: v.musteriKod,
      grupKod: v.grupKod,
      kategori: v.kategori,
      ileriKod: v.ileriKod,
      ileriTanim: v.ileriTanim,
      rfpNo: v.rfpNo,
      rfpTarih: v.rfpTarih ? new Date(v.rfpTarih) : null,
      rfpAcilisHafta: rfpHesap?.hafta ?? null,
      yil: v.yil,
      kalipFikstur: v.kalipFikstur,
      kalipKodu: v.kalipKodu,
      muhendislikSorumluId: null, // proje sorumlusuz açılıyor, atama detay ekranında yapılıyor
      yillikAdet: v.yillikAdet,
      minimumSipMiktari: v.minimumSipMiktari,
      numuneAdedi: v.numuneAdedi,
      prototipFiyati: v.prototipFiyati,
      prototipParaBirimi: v.prototipParaBirimi,
      nre: v.nre,
      nreParaBirimi: v.nreParaBirimi,
      projeKalipFikstur: v.projeKalipFikstur,
      projeBilgisi: v.projeBilgisi,
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
