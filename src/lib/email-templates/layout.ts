import fs from "fs";
import path from "path";
import type { EmailAttachment } from "@/lib/email";

/**
 * ILERIHub kurumsal e-posta yerleşimi (19.09.2026 — onaylı taslak).
 *
 * Tüm modüllerin (Akademi / Destek / Envanter / Zimmet) HTML mailleri buradan
 * çıkar: beyaz zemin, ince çizgiler, gradient YOK, tablo tabanlı + inline style
 * (Outlook), 600px kart, sola hizalı. Üstte CID logo (38px) + modül etiketi,
 * başlık + alt satır, ince çizgili 2 sütunlu bilgi tablosu, TEK buton
 * (#1B4F72, Outlook için VML roundrect) + altında düz bağlantı, ayraç, dipnot.
 *
 * Logo `cid:ilerihub-logo` ile gömülür → gönderen taraf `logoAttachments()`
 * sonucunu sendEmail'e vermek ZORUNDA; aksi hâlde alt metin görünür.
 */

export const LOGO_CID = "ilerihub-logo";
export const BRAND_NAVY = "#1B4F72";

const FONT = "Arial,Helvetica,sans-serif";
const LINE = "#e3e6ea";
const LINE_SOFT = "#eef0f3";
const TEXT = "#1f2937";
const TEXT_DARK = "#111827";
const MUTED = "#6b7280";

export type EmailModule = "Akademi" | "Destek" | "Envanter" | "Zimmet";

export type EmailInfoRow = {
  /** Sol sütun — düz metin (escape'lenir). */
  label: string;
  /** Sağ sütun — HTML (çağıran escape'ler; <strong> vb. serbest). */
  value: string;
};

export type EmailLayoutInput = {
  module: EmailModule;
  /** Başlık — düz metin. */
  title: string;
  /** Başlığın altındaki gri satır — düz metin. */
  subtitle?: string;
  /** Inbox ön izleme metni — düz metin (yoksa başlık kullanılır). */
  preheader?: string;
  /** Başlıktan sonra gelen paragraf HTML'i (bkz. `p()`). */
  bodyHtml?: string;
  /** İnce çizgili bilgi tablosu. Boşsa tablo basılmaz. */
  infoRows?: EmailInfoRow[];
  /** Tablodan sonra, butondan önce gelen HTML (bkz. `p()`, `quote()`). */
  afterHtml?: string;
  /** Tek buton; altına otomatik düz bağlantı eklenir. */
  cta?: { label: string; url: string };
  /** Dipnotun ilk cümlesi — düz metin (otomatik gönderim cümlesinden önce). */
  footnote?: string;
};

export function logoAttachments(): EmailAttachment[] | undefined {
  const p = path.join(process.cwd(), "public", "ilerihublogo.png");
  return fs.existsSync(p)
    ? [{ filename: "ilerihublogo.png", path: p, cid: LOGO_CID }]
    : undefined;
}

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Gövde paragrafı (HTML içerik — çağıran escape'ler). */
export function p(html: string): string {
  return `<p style="margin:0 0 14px 0;">${html}</p>`;
}

/** Alıntı bloğu (yorum/çözüm metni gibi) — sol kenarı lacivert, arka plan açık. */
export function quote(html: string, byline?: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px 0;">
              <tr>
                <td style="padding:12px 14px;background-color:#f8fafc;border-left:3px solid ${BRAND_NAVY};font-family:${FONT};font-size:14px;line-height:22px;color:${TEXT};">
                  ${byline ? `<div style="margin:0 0 6px 0;font-size:12px;line-height:16px;color:${MUTED};">${byline}</div>` : ""}<div style="white-space:pre-wrap;">${html}</div>
                </td>
              </tr>
            </table>`;
}

/**
 * Çok sütunlu liste tablosu (stok listesi gibi) — ince çizgili, başlık satırı gri.
 * Hücreler HTML (çağıran escape'ler); `align` sütun başına "left" | "right".
 */
export function dataTable(
  headers: string[],
  rows: string[][],
  align: ("left" | "right")[] = []
): string {
  const th = headers
    .map(
      (h, i) =>
        `<th align="${align[i] ?? "left"}" style="padding:8px 8px;font-family:${FONT};font-size:12px;line-height:16px;font-weight:bold;color:${MUTED};text-transform:uppercase;letter-spacing:0.3px;border-bottom:1px solid ${LINE};text-align:${align[i] ?? "left"};">${esc(h)}</th>`
    )
    .join("");
  const trs = rows
    .map(
      (r) =>
        `<tr>${r
          .map(
            (c, i) =>
              `<td align="${align[i] ?? "left"}" style="padding:8px 8px;font-family:${FONT};font-size:13px;line-height:18px;color:${TEXT_DARK};border-bottom:1px solid ${LINE_SOFT};text-align:${align[i] ?? "left"};">${c}</td>`
          )
          .join("")}</tr>`
    )
    .join("\n");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px 0;border-top:1px solid ${LINE};">
              <tr>${th}</tr>
              ${trs}
            </table>`;
}

function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

export function renderEmail(input: EmailLayoutInput): string {
  const title = esc(input.title);
  const preheader = esc(input.preheader ?? input.title);
  const year = new Date().getFullYear();

  const rows = (input.infoRows ?? []).filter((r) => r.value !== "");
  const infoTable = rows.length
    ? `
        <!-- BİLGİ TABLOSU -->
        <tr>
          <td style="padding:6px 32px 0 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${LINE};border-bottom:1px solid ${LINE};">
${rows
  .map((r, i) => {
    const last = i === rows.length - 1;
    const bb = last ? "" : `border-bottom:1px solid ${LINE_SOFT};`;
    return `              <tr>
                <td width="40%" valign="top" style="padding:10px 12px 10px 0;font-family:${FONT};font-size:13px;line-height:20px;color:${MUTED};${bb}">${esc(r.label)}</td>
                <td valign="top" style="padding:10px 0;font-family:${FONT};font-size:14px;line-height:20px;color:${TEXT_DARK};${bb}">${r.value}</td>
              </tr>`;
  })
  .join("\n")}
            </table>
          </td>
        </tr>`
    : "";

  const cta = input.cta
    ? `
        <!-- BUTON (Outlook: VML) -->
        <tr>
          <td style="padding:24px 32px 8px 32px;" align="left">
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${esc(input.cta.url)}" style="height:44px;v-text-anchor:middle;width:240px;" arcsize="9%" strokecolor="${BRAND_NAVY}" fillcolor="${BRAND_NAVY}">
              <w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">${esc(input.cta.label)}</center>
            </v:roundrect>
            <![endif]-->
            <!--[if !mso]><!-->
            <a href="${esc(input.cta.url)}" style="display:inline-block;background-color:${BRAND_NAVY};color:#ffffff;font-family:${FONT};font-size:14px;font-weight:bold;line-height:44px;height:44px;padding:0 28px;text-decoration:none;border-radius:4px;">${esc(input.cta.label)}</a>
            <!--<![endif]-->
            <p style="margin:10px 0 0 0;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">Buton çalışmıyorsa: <a href="${esc(input.cta.url)}" style="color:${BRAND_NAVY};text-decoration:underline;">${esc(displayUrl(input.cta.url))}</a></p>
          </td>
        </tr>`
    : "";

  const footnote = `${input.footnote ? esc(input.footnote) + " " : ""}Bu e-posta ILERIHub ${esc(input.module)} tarafından otomatik gönderilmiştir.`;

  return `<!DOCTYPE html>
<html lang="tr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${title}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f4f5f7;">${preheader}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f5f7;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border:1px solid ${LINE};border-collapse:separate;">

        <!-- LOGO ŞERİDİ -->
        <tr>
          <td style="padding:20px 32px 16px 32px;border-bottom:1px solid ${LINE};">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td align="left" valign="middle">
                  <img src="cid:${LOGO_CID}" width="152" height="38" alt="ILERIHub" style="display:block;border:0;outline:none;height:38px;width:152px;font-family:${FONT};font-size:16px;font-weight:bold;color:${TEXT};">
                </td>
                <td align="right" valign="middle" style="font-family:${FONT};font-size:12px;line-height:16px;color:${MUTED};letter-spacing:0.4px;text-transform:uppercase;">
                  ${esc(input.module)}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- BAŞLIK -->
        <tr>
          <td style="padding:28px 32px 0 32px;font-family:${FONT};">
            <h1 style="margin:0 0 6px 0;font-size:20px;line-height:28px;font-weight:bold;color:${TEXT_DARK};">${title}</h1>
            ${input.subtitle ? `<p style="margin:0;font-size:13px;line-height:20px;color:${MUTED};">${esc(input.subtitle)}</p>` : ""}
          </td>
        </tr>
${
  input.bodyHtml
    ? `
        <!-- GÖVDE -->
        <tr>
          <td style="padding:20px 32px 0 32px;font-family:${FONT};font-size:15px;line-height:24px;color:${TEXT};">
            ${input.bodyHtml}
          </td>
        </tr>`
    : ""
}${infoTable}${
    input.afterHtml
      ? `
        <tr>
          <td style="padding:20px 32px 0 32px;font-family:${FONT};font-size:15px;line-height:24px;color:${TEXT};">
            ${input.afterHtml}
          </td>
        </tr>`
      : ""
  }${cta}

        <!-- DİPNOT -->
        <tr>
          <td style="padding:20px 32px 0 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid ${LINE};font-size:0;line-height:0;">&nbsp;</td></tr></table>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 32px 24px 32px;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">
            ${footnote}<br>
            İleri Group · ${year}
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>
</body>
</html>`;
}
