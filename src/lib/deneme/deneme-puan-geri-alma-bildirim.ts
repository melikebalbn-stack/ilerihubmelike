// IV-FR-27 · Puan geri alma bildirimi — UÇTAN gönderilir.
//
// Yönlendirme bildiriminin (deneme-yonlendirme-bildirim.ts) deseniyle birebir:
// cron'a bırakılmaz, çünkü geri alınan form günlük cron penceresinin
// [bugün, bugün+8) DIŞINDA kalmış olabilir — değerlendirici puanını yeniden
// doldurması gerektiğini asla öğrenemezdi.
//
// PersonnelEvaluationEmailLog'a YAZILMAZ: o tablo cron'un 14 günlük tekrar
// engeli; geri alma elle ve tekil bir olaydır.

import { renderEmail, p, esc } from "@/lib/email-templates/layout";
import {
  denemeAliciyaGonder,
  personelinKullanicisi,
  TUR_ETIKET,
  type GonderimSonuc,
} from "@/lib/deneme/deneme-bildirim";
import { denemeBildirimAcikMi } from "@/lib/deneme/deneme-bayrak";
import type { DenemeTur } from "@/generated/prisma";

export type PuanGeriAlmaBildirimGirdi = {
  formId: string;
  tur: DenemeTur;
  hedefTarih: Date;
  /** Değerlendirilen personel. */
  kisi: { adSoyad: string; sicilNo: string | null; bolum: string; gorev: string };
  /** Puanı geri alınan değerlendirici (Personnel id). */
  degerlendiriciPersonnelId: string;
  /** 1 veya 2 — hangi adımın puanı geri alındı. */
  sira: 1 | 2;
  /** Geri alınan ham toplam (bilgi amaçlı; yoksa null). */
  eskiPuan: number | null;
  /** İV'nin yazdığı zorunlu gerekçe. */
  gerekce: string;
  baseUrl?: string;
};

export type PuanGeriAlmaBildirimSonuc =
  | { gonderildi: true; kanal: GonderimSonuc; email: string }
  /** Bayrak kapalı ya da alıcının User hesabı yok — geri alma YİNE DE geçerli. */
  | { gonderildi: false; sebep: string };

/**
 * Değerlendiriciye "puanınız geri alındı, yeniden doldurun" bildirimi.
 * Geri almanın kendisi bu fonksiyon patlasa bile GEÇERLİDİR.
 */
export async function puanGeriAlmaBildirimiGonder(
  g: PuanGeriAlmaBildirimGirdi,
): Promise<PuanGeriAlmaBildirimSonuc> {
  if (!denemeBildirimAcikMi()) {
    return { gonderildi: false, sebep: "Deneme bildirim bayrağı kapalı — bildirim gönderilmedi." };
  }

  const alici = await personelinKullanicisi(g.degerlendiriciPersonnelId);
  if (!alici) {
    return { gonderildi: false, sebep: "Değerlendiricinin aktif kullanıcı hesabı yok — bildirim ulaşmadı." };
  }

  const etiket = TUR_ETIKET[g.tur];
  const base = g.baseUrl ?? process.env.NEXTAUTH_URL ?? "https://hub.ilerigroup.com";
  const link = `${base}/deneme/${g.formId}`;
  const hedefStr = g.hedefTarih.toLocaleDateString("tr-TR");

  const { html, text } = renderEmail({
    module: "İnsan Varlıkları",
    title: `${etiket} değerlendirmesinde puanınız geri alındı`,
    subtitle: `${g.kisi.adSoyad} · ${g.kisi.sicilNo ?? "-"}`,
    preheader: `${g.kisi.adSoyad} değerlendirmesini yeniden doldurmanız gerekiyor.`,
    bodyHtml:
      p(
        `<strong>${esc(g.kisi.adSoyad)}</strong> personelinin <strong>${esc(etiket)}</strong> deneme değerlendirmesinde verdiğiniz puan, İnsan Varlıkları tarafından <strong>geri alındı</strong>.`,
      ) +
      p(
        `Form yeniden <strong>sizin adımınıza</strong> döndü ve <strong>yeniden doldurmanız</strong> gerekiyor. Önceki puanlarınız silindi; formu açtığınızda boş göreceksiniz.`,
      ),
    infoRows: [
      { label: "Personel", value: `${esc(g.kisi.adSoyad)} (${esc(g.kisi.sicilNo ?? "-")})` },
      { label: "Bölüm", value: esc(g.kisi.bolum) },
      { label: "Görev", value: esc(g.kisi.gorev) },
      { label: "Değerlendirme türü", value: esc(etiket) },
      { label: "Son tarih", value: esc(hedefStr) },
      { label: "Adımınız", value: `${g.sira}. Değerlendirici` },
      ...(g.eskiPuan !== null
        ? [{ label: "Geri alınan puan", value: `${g.eskiPuan} / 100` }]
        : []),
      { label: "Geri alma gerekçesi", value: esc(g.gerekce) },
    ],
    cta: { label: "Formu Aç", url: link },
    footnote: "Bu işlem İnsan Varlıkları tarafından yapılmıştır.",
  });

  const konu = `🔄 ${etiket} Değerlendirmesinde Puanınız Geri Alındı — ${g.kisi.adSoyad}`;
  const kanal = await denemeAliciyaGonder(
    alici,
    konu,
    text,
    html,
    link,
    `${etiket} değerlendirmesinde puanınız geri alındı`,
  );
  return { gonderildi: kanal.mail || kanal.inApp, kanal, email: alici.email } as PuanGeriAlmaBildirimSonuc;
}
