// İşe alım bildirim e-postaları — TEK ORTAK İSKELET.
//
// Üç bildirim tipi (yeni başvuru / aşama değişikliği / sınav sonucu) AYNI iskeleti
// kullanır; tipe göre değişen YALNIZ üç şey vardır: başlık, aday bloğunun altındaki
// satır, CTA metni. İskelet burada tek yerde durur — üç ayrı HTML bloğu tutulmaz.
//
// ── E-POSTA GÜVENLİĞİ (Outlook Word render motoru) ───────────────────────────
// Outlook masaüstü HTML'i Word ile çizer. Bu yüzden:
//   · layout TABLO tabanlı (flexbox/grid YOK)
//   · TÜM stiller inline (CSS class / <style> / harici stylesheet YOK)
//   · buton TABLO tabanlı (div + border-radius Outlook'ta buton görünmez)
//   · genişlik 600px sabit (mobil istemciler bunu küçültür)
// border-radius yalnız "nice-to-have": Outlook yok sayar, yuvarlak rozet kare görünür —
// bilinçli kabul (içerik okunur kalır).
//
// ── KVKK ─────────────────────────────────────────────────────────────────────
// Mailde KİŞİSEL VERİ YOK: telefon, e-posta, TC, doğum, adres, eğitim GEÇMEZ.
// Yalnız ad, pozisyon, başvuru no, tarih, durum. Gerisi portalda (CTA linki).
//
// escapeHtml / ileriHubUrl KOPYALANMAZ — akademi/_base'ten alınır (repo bu dosyayı
// zaten akademi dışından da import ediyor: api/overtime/[id]/approve/route.ts).

import { escapeHtml, ileriHubUrl } from "@/lib/email-templates/akademi/_base";

// ── Marka renkleri — TEK KAYNAK ───────────────────────────────────────────────
const RENK = {
  teal: "#0F6E56",
  tealAcik: "#E1F5EE",
  tealKoyu: "#04342C",
  metin: "#2C2C2A",
  soluk: "#5F5E5A",
  cokSoluk: "#888780",
  cizgi: "#F1EFE8",
  beyaz: "#FFFFFF",
} as const;

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/**
 * Baş harfler — TÜRKÇE yerel ayarla.
 *
 * DİKKAT: düz toUpperCase() "i" harfini "I" yapar → "İlknur" → "IS" (YANLIŞ).
 * toLocaleUpperCase("tr-TR") ile "i" → "İ", "ı" → "I" doğru çalışır.
 *
 * Kural: ad tek kelimeyse ilk İKİ harf; çok kelimeyse İLK ve SON kelimenin ilk harfi
 * (orta ad varsa soyadı kaybolmasın — "MEHMET ALİ KAYA" → "MK").
 */
export function basHarfler(adSoyad: string | null | undefined): string {
  const temiz = (adSoyad ?? "").trim().replace(/\s+/g, " ");
  if (!temiz) return "?";
  const kelimeler = temiz.split(" ").filter(Boolean);
  const ilkHarf = (k: string) => [...k][0] ?? "";
  const ham =
    kelimeler.length === 1
      ? [...kelimeler[0]].slice(0, 2).join("")
      : ilkHarf(kelimeler[0]) + ilkHarf(kelimeler[kelimeler.length - 1]);
  return ham.toLocaleUpperCase("tr-TR");
}

/** Tarih — TR biçim, saat DAHİL (bildirim zamanı anlamlı). */
function tarihTR(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const t = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(t.getTime())) return "—";
  return t.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Meta satırı: "Başvuru No" gibi etiket + değer. */
export type MetaSatiri = { etiket: string; deger: string };

export type IskeletGirdi = {
  /** Mail listesinde konu satırının yanında görünen gizli önizleme metni. */
  onizleme: string;
  /** Kart başlığı (H1). */
  baslik: string;
  adayAdi: string;
  /** Pozisyon — yoksa "Pozisyon belirtilmemiş". */
  pozisyon?: string | null;
  /** Aday bloğunun ALTINDAKİ tipe özel satır (durum geçişi / sınav sonucu). Boşsa çizilmez. */
  vurguSatiri?: string | null;
  metalar: MetaSatiri[];
  ctaMetin: string;
  /** Portal yolu ("/strategic-hr/..."); tam URL'e ileriHubUrl ile çevrilir. */
  ctaYol: string;
};

/**
 * ORTAK İSKELET. Üç tip de buradan geçer.
 * Dönen HTML tek başına gönderilebilir (doctype + head dahil).
 */
export function basvuruMailHtml(g: IskeletGirdi): string {
  const bas = escapeHtml(basHarfler(g.adayAdi));
  const ad = escapeHtml(g.adayAdi);
  const poz = escapeHtml(g.pozisyon?.trim() || "Pozisyon belirtilmemiş");
  const url = ileriHubUrl(g.ctaYol);

  const metaSatirlari = g.metalar
    .map(
      (m) => `
              <tr>
                <td style="padding:6px 0;font-family:${FONT};font-size:13px;color:${RENK.soluk};white-space:nowrap;">${escapeHtml(m.etiket)}</td>
                <td style="padding:6px 0 6px 16px;font-family:${FONT};font-size:13px;color:${RENK.metin};font-weight:600;">${escapeHtml(m.deger)}</td>
              </tr>`,
    )
    .join("");

  const vurgu = g.vurguSatiri
    ? `
            <tr>
              <td style="padding:0 32px 20px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
                  <tr>
                    <td style="padding:12px 16px;background-color:${RENK.tealAcik};border-left:3px solid ${RENK.teal};font-family:${FONT};font-size:14px;line-height:20px;color:${RENK.tealKoyu};">
                      ${escapeHtml(g.vurguSatiri)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`
    : "";

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="tr">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(g.baslik)}</title>
</head>
<body style="margin:0;padding:0;background-color:${RENK.cizgi};">
<!-- Onizleme metni: mail listesinde konunun yaninda gorunur, mailde GORUNMEZ.
     Zero-width bosluklar, istemcinin govde metnini onizlemeye tasimasini engeller. -->
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;color:${RENK.cizgi};">
  ${escapeHtml(g.onizleme)}
  &#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;
</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background-color:${RENK.cizgi};">
  <tr>
    <td align="center" style="padding:24px 12px;">

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;border-collapse:collapse;background-color:${RENK.beyaz};">

        <!-- 4px ust renk cizgisi -->
        <tr>
          <td style="height:4px;line-height:4px;font-size:0;background-color:${RENK.teal};">&nbsp;</td>
        </tr>

        <!-- Marka satiri -->
        <tr>
          <td style="padding:20px 32px 0 32px;font-family:${FONT};font-size:12px;letter-spacing:0.6px;text-transform:uppercase;color:${RENK.cokSoluk};">
            İleri Group &middot; ILERIHub
          </td>
        </tr>

        <!-- Baslik -->
        <tr>
          <td style="padding:8px 32px 20px 32px;font-family:${FONT};font-size:20px;line-height:28px;font-weight:600;color:${RENK.metin};">
            ${escapeHtml(g.baslik)}
          </td>
        </tr>

        <!-- Aday blogu: yuvarlak bas harfler + ad + pozisyon -->
        <tr>
          <td style="padding:0 32px 20px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background-color:${RENK.tealAcik};">
              <tr>
                <td width="72" style="width:72px;padding:16px 0 16px 16px;" valign="middle">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                    <tr>
                      <td width="44" height="44" align="center" valign="middle" style="width:44px;height:44px;background-color:${RENK.teal};border-radius:22px;font-family:${FONT};font-size:16px;font-weight:600;color:${RENK.beyaz};text-align:center;">
                        ${bas}
                      </td>
                    </tr>
                  </table>
                </td>
                <td style="padding:16px 16px 16px 0;" valign="middle">
                  <div style="font-family:${FONT};font-size:16px;line-height:22px;font-weight:600;color:${RENK.tealKoyu};">${ad}</div>
                  <div style="font-family:${FONT};font-size:13px;line-height:18px;color:${RENK.soluk};padding-top:2px;">${poz}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
${vurgu}
        <!-- Meta satirlari -->
        <tr>
          <td style="padding:0 32px 4px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
${metaSatirlari}
            </table>
          </td>
        </tr>

        <!-- CTA butonu — TABLO tabanli (Outlook'ta div buton calismaz) -->
        <tr>
          <td style="padding:24px 32px 28px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr>
                <td align="center" style="background-color:${RENK.teal};border-radius:4px;">
                  <a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:12px 28px;font-family:${FONT};font-size:14px;font-weight:600;color:${RENK.beyaz};text-decoration:none;">
                    ${escapeHtml(g.ctaMetin)} &rarr;
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Ayirac -->
        <tr>
          <td style="padding:0 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
              <tr><td style="height:1px;line-height:1px;font-size:0;background-color:${RENK.cizgi};">&nbsp;</td></tr>
            </table>
          </td>
        </tr>

        <!-- Alt bilgi -->
        <tr>
          <td style="padding:16px 32px 24px 32px;font-family:${FONT};font-size:12px;line-height:18px;color:${RENK.cokSoluk};">
            İnsan Varlıkları Departmanı &middot; İleri Group<br />
            Bu otomatik bir bildirimdir, yanıtlamayın. Aday bilgilerinin tamamı portalda.
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>
</body>
</html>`;
}

/** HTML'siz istemciler için düz metin karşılığı (sendEmail body parametresi). */
export function basvuruMailText(g: IskeletGirdi): string {
  const satirlar = [
    "İleri Group · ILERIHub",
    "",
    g.baslik,
    "",
    `${g.adayAdi} — ${g.pozisyon?.trim() || "Pozisyon belirtilmemiş"}`,
  ];
  if (g.vurguSatiri) satirlar.push("", g.vurguSatiri);
  satirlar.push("");
  for (const m of g.metalar) satirlar.push(`${m.etiket}: ${m.deger}`);
  satirlar.push("", `${g.ctaMetin}: ${ileriHubUrl(g.ctaYol)}`, "");
  satirlar.push(
    "İnsan Varlıkları Departmanı · İleri Group",
    "Bu otomatik bir bildirimdir, yanıtlamayın. Aday bilgilerinin tamamı portalda.",
  );
  return satirlar.join("\n");
}

// ── Üç bildirim tipi ─────────────────────────────────────────────────────────
// Her biri YALNIZ başlık / vurgu satırı / CTA metnini değiştirir; iskelet ortak.

export type BasvuruMail = { subject: string; html: string; text: string };

const DETAY_YOL = (id: string) => `/strategic-hr/recruitment/job-applications/${id}`;

/** (a) Yeni başvuru — aday formu gönderdi, İV ön incelemesi bekliyor. */
export function yeniBasvuruMaili(args: {
  applicationId: string;
  applicationNumber: string;
  adayAdi: string;
  pozisyon?: string | null;
  tarih?: Date | string | null;
  durumEtiketi: string;
}): BasvuruMail {
  const g: IskeletGirdi = {
    onizleme: `${args.adayAdi} yeni bir iş başvurusu gönderdi.`,
    baslik: "Yeni iş başvurusu",
    adayAdi: args.adayAdi,
    pozisyon: args.pozisyon,
    vurguSatiri: null,
    metalar: [
      { etiket: "Başvuru No", deger: args.applicationNumber },
      { etiket: "Tarih", deger: tarihTR(args.tarih ?? new Date()) },
      { etiket: "Durum", deger: args.durumEtiketi },
    ],
    ctaMetin: "Başvuruyu incele",
    ctaYol: DETAY_YOL(args.applicationId),
  };
  return {
    subject: `Yeni iş başvurusu — ${args.adayAdi}`,
    html: basvuruMailHtml(g),
    text: basvuruMailText(g),
  };
}

/** (b) Aşama değişikliği — "Durum: eski → yeni" + kimin yaptığı. */
export function asamaDegisikligiMaili(args: {
  applicationId: string;
  applicationNumber: string;
  adayAdi: string;
  pozisyon?: string | null;
  eskiDurumEtiketi: string;
  yeniDurumEtiketi: string;
  aktorAdi?: string | null;
  tarih?: Date | string | null;
}): BasvuruMail {
  const aktor = args.aktorAdi?.trim();
  const g: IskeletGirdi = {
    onizleme: `${args.adayAdi}: ${args.eskiDurumEtiketi} → ${args.yeniDurumEtiketi}`,
    baslik: "Başvuru durumu değişti",
    adayAdi: args.adayAdi,
    pozisyon: args.pozisyon,
    vurguSatiri:
      `Durum: ${args.eskiDurumEtiketi} → ${args.yeniDurumEtiketi}` +
      (aktor ? ` · Değiştiren: ${aktor}` : ""),
    metalar: [
      { etiket: "Başvuru No", deger: args.applicationNumber },
      { etiket: "Tarih", deger: tarihTR(args.tarih ?? new Date()) },
      { etiket: "Durum", deger: args.yeniDurumEtiketi },
    ],
    ctaMetin: "Başvuruyu aç",
    ctaYol: DETAY_YOL(args.applicationId),
  };
  return {
    subject: `Başvuru durumu: ${args.yeniDurumEtiketi} — ${args.adayAdi}`,
    html: basvuruMailHtml(g),
    text: basvuruMailText(g),
  };
}

/** (c) Sınav sonucu — "Sınav: Geçti/Kaldı · puan/geçme notu". */
export function sinavSonucuMaili(args: {
  applicationId: string;
  applicationNumber: string;
  adayAdi: string;
  pozisyon?: string | null;
  sinavAdi: string;
  puan: number;
  gecmeNotu: number;
  gecti: boolean;
  /** Otomatik ilerleme olduysa yeni durum — tek mailde gösterilir (çift bildirim önlenir). */
  yeniDurumEtiketi?: string | null;
  tarih?: Date | string | null;
}): BasvuruMail {
  const sonuc = args.gecti ? "Geçti" : "Kaldı";
  const metalar: MetaSatiri[] = [
    { etiket: "Başvuru No", deger: args.applicationNumber },
    { etiket: "Sınav", deger: args.sinavAdi },
    { etiket: "Tarih", deger: tarihTR(args.tarih ?? new Date()) },
  ];
  if (args.yeniDurumEtiketi) {
    metalar.push({ etiket: "Durum", deger: args.yeniDurumEtiketi });
  }
  const g: IskeletGirdi = {
    onizleme: `${args.adayAdi} sınavı tamamladı — ${sonuc} (${args.puan}/${args.gecmeNotu})`,
    baslik: `Sınav sonucu: ${sonuc}`,
    adayAdi: args.adayAdi,
    pozisyon: args.pozisyon,
    vurguSatiri:
      `Sınav: ${sonuc} · ${args.puan}/${args.gecmeNotu}` +
      (args.yeniDurumEtiketi ? ` · Yeni durum: ${args.yeniDurumEtiketi}` : ""),
    metalar,
    ctaMetin: "Sonucu gör",
    ctaYol: DETAY_YOL(args.applicationId),
  };
  return {
    subject: `Sınav sonucu (${sonuc}) — ${args.adayAdi}`,
    html: basvuruMailHtml(g),
    text: basvuruMailText(g),
  };
}
