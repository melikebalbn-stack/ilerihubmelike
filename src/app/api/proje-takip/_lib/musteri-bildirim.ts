import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { getSatisPazarlamaEkibi, type SatisPazarlamaKisi } from "./satis-pazarlama-ekibi";

/**
 * "Satışa Bildir" — Yeni Proje formunda müşteri IFS'te bulunamadığında, IFS'te
 * müşteri açılması için Satış & Pazarlama Müdürlüğü'ne bildirim.
 *
 * Alıcı seçimi (Melih Bey'in kuralı, 2026-09-29): bildirim KİŞİYE değil BÖLÜME
 * bağlı — getSatisPazarlamaEkibi()'ndeki tüm aktif+hesaplı kişilere gider. Kodda
 * sabit User.id / kişi adı YOK. 2 kanal: email + in-app (push yok, bildirim.ts ile
 * aynı). Kanal izolasyonu: Promise.allSettled.
 */

const esc = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

type Bildiren = { name: string | null; email: string };

export class MusteriBildirimHatasi extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MusteriBildirimHatasi";
  }
}

async function sendMusteriAcmaEmail(
  alici: SatisPazarlamaKisi,
  musteriFirma: string,
  bildiren: Bildiren
): Promise<void> {
  const aliciAdi = alici.name ?? alici.email;
  const bildirenAdi = bildiren.name ?? bildiren.email;
  const subject = `[ILERIHub] IFS'te müşteri açılması gerekiyor: ${musteriFirma}`;
  const body = `Merhaba ${aliciAdi},

Bu proje için IFS'te müşteri açılması gerekiyor.

Müşteri: ${musteriFirma}
Bildiren: ${bildirenAdi}

Yeni Proje formunda girilen bu müşteri IFS'te bulunamadı.`;
  const html = `
    <p>Merhaba ${esc(aliciAdi)},</p>
    <p>Bu proje için <strong>IFS'te müşteri açılması gerekiyor</strong>.</p>
    <p>Müşteri: <strong>${esc(musteriFirma)}</strong><br/>Bildiren: ${esc(bildirenAdi)}</p>
    <p>Yeni Proje formunda girilen bu müşteri IFS'te bulunamadı.</p>
  `;

  // sendEmail hata fırlatmıyor, { success: false } dönüyor — allSettled'ın
  // görebilmesi için burada hataya çevriliyor.
  const sonuc = await sendEmail([{ name: aliciAdi, email: alici.email }], subject, body, html);
  if (!sonuc.success) throw new Error(sonuc.error ?? "E-posta gönderilemedi");
}

async function createMusteriAcmaInAppNotification(
  alici: SatisPazarlamaKisi,
  musteriFirma: string,
  bildiren: Bildiren
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: alici.id,
      title: "IFS'te Müşteri Açılması Gerekiyor",
      message: `Bu proje için IFS'te müşteri açılması gerekiyor: "${musteriFirma}" (bildiren: ${bildiren.name ?? bildiren.email}).`,
      type: "WARNING",
    },
  });
}

export async function musteriAcmaBildirimGonder(
  musteriFirma: string,
  bildiren: Bildiren
): Promise<{ aliciSayisi: number }> {
  const alicilar = await getSatisPazarlamaEkibi();
  if (alicilar.length === 0) {
    throw new MusteriBildirimHatasi(
      "Satış & Pazarlama Müdürlüğü'nde bildirim alacak aktif hesap bulunamadı"
    );
  }

  const results = await Promise.allSettled(
    alicilar.flatMap((r) => [
      sendMusteriAcmaEmail(r, musteriFirma, bildiren),
      createMusteriAcmaInAppNotification(r, musteriFirma, bildiren),
    ])
  );

  results.forEach((r, i) => {
    if (r.status === "rejected") {
      const alici = alicilar[Math.floor(i / 2)];
      const kanal = i % 2 === 0 ? "email" : "in-app";
      console.error(`[proje-takip] müşteri açma bildirimi → ${alici.email} (${kanal}) hatası:`, r.reason);
    }
  });

  if (results.every((r) => r.status === "rejected")) {
    throw new MusteriBildirimHatasi("Bildirim hiçbir kanaldan gönderilemedi");
  }
  return { aliciSayisi: alicilar.length };
}
