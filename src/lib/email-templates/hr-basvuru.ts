// İşe alım bildirim e-postaları — TEK ORTAK İSKELET.
//
// Üç bildirim tipi (yeni başvuru / aşama değişikliği / sınav sonucu) AYNI iskeleti
// kullanır; tipe göre değişen YALNIZ üç şey vardır: başlık, aday bloğunun altındaki
// satır, CTA metni. İskelet burada tek yerde durur — üç ayrı HTML bloğu tutulmaz.
//
// ── GÖRÜNÜM ────────────────────────────────────────────────────────────────
// Kurumsal yerleşim email-templates/layout.ts (üst şerit "İnsan Varlıkları"):
// tablo tabanlı, inline style, 600px, VML buton — Outlook güvenli.
//
// ── KVKK ─────────────────────────────────────────────────────────────────────
// Mailde KİŞİSEL VERİ YOK: telefon, e-posta, TC, doğum, adres, eğitim GEÇMEZ.
// Yalnız ad, pozisyon, başvuru no, tarih, durum. Gerisi portalda (CTA linki).
//
// escapeHtml / ileriHubUrl KOPYALANMAZ — akademi/_base'ten alınır (repo bu dosyayı
// zaten akademi dışından da import ediyor: api/overtime/[id]/approve/route.ts).

import { escapeHtml, ileriHubUrl } from "@/lib/email-templates/akademi/_base";
import { renderEmail, quote } from "@/lib/email-templates/layout";

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
  // Sunucu UTC → saat Türkiye'ye çevrilmezse mailde 3 saat geri görünüyordu.
  return t.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
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
  const poz = g.pozisyon?.trim() || "Pozisyon belirtilmemiş";
  return renderEmail({
    module: "İnsan Varlıkları",
    title: g.baslik,
    subtitle: `${g.adayAdi} · ${poz}`,
    preheader: g.onizleme,
    infoRows: [
      { label: "Aday", value: `<strong>${escapeHtml(g.adayAdi)}</strong>` },
      { label: "Pozisyon", value: escapeHtml(poz) },
      ...g.metalar.map((m) => ({ label: m.etiket, value: escapeHtml(m.deger) })),
    ],
    afterHtml: g.vurguSatiri ? quote(escapeHtml(g.vurguSatiri)) : undefined,
    cta: { label: g.ctaMetin, url: ileriHubUrl(g.ctaYol) },
    footnote: "Aday bilgilerinin tamamı portalda.",
  });
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
