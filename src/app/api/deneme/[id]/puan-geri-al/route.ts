// IV-FR-27 · POST /api/deneme/[id]/puan-geri-al — İnsan Varlıkları puanlanmış
// bir adımı geri alır: puanlar silinir, damga kalkar, form o adımın bekleme
// durumuna döner. Değerlendirici DEĞİŞMEZ (yönlendirme değil).
//
// NEDEN: yönlendirme ucu "puan girilmiş adım yönlendirilemez" diyor ve bu doğru
// (girilmiş puanı başkasının adı altında bırakmamak için) — ama yanlış puanlanan
// formu düzeltmenin hiçbir yolu yoktu. 29.09.2026'da Fatma Topkara'nın (ILR-01114)
// 6 ay formu 49 puanla MUDUR_BEKLIYOR'a geçti ve düzeltilemedi.
//
// YÖNLENDİRME KAPISI OLDUĞU GİBİ KALIR: önce geri al, sonra istenirse yönlendir.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { aktoruCoz } from "@/lib/deneme/deneme-aktor";
import { ikMi, denemeRedLog } from "@/lib/deneme/deneme-yetki";
import { denemeOrtalama, denemeBasariliMi } from "@/lib/deneme/deneme-transitions";
import { geriAlinabilirMi, geriAlmaSonrasiPuanlar } from "@/lib/deneme/deneme-puan-geri-alma";
import { puanGeriAlmaBildirimiGonder } from "@/lib/deneme/deneme-puan-geri-alma-bildirim";

export const dynamic = "force-dynamic";

const govde = z.object({
  sira: z.union([z.literal(1), z.literal(2)]),
  // Gerekçe ZORUNLU: puan silmenin tek açıklayıcısı denetim kaydıdır.
  gerekce: z.string().trim().min(10, "Gerekçe en az 10 karakter olmalı").max(2000),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { aktor, error } = await aktoruCoz();
  if (error) return error;

  // ── KAPI 1: yalnız İnsan Varlıkları (yönlendirme ucuyla AYNI kapı) ──
  if (!ikMi(aktor)) {
    denemeRedLog({ uc: "puan-geri-al", formId: id, from: "-", to: "-", reason: "İV değil", user: aktor.email });
    return NextResponse.json({ error: "Puan geri alma yetkiniz yok" }, { status: 403 });
  }

  const parsed = govde.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    denemeRedLog({ uc: "puan-geri-al", formId: id, from: "(okunmadı)", to: "-", reason: "gövde şeması geçersiz", user: aktor.email });
    return NextResponse.json({ error: "Geçersiz istek gövdesi", detay: parsed.error.flatten() }, { status: 400 });
  }
  const { sira, gerekce } = parsed.data;

  const form = await prisma.denemeDegerlendirme.findUnique({
    where: { id },
    select: {
      id: true, durum: true, tur: true, hedefTarih: true,
      puan1: true, puan2: true,
      degerlendirici1Id: true, degerlendirici1At: true,
      degerlendirici2Id: true, degerlendirici2At: true, degerlendirici2Rol: true,
      onaylayanId: true, onayTarihi: true,
      personnel: { select: { adSoyad: true, sicilNo: true, bolum: true, gorev: true } },
    },
  });
  if (!form) return NextResponse.json({ error: "Form bulunamadı" }, { status: 404 });

  // Puan satırı sayıları — taslak puan da sayılır (silinecekler).
  const [sira1Sayi, sira2Sayi] = await Promise.all([
    prisma.denemePuan.count({ where: { degerlendirmeId: id, degerlendiriciSira: 1 } }),
    prisma.denemePuan.count({ where: { degerlendirmeId: id, degerlendiriciSira: 2 } }),
  ]);

  // ── KAPI 2: saf kural (deneme-puan-geri-alma.ts) ──
  const karar = geriAlinabilirMi(sira, {
    durum: form.durum,
    degerlendirici1At: form.degerlendirici1At,
    degerlendirici2At: form.degerlendirici2At,
    degerlendirici2Id: form.degerlendirici2Id,
    degerlendirici2Rol: form.degerlendirici2Rol,
    puanSatirSayisi: { sira1: sira1Sayi, sira2: sira2Sayi },
  });
  if (!karar.ok) {
    denemeRedLog({ uc: "puan-geri-al", formId: id, from: form.durum, to: "-", reason: karar.sebep, user: aktor.email });
    return NextResponse.json({ error: karar.sebep }, { status: 400 });
  }

  const eskiDurum = form.durum;
  const eskiPuan = sira === 1 ? form.puan1 : form.puan2;
  const yeniPuanlar = geriAlmaSonrasiPuanlar(sira, { puan1: form.puan1, puan2: form.puan2 });
  const yeniOrtalama = denemeOrtalama(yeniPuanlar.puan1, yeniPuanlar.puan2);
  const degerlendiriciPersonnelId = sira === 1 ? form.degerlendirici1Id : form.degerlendirici2Id;
  // Onay adımı geçilmişse onay izi de düşer: geri alınan puanın üzerine verilmiş
  // onay dayanaksız kalır. Bilgi yanıtta döner, sessizce yutulmaz.
  const onayDusuruldu = !!form.onayTarihi;

  await prisma.$transaction(async (tx) => {
    await tx.denemePuan.deleteMany({ where: { degerlendirmeId: id, degerlendiriciSira: sira } });
    await tx.denemeDegerlendirme.update({
      where: { id },
      data: {
        durum: karar.hedefDurum,
        ...(sira === 1
          ? { puan1: null, degerlendirici1At: null }
          : { puan2: null, degerlendirici2At: null }),
        ortalama: yeniOrtalama,
        basarili: denemeBasariliMi(yeniOrtalama),
        ...(onayDusuruldu ? { onayTarihi: null, onayNotu: null } : {}),
        // Yeni baştan doldurulacak: hatırlatma sıfırdan başlasın.
        hatirlatmaSeviyesi: 0,
        sonHatirlatmaAt: null,
      },
    });
    await tx.denemeDegerlendirmeLog.create({
      data: {
        degerlendirmeId: id,
        eskiDurum,
        yeniDurum: karar.hedefDurum,
        olayTipi: "PUAN_GERI_ALMA",
        // Denetim aktörü GERÇEK User.id (FK) — "sistem" yalnız cron işleri için.
        aktorId: aktor.userId,
        aciklama:
          `${sira}. değerlendiricinin puanı geri alındı` +
          (eskiPuan !== null ? ` (ham toplam ${eskiPuan})` : "") +
          `${onayDusuruldu ? " · onay izi de düşürüldü" : ""} · Gerekçe: ${gerekce}`,
      },
    });
  });

  // ── Bildirim UÇTAN, COMMIT SONRASI — patlarsa geri alma GEÇERLİ kalır ──
  let bildirim: Awaited<ReturnType<typeof puanGeriAlmaBildirimiGonder>>;
  try {
    bildirim = degerlendiriciPersonnelId
      ? await puanGeriAlmaBildirimiGonder({
          formId: id,
          tur: form.tur,
          hedefTarih: form.hedefTarih,
          kisi: form.personnel,
          degerlendiriciPersonnelId,
          sira,
          eskiPuan,
          gerekce,
        })
      : { gonderildi: false, sebep: "Adımın değerlendiricisi tanımlı değil — bildirim gönderilmedi." };
  } catch (e) {
    console.error("[deneme/puan-geri-al] bildirim:", e);
    bildirim = { gonderildi: false, sebep: "Bildirim gönderilemedi (teknik hata) — geri alma geçerli." };
  }

  return NextResponse.json({
    ok: true,
    sira,
    durum: karar.hedefDurum,
    silinenPuanSatiri: sira === 1 ? sira1Sayi : sira2Sayi,
    geriAlinanPuan: eskiPuan,
    onayDusuruldu,
    bildirim,
  });
}
