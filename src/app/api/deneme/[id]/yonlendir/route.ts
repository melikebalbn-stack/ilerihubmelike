// IV-FR-27 · POST /api/deneme/[id]/yonlendir — İnsan Varlıkları bir adımın
// DEĞERLENDİRİCİSİNİ değiştirir. GET ile aday listesi döner.
//
// `aktar` ucundan FARKI: aktar, müdür yardımcısının kendi adımını bir üst
// kademeye taşımasıdır (tek yön, tek durum, zincir içi). Yönlendirme ise İV'nin
// HERHANGİ bir adımı HERHANGİ bir aktif personele devretmesidir. Bu yüzden
// zincir üyelerine AÇILMAZ: değerlendiricinin kendi değerlendirmesini seçtiği
// birine devretmesi, formun gizlilik ve tarafsızlık varsayımını bozar.
//
// DEĞİŞMEZLER: atama sonradan değiştiği için zincir çözücüsünün açılış anındaki
// kontrolleri burada TEKRAR uygulanır — ortak kaynak deneme-degismezler.ts.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { aktoruCoz } from "@/lib/deneme/deneme-aktor";
import { ikMi, denemeRedLog } from "@/lib/deneme/deneme-yetki";
import { degerlendiriciAtamasiGecerliMi } from "@/lib/deneme/deneme-degismezler";
import { yonlendirmeBildirimiGonder } from "@/lib/deneme/deneme-yonlendirme-bildirim";
import type { DenemeDurum, DenemeDegerlendiriciRol } from "@/generated/prisma";

export const dynamic = "force-dynamic";

/** Yönlendirilemeyecek durumlar — form kapalı ya da değerlendirici adımı kalmamış. */
const KAPALI_DURUMLAR: DenemeDurum[] = ["TAMAMLANDI", "IPTAL"];

const govde = z.object({
  sira: z.union([z.literal(1), z.literal(2)]),
  hedefPersonnelId: z.string().min(1),
  // Gerekçe ZORUNLU: yönlendirme denetim izinin tek açıklayıcısı.
  gerekce: z.string().trim().min(10, "Gerekçe en az 10 karakter olmalı").max(2000),
});

/**
 * GET — hedef seçimi için aday listesi (aktif + aktif User hesabı olanlar).
 * Kapı POST ile AYNI (ikMi): formu yönlendirebilen listeyi de görür.
 * `/api/personnel/secici` KULLANILMAZ — o uç rol tabanlı (ADMIN/HR_MANAGER) ve
 * yalnız `recruitment.admin` taşıyan İV kullanıcısına 403 döner.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { aktor, error } = await aktoruCoz();
  if (error) return error;
  if (!ikMi(aktor)) {
    denemeRedLog({ uc: "yonlendir/adaylar", formId: id, from: "-", to: "-", reason: "İV değil", user: aktor.email });
    return NextResponse.json({ error: "Yönlendirme yetkiniz yok" }, { status: 403 });
  }

  // User hesabı OLMAYAN aday listelenmez: yönlendirme yapılsa bile bildirim
  // ulaşmaz ve kişi formu açamaz (oturum yok) — form sessizce tıkanırdı.
  const adaylar = await prisma.personnel.findMany({
    where: { aktif: true, user: { isActive: true } },
    select: { id: true, adSoyad: true, sicilNo: true, bolum: true, gorev: true },
    orderBy: { adSoyad: "asc" },
  });
  return NextResponse.json({ adaylar });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { aktor, error } = await aktoruCoz();
  if (error) return error;

  // ── KAPI 1: yalnız İnsan Varlıkları (hr.admin ∨ recruitment.admin) ──
  if (!ikMi(aktor)) {
    denemeRedLog({ uc: "yonlendir", formId: id, from: "-", to: "-", reason: "İV değil", user: aktor.email });
    return NextResponse.json({ error: "Yönlendirme yetkiniz yok" }, { status: 403 });
  }

  const parsed = govde.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    denemeRedLog({ uc: "yonlendir", formId: id, from: "(okunmadı)", to: "-", reason: "gövde şeması geçersiz", user: aktor.email });
    return NextResponse.json({ error: "Geçersiz istek gövdesi", detay: parsed.error.flatten() }, { status: 400 });
  }
  const { sira, hedefPersonnelId, gerekce } = parsed.data;

  const form = await prisma.denemeDegerlendirme.findUnique({
    where: { id },
    select: {
      id: true, durum: true, tur: true, hedefTarih: true, personnelId: true,
      degerlendirici1Id: true, degerlendirici1At: true,
      degerlendirici2Id: true, degerlendirici2At: true,
      onaylayanId: true,
      personnel: {
        select: {
          adSoyad: true, sicilNo: true, bolum: true, gorev: true,
          department: { select: { mudurId: true, mudurYardimcisiId: true } },
        },
      },
    },
  });
  if (!form) return NextResponse.json({ error: "Form bulunamadı" }, { status: 404 });

  // ── KAPI 2: form kapalı olmamalı ──
  if (KAPALI_DURUMLAR.includes(form.durum)) {
    denemeRedLog({ uc: "yonlendir", formId: id, from: form.durum, to: "-", reason: "form kapalı", user: aktor.email });
    return NextResponse.json({ error: "Kapanmış ya da iptal edilmiş form yönlendirilemez" }, { status: 400 });
  }

  // ── KAPI 3: hedef adım var mı ──
  // Tek puanlı yakalarda (gri/beyaz) 2. adım YOKTUR — olmayan adım yönlendirilemez.
  if (sira === 2 && !form.degerlendirici2Id) {
    return NextResponse.json({ error: "Bu formda 2. değerlendirici adımı yok" }, { status: 400 });
  }

  // ── KAPI 4: hedef adım HENÜZ PUANLANMAMIŞ olmalı ──
  // İki kanıt birlikte aranır: gönderim damgası (degerlendiriciNAt) ve o sıraya
  // yazılmış puan satırı. Taslak puan da sayılır — yönlendirme, girilmiş puanı
  // başka kişinin adı altında bırakırdı.
  const damga = sira === 1 ? form.degerlendirici1At : form.degerlendirici2At;
  if (damga) {
    denemeRedLog({ uc: "yonlendir", formId: id, from: form.durum, to: "-", reason: `${sira}. adım puanlanmış`, user: aktor.email });
    return NextResponse.json({ error: `${sira}. değerlendirici puanını vermiş — yönlendirilemez` }, { status: 400 });
  }
  const puanSayisi = await prisma.denemePuan.count({
    where: { degerlendirmeId: id, degerlendiriciSira: sira },
  });
  if (puanSayisi > 0) {
    denemeRedLog({ uc: "yonlendir", formId: id, from: form.durum, to: "-", reason: `${sira}. sırada ${puanSayisi} puan satırı`, user: aktor.email });
    return NextResponse.json({ error: `${sira}. değerlendirici puan girmiş (taslak dahil) — yönlendirilemez` }, { status: 400 });
  }

  // ── KAPI 5: hedef personel aktif + aktif User hesabı ──
  const hedef = await prisma.personnel.findUnique({
    where: { id: hedefPersonnelId },
    select: { id: true, adSoyad: true, sicilNo: true, aktif: true, user: { select: { isActive: true } } },
  });
  if (!hedef) return NextResponse.json({ error: "Hedef personel bulunamadı" }, { status: 400 });
  if (!hedef.aktif) return NextResponse.json({ error: `${hedef.adSoyad} pasif — yönlendirilemez` }, { status: 400 });
  if (!hedef.user?.isActive) {
    return NextResponse.json(
      { error: `${hedef.adSoyad} için aktif kullanıcı hesabı yok — formu açamaz ve bildirim ulaşmaz` },
      { status: 400 },
    );
  }

  const mevcutId = sira === 1 ? form.degerlendirici1Id : form.degerlendirici2Id;
  if (mevcutId === hedef.id) {
    return NextResponse.json({ error: `${hedef.adSoyad} zaten ${sira}. değerlendirici` }, { status: 400 });
  }

  // ── KAPI 6: DEĞİŞMEZLER (deneme-degismezler.ts) — önerilen atama üzerinden ──
  const oneri = {
    personnelId: form.personnelId,
    degerlendirici1Id: sira === 1 ? hedef.id : form.degerlendirici1Id,
    degerlendirici2Id: sira === 2 ? hedef.id : form.degerlendirici2Id,
  };
  const degismez = degerlendiriciAtamasiGecerliMi(oneri);
  if (!degismez.ok) {
    denemeRedLog({ uc: "yonlendir", formId: id, from: form.durum, to: "-", reason: `değişmez: ${degismez.sebep}`, user: aktor.email });
    return NextResponse.json({ error: degismez.sebep }, { status: 400 });
  }

  // ── Rol ve (2. adımda) akışın devamı ──
  // Rol, hedefin BÖLÜMDEKİ koltuğundan çözülür — ad/unvan metninden değil.
  const dept = form.personnel.department;
  const rol: DenemeDegerlendiriciRol =
    dept?.mudurId === hedef.id ? "MUDUR"
      : dept?.mudurYardimcisiId === hedef.id ? "MUDUR_YARDIMCISI"
        : "TAKIM_LIDERI";

  // 2. adım yönlendirilirken akışın DEVAMI da tutarlı kalmalı:
  //   · 2. puanı MÜDÜR verirse ayrı onay adımı YOKTUR → onaylayan NULL
  //   · 2. puanı MÜDÜR YRD. verirse bölüm müdürü onaylar
  // Form zaten 2. adımda bekliyorsa durum da role göre düzeltilir; aksi hâlde
  // puanla ucu MUDUR_YRD_BEKLIYOR'dan ONAY_BEKLIYOR'a geçer ve onaylayan NULL
  // olduğu için form SAHİPSİZ kalırdı.
  let yeniDurum: DenemeDurum = form.durum;
  let yeniOnaylayanId: string | null = form.onaylayanId;
  if (sira === 2) {
    if (rol === "MUDUR") {
      yeniOnaylayanId = null;
      if (form.durum === "MUDUR_YRD_BEKLIYOR") yeniDurum = "MUDUR_BEKLIYOR";
    } else {
      const mudurId = dept?.mudurId ?? null;
      // Müdür, değerlendirilen kişinin ya da yeni değerlendiricinin kendisiyse
      // onay halkası kurulmaz (zincir çözücüsündeki kuralın aynısı).
      yeniOnaylayanId = mudurId && mudurId !== form.personnelId && mudurId !== hedef.id ? mudurId : null;
      if (form.durum === "MUDUR_BEKLIYOR" && yeniOnaylayanId) yeniDurum = "MUDUR_YRD_BEKLIYOR";
    }
  }

  const eskiDurum = form.durum;
  const mevcut = mevcutId
    ? await prisma.personnel.findUnique({ where: { id: mevcutId }, select: { adSoyad: true, sicilNo: true } })
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.denemeDegerlendirme.update({
      where: { id },
      data: {
        ...(sira === 1
          ? { degerlendirici1Id: hedef.id, degerlendirici1Rol: rol }
          : { degerlendirici2Id: hedef.id, degerlendirici2Rol: rol, onaylayanId: yeniOnaylayanId }),
        durum: yeniDurum,
        // Yeni sahibe hatırlatma sıfırdan başlasın: eski sahip için yükselmiş
        // eskalasyon seviyesi, devralan kişinin hatırlatmasını yutardı.
        hatirlatmaSeviyesi: 0,
        sonHatirlatmaAt: null,
      },
    });
    await tx.denemeDegerlendirmeLog.create({
      data: {
        degerlendirmeId: id,
        eskiDurum,
        yeniDurum,
        olayTipi: "YONLENDIRME",
        // Denetim aktörü GERÇEK User.id (FK) — "sistem" yalnız cron işleri için.
        aktorId: aktor.userId,
        aciklama:
          `${sira}. değerlendirici yönlendirildi: ` +
          `${mevcut ? `${mevcut.adSoyad}${mevcut.sicilNo ? ` (${mevcut.sicilNo})` : ""}` : "(boş)"} → ` +
          `${hedef.adSoyad}${hedef.sicilNo ? ` (${hedef.sicilNo})` : ""} · Gerekçe: ${gerekce}`,
      },
    });
  });

  // ── Bildirim UÇTAN (cron'a bırakılmaz) ──
  // Yönlendirme COMMIT edildikten SONRA gönderilir ve başarısızlığı işlemi
  // GERİ ALMAZ: kayıt doğru, yalnız haber ulaşmamıştır — sonuç yanıtta döner.
  const sonrakiAd =
    sira === 1 && form.degerlendirici2Id
      ? (await prisma.personnel.findUnique({ where: { id: form.degerlendirici2Id }, select: { adSoyad: true } }))?.adSoyad ?? null
      : null;

  let bildirim: Awaited<ReturnType<typeof yonlendirmeBildirimiGonder>>;
  try {
    bildirim = await yonlendirmeBildirimiGonder({
      formId: id,
      tur: form.tur,
      hedefTarih: form.hedefTarih,
      kisi: form.personnel,
      hedefPersonnelId: hedef.id,
      sira,
      gerekce,
      sonrakiAd,
    });
  } catch (e) {
    console.error("[deneme/yonlendir] bildirim:", e);
    bildirim = { gonderildi: false, sebep: "Bildirim gönderilemedi (teknik hata) — yönlendirme geçerli." };
  }

  return NextResponse.json({
    ok: true,
    durum: yeniDurum,
    sira,
    yeniDegerlendirici: { adSoyad: hedef.adSoyad, sicilNo: hedef.sicilNo, rol },
    bildirim,
  });
}
