// IV-FR-27 · Yönlendirme bildirimi — UÇTAN gönderilir, cron'dan DEĞİL.
//
// NEDEN UÇTAN: günlük cron yalnız `[bugün, bugün+8)` penceresindeki kişileri
// işliyor. Yönlendirmeye en çok ihtiyaç duyulan form GECİKMİŞ formdur ve
// gecikmiş form bu pencereden çıkmış olur — yani cron o forma bir daha
// dokunmaz. 25.09.2026'da ölçülen durum tam buydu: yönlendirme yapıldı, yeni
// sahibe cron'dan hiçbir bildirim üretilemedi, bildirim elle çıkarıldı.
// Bu yüzden yönlendirme kendi bildirimini KENDİSİ gönderir.
//
// PersonnelEvaluationEmailLog'a YAZILMAZ: o tablo cron'un 14 günlük tekrar
// engeli. Yönlendirme ondan bağımsız, elle ve tekil bir olaydır; oraya satır
// yazmak cron'un sonraki meşru hatırlatmasını sessizce yutardı.

import { renderEmail, p, esc } from "@/lib/email-templates/layout";
import {
  denemeAliciyaGonder,
  personelinKullanicisi,
  TUR_ETIKET,
  type GonderimSonuc,
} from "@/lib/deneme/deneme-bildirim";
import { denemeBildirimAcikMi } from "@/lib/deneme/deneme-bayrak";
import type { DenemeTur } from "@/generated/prisma";

export type YonlendirmeBildirimGirdi = {
  formId: string;
  tur: DenemeTur;
  hedefTarih: Date;
  /** Değerlendirilen personel. */
  kisi: { adSoyad: string; sicilNo: string | null; bolum: string; gorev: string };
  /** Yönlendirmenin düştüğü YENİ değerlendirici (Personnel id). */
  hedefPersonnelId: string;
  /** 1 veya 2 — hangi adımın sahibi değişti. */
  sira: 1 | 2;
  /** İV'nin yazdığı zorunlu gerekçe. */
  gerekce: string;
  /** Sonraki halkanın adı (bilgi amaçlı, yoksa null). */
  sonrakiAd: string | null;
  baseUrl?: string;
};

export type YonlendirmeBildirimSonuc =
  | { gonderildi: true; kanal: GonderimSonuc; email: string }
  /** Bayrak kapalı ya da alıcının User hesabı yok — yönlendirme YİNE DE geçerli. */
  | { gonderildi: false; sebep: string };

/**
 * Yeni değerlendiriciye mail + in-app. Yönlendirmenin kendisi bu fonksiyon
 * patlasa bile GEÇERLİDİR — çağıran bunu bloke edici saymaz, sonucu döner.
 */
export async function yonlendirmeBildirimiGonder(
  g: YonlendirmeBildirimGirdi,
): Promise<YonlendirmeBildirimSonuc> {
  if (!denemeBildirimAcikMi()) {
    return { gonderildi: false, sebep: "Deneme bildirim bayrağı kapalı — bildirim gönderilmedi." };
  }

  const alici = await personelinKullanicisi(g.hedefPersonnelId);
  if (!alici) {
    return { gonderildi: false, sebep: "Yeni değerlendiricinin aktif kullanıcı hesabı yok — bildirim ulaşmadı." };
  }

  const etiket = TUR_ETIKET[g.tur];
  const base = g.baseUrl ?? process.env.NEXTAUTH_URL ?? "https://hub.ilerigroup.com";
  const link = `${base}/deneme/${g.formId}`;
  const hedefStr = g.hedefTarih.toLocaleDateString("tr-TR");
  const gunFarki = Math.floor((Date.now() - g.hedefTarih.getTime()) / 86400000);
  const gecikti = gunFarki > 0;
  const sonTarihDeger = gecikti
    ? `${esc(hedefStr)} <strong style="color:#b91c1c">(${gunFarki} gün geçti)</strong>`
    : esc(hedefStr);

  const { html, text } = renderEmail({
    module: "İnsan Varlıkları",
    title: `${etiket} değerlendirmesi size yönlendirildi`,
    subtitle: `${g.kisi.adSoyad} · ${g.kisi.sicilNo ?? "-"}`,
    preheader: `${g.kisi.adSoyad} değerlendirmesi sizin adımınıza aktarıldı.`,
    bodyHtml:
      p(
        `<strong>${esc(g.kisi.adSoyad)}</strong> personelinin <strong>${esc(etiket)}</strong> deneme değerlendirmesi İnsan Varlıkları tarafından <strong>sizin adımınıza yönlendirildi</strong>. Formun ${g.sira}. değerlendiricisi artık sizsiniz.`,
      ) +
      (gecikti
        ? p(`Son tarih <strong>${esc(hedefStr)}</strong> olup <strong>${gunFarki} gün geçmiştir</strong>; değerlendirmenin ilk fırsatta tamamlanması gerekmektedir.`)
        : p(`Son tarih <strong>${esc(hedefStr)}</strong>.`)) +
      p(
        `20 kriter, her biri 1–5 puan; geçerli not 60.${g.sonrakiAd ? ` Siz puanladıktan sonra form <strong>${esc(g.sonrakiAd)}</strong> adımına geçecektir.` : ""}`,
      ),
    infoRows: [
      { label: "Personel", value: `${esc(g.kisi.adSoyad)} (${esc(g.kisi.sicilNo ?? "-")})` },
      { label: "Bölüm", value: esc(g.kisi.bolum) },
      { label: "Görev", value: esc(g.kisi.gorev) },
      { label: "Değerlendirme türü", value: esc(etiket) },
      { label: "Son tarih", value: sonTarihDeger },
      { label: "Adımınız", value: `${g.sira}. Değerlendirici` },
      { label: "Yönlendirme gerekçesi", value: esc(g.gerekce) },
    ],
    cta: { label: "Formu Aç", url: link },
    footnote: "Bu yönlendirme İnsan Varlıkları tarafından yapılmıştır.",
  });

  const konu = `📋 ${etiket} Değerlendirmesi Size Yönlendirildi — ${g.kisi.adSoyad}`;
  const kanal = await denemeAliciyaGonder(
    alici,
    konu,
    text,
    html,
    link,
    `${etiket} değerlendirmesi size yönlendirildi`,
  );
  return { gonderildi: kanal.mail || kanal.inApp, kanal, email: alici.email } as YonlendirmeBildirimSonuc;
}
