import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/prisma";
import { muhendislikDoldurSchema } from "@/app/api/proje-takip/_lib/muhendislik-schema";
import { hesaplaYilHafta } from "@/lib/proje-takip/tarih-hesapla";
import { resolveCanSeeProjeFiyat } from "@/lib/proje-takip/can-see-fiyat";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { id } = await params;

  const body = await req.json();
  const sonuc = muhendislikDoldurSchema.safeParse(body);
  if (!sonuc.success) {
    return NextResponse.json(
      { error: "Geçersiz form verisi", detay: sonuc.error.flatten() },
      { status: 400 }
    );
  }

  const v = sonuc.data;
  const sevkiyatHesap = hesaplaYilHafta(v.sevkiyatTrh);
  const onayHesap = hesaplaYilHafta(v.onayTrh);
  const canSeeFiyat = await resolveCanSeeProjeFiyat(user);

  const guncellenen = await prisma.projeTakip.update({
    where: { id },
    data: {
      ileriKod: v.ileriKod,
      revizeTerminTrh: v.revizeTerminTrh ? new Date(v.revizeTerminTrh) : undefined,
      terminProjeTrh: v.terminProjeTrh ? new Date(v.terminProjeTrh) : undefined,
      poNumarasi: v.poNumarasi,
      projeDurumTipi: v.projeDurumTipi,
      sevkiyatTrh: v.sevkiyatTrh ? new Date(v.sevkiyatTrh) : undefined,
      sevkiyatYil: sevkiyatHesap?.yil ?? undefined,
      sevkiyatHafta: sevkiyatHesap?.hafta ?? undefined,
      onayTrh: v.onayTrh ? new Date(v.onayTrh) : undefined,
      onayYil: onayHesap?.yil ?? undefined,
      onayHafta: onayHesap?.hafta ?? undefined,
      aciklama: v.aciklama,
      lokasyon: v.lokasyon,
      // canSeeFiyat false ise bu 4 alan güncelleme datasından tamamen çıkarılır
      // (undefined = Prisma dokunmaz, mevcut değer korunur) - body'de gelse bile
      // sessizce yok sayılır, hata verilmez.
      birimFiyat: canSeeFiyat ? v.birimFiyat : undefined,
      birimFiyatParaBirimi: canSeeFiyat ? v.birimFiyatParaBirimi : undefined,
      hedefYillik: canSeeFiyat ? v.hedefYillik : undefined,
      kalipTutar: canSeeFiyat ? v.kalipTutar : undefined,
      kickOffStatu: v.kickOffStatu,
      poKalip: v.poKalip,
      kickoffCW: v.kickoffCW,
      kickoffYil: v.kickoffYil,
      istemeTrhCW: v.istemeTrhCW,
      istemeTrhYil: v.istemeTrhYil,
      sevkTrhCW: v.sevkTrhCW,
      sevkYil: v.sevkYil,
      poTrhCW: v.poTrhCW,
      poYil: v.poYil,
      poOngCW: v.poOngCW,
      poOngYil: v.poOngYil,
      muhendislikSorumluId: user.id,
      muhendislikDoldurmaDurumu: "TAMAMLANDI",
    },
  });

  await prisma.projeTakipLog.create({
    data: {
      projeTakipId: guncellenen.id,
      islemTipi: "MUHENDISLIK_DOLDURDU",
      yapanId: user.id,
      detay: `Mühendislik plant parametrelerini doldurdu.`,
    },
  });

  return NextResponse.json({ ok: true, projeNo: guncellenen.projeNo });
}
