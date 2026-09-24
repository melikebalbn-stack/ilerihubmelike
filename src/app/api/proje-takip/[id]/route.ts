import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/prisma";
import { projeDetaySchema } from "@/app/api/proje-takip/_lib/proje-detay-schema";
import { hesaplaYilHafta } from "@/lib/proje-takip/tarih-hesapla";

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
  const rfpHesap = hesaplaYilHafta(v.rfpTarih);
  const sevkiyatHesap = hesaplaYilHafta(v.sevkiyatTrh);
  const onayHesap = hesaplaYilHafta(v.onayTrh);

  const guncellenen = await prisma.projeTakip.update({
    where: { id },
    data: {
      // ── Proje Bilgileri (satış) ──
      musteriFirma: v.musteriFirma,
      musteriYetkilisi: v.musteriYetkilisi,
      musteriKod: v.musteriKod,
      grupKod: v.grupKod,
      kategori: v.kategori,
      ileriKod: v.ileriKod,
      ileriTanim: v.ileriTanim,
      rfpNo: v.rfpNo,
      rfpTarih: v.rfpTarih ? new Date(v.rfpTarih) : undefined,
      rfpAcilisHafta: rfpHesap?.hafta ?? undefined,
      yil: v.yil,
      kalipFikstur: v.kalipFikstur,
      kalipKodu: v.kalipKodu,
      yillikAdet: v.yillikAdet,
      minimumSipMiktari: v.minimumSipMiktari,
      numuneAdedi: v.numuneAdedi,
      prototipFiyati: v.prototipFiyati,
      prototipParaBirimi: v.prototipParaBirimi,
      nre: v.nre,
      nreParaBirimi: v.nreParaBirimi,
      projeKalipFikstur: v.projeKalipFikstur,
      projeBilgisi: v.projeBilgisi,

      // ── Plant Parametreleri (mühendislik) ──
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
      birimFiyat: v.birimFiyat,
      birimFiyatParaBirimi: v.birimFiyatParaBirimi,
      hedefYillik: v.hedefYillik,
      kalipTutar: v.kalipTutar,
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

      // ── Durum ──
      durum: v.durum,
      muhendislikDoldurmaDurumu: "TAMAMLANDI",
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
