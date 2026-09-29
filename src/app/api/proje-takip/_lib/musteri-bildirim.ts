import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

/**
 * "Satışa Bildir" — Yeni Proje formunda müşteri IFS'te bulunamadığında, IFS'te
 * müşteri açılması için Azra İleri'ye bildirim. 2 kanal: email + in-app (push yok,
 * bildirim.ts ile aynı). Kanal izolasyonu: Promise.allSettled.
 *
 * Alıcı isimle ARANMAZ: Personnel.adSoyad üzerinden "Azra İleri" araması pasif ve
 * User hesabı olmayan başka bir kayda düşüyor (bkz. docs/proje-takip/VERI-KALITESI-NOTLARI.md).
 * Dev DB'de doğrulandı (2026-09-28): ad_azra.ileri · azra.ileri@ilerigroup.com · aktif.
 * Prod'da aynı id olduğu Melih Bey tarafından doğrulanmalı.
 */
export const IFS_MUSTERI_ACMA_SORUMLUSU_ID = "ad_azra.ileri";

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
  alici: { name: string; email: string },
  musteriFirma: string,
  bildiren: Bildiren
): Promise<void> {
  const bildirenAdi = bildiren.name ?? bildiren.email;
  const subject = `[ILERIHub] IFS'te müşteri açılması gerekiyor: ${musteriFirma}`;
  const body = `Merhaba ${alici.name},

Bu proje için IFS'te müşteri açılması gerekiyor.

Müşteri: ${musteriFirma}
Bildiren: ${bildirenAdi}

Yeni Proje formunda girilen bu müşteri IFS'te bulunamadı.`;
  const html = `
    <p>Merhaba ${esc(alici.name)},</p>
    <p>Bu proje için <strong>IFS'te müşteri açılması gerekiyor</strong>.</p>
    <p>Müşteri: <strong>${esc(musteriFirma)}</strong><br/>Bildiren: ${esc(bildirenAdi)}</p>
    <p>Yeni Proje formunda girilen bu müşteri IFS'te bulunamadı.</p>
  `;

  // sendEmail hata fırlatmıyor, { success: false } dönüyor — allSettled'ın
  // görebilmesi için burada hataya çevriliyor.
  const sonuc = await sendEmail([alici], subject, body, html);
  if (!sonuc.success) throw new Error(sonuc.error ?? "E-posta gönderilemedi");
}

async function createMusteriAcmaInAppNotification(
  aliciId: string,
  musteriFirma: string,
  bildiren: Bildiren
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: aliciId,
      title: "IFS'te Müşteri Açılması Gerekiyor",
      message: `Bu proje için IFS'te müşteri açılması gerekiyor: "${musteriFirma}" (bildiren: ${bildiren.name ?? bildiren.email}).`,
      type: "WARNING",
    },
  });
}

export async function musteriAcmaBildirimGonder(
  musteriFirma: string,
  bildiren: Bildiren
): Promise<void> {
  const alici = await prisma.user.findUnique({
    where: { id: IFS_MUSTERI_ACMA_SORUMLUSU_ID },
    select: { id: true, name: true, email: true, isActive: true },
  });
  if (!alici || !alici.isActive) {
    throw new MusteriBildirimHatasi(
      `Bildirim alıcısı (${IFS_MUSTERI_ACMA_SORUMLUSU_ID}) bulunamadı veya pasif`
    );
  }
  const aliciAdi = alici.name ?? alici.email;

  const results = await Promise.allSettled([
    sendMusteriAcmaEmail({ name: aliciAdi, email: alici.email }, musteriFirma, bildiren),
    createMusteriAcmaInAppNotification(alici.id, musteriFirma, bildiren),
  ]);

  const kanallar = ["email", "in-app"] as const;
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`[proje-takip] müşteri açma bildirimi (${kanallar[i]}) → ${alici.email} hatası:`, r.reason);
    }
  });

  if (results.every((r) => r.status === "rejected")) {
    throw new MusteriBildirimHatasi("Bildirim hiçbir kanaldan gönderilemedi");
  }
}
