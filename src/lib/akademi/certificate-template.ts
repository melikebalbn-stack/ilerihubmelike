import fs from "fs";
import path from "path";

/**
 * Akademi sertifikası — HTML şablonu (Chromium HTML→PDF için).
 *
 * Çıktı TAMAMEN self-contained: tüm fontlar (Cormorant Garamond, Great Vibes,
 * Archivo, IBM Plex Sans — latin + latin-ext) ve iki logo base64 data URI olarak
 * gömülür; dış URL YOK (Chromium ağ beklemeden render eder). Bu sebeple eski
 * pdf-lib + @fontsource latin-ext subset yaklaşımı (glyph tofu bug'ı) terk edildi.
 *
 * A4 yatay: @page size 297mm×210mm, margin 0 → tek sayfa.
 */

export type CertificateSignature = { ad: string; unvan: string };
export type CertificateHtmlData = {
  adSoyad: string;
  egitimAdi: string;
  tarih: string; // görüntülenecek biçimde (ör. "25 Eylül 2026")
  sertifikaNo: string;
  gecerlilik: string; // "Süresiz" | tarih
  imzalar: CertificateSignature[];
  qrDataUrl: string; // data:image/png;base64,...
  dogrulaUrl: string;
};

// ── Varlık gömme (base64 data URI), tek sefer okunur + cache'lenir ──
const FONT_DIR = path.join(process.cwd(), "node_modules", "@fontsource");
const LOGO_DIR = path.join(process.cwd(), "public", "akademi");

const cache = new Map<string, string>();

function dataUri(absPath: string, mime: string): string {
  const key = `${mime}:${absPath}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const b64 = fs.readFileSync(absPath).toString("base64");
  const uri = `data:${mime};base64,${b64}`;
  cache.set(key, uri);
  return uri;
}

function fontUri(pkg: string, file: string): string {
  return dataUri(path.join(FONT_DIR, pkg, "files", file), "font/woff2");
}

function logoUri(file: string): string {
  return dataUri(path.join(LOGO_DIR, file), "image/png");
}

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// @fontsource fontu latin ve latin-ext olarak AYRI woff2'ye böler; İ/ğ/ş
// latin-ext'te, temel Latin + ı/ç/ö/ü latin'de. Türkçe'nin tamamı için HER
// aile+ağırlık için İKİ @font-face (latin + latin-ext) unicode-range ile gömülür
// → Chromium her glyph'i doğru alt-kümeden alır, sistem fontuna (DejaVu) düşmez.
const RANGE_LATIN =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const RANGE_LATIN_EXT =
  "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";

function fontFaces(): string {
  // family, weight, pkg
  const faces: Array<[string, number, string]> = [
    ["Cormorant Garamond", 600, "cormorant-garamond"],
    ["Cormorant Garamond", 500, "cormorant-garamond"],
    ["Great Vibes", 400, "great-vibes"],
    ["Archivo", 600, "archivo"],
    ["Archivo", 500, "archivo"],
    ["IBM Plex Sans", 400, "ibm-plex-sans"],
    ["IBM Plex Sans", 600, "ibm-plex-sans"],
  ];
  const subsets: Array<[string, string]> = [
    ["latin", RANGE_LATIN],
    ["latin-ext", RANGE_LATIN_EXT],
  ];
  const out: string[] = [];
  for (const [family, weight, pkg] of faces) {
    for (const [subset, range] of subsets) {
      const file = `${pkg}-${subset}-${weight}-normal.woff2`;
      out.push(`
    @font-face {
      font-family: '${family}';
      font-style: normal;
      font-weight: ${weight};
      font-display: block;
      unicode-range: ${range};
      src: url('${fontUri(pkg, file)}') format('woff2');
    }`);
    }
  }
  return out.join("");
}

const NAVY = "#12325E";
const GOLD = "#C9A24A";

/** Sertifika HTML'ini üretir (tek sayfa, A4 yatay, self-contained). */
export function renderCertificateHtml(data: CertificateHtmlData): string {
  const grupLogo = logoUri("ileri-group-logo.png");
  const akademiLogo = logoUri("ileri-akademi-logo.png");

  const imzalar = (data.imzalar ?? [])
    .slice(0, 2)
    .map(
      (s) => `
        <div class="sig">
          <div class="sig-line"></div>
          <div class="sig-name">${esc(s.ad)}</div>
          <div class="sig-title">${esc(s.unvan)}</div>
        </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<style>
  ${fontFaces()}
  @page { size: 297mm 210mm; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 297mm; height: 210mm; }
  body {
    font-family: 'IBM Plex Sans';
    color: #1f2a44;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    position: relative;
    width: 297mm;
    height: 210mm;
    background: #ffffff;
    overflow: hidden;
  }
  /* Üst/alt lacivert dalgalar */
  .wave { position: absolute; left: 0; width: 100%; z-index: 0; }
  .wave-top { top: 0; }
  .wave-bottom { bottom: 0; transform: rotate(180deg); }
  /* Altın çerçeve */
  .frame {
    position: absolute; inset: 18px;
    border: 2px solid ${GOLD};
    z-index: 2;
  }
  .frame::after {
    content: ''; position: absolute; inset: 6px;
    border: 1px solid ${GOLD}66;
  }
  .corner { position: absolute; width: 46px; height: 46px; z-index: 3; }
  .corner svg { width: 100%; height: 100%; }
  .c-tl { top: 24px; left: 24px; }
  .c-tr { top: 24px; right: 24px; transform: scaleX(-1); }
  .c-bl { bottom: 24px; left: 24px; transform: scaleY(-1); }
  .c-br { bottom: 24px; right: 24px; transform: scale(-1,-1); }
  /* Logolar */
  .logos { position: absolute; top: 120px; left: 100px; right: 100px;
           display: flex; justify-content: space-between; align-items: center; z-index: 4; }
  .logos img { height: 44px; width: auto; }
  /* İçerik */
  .content { position: relative; z-index: 4; text-align: center;
             padding: 196px 120px 0; }
  .title { font-family: 'Cormorant Garamond', 'IBM Plex Sans'; font-weight: 600;
           font-size: 64px; letter-spacing: 10px; color: ${NAVY}; line-height: 1; }
  .subtitle { font-family: 'Archivo', 'IBM Plex Sans'; font-weight: 600;
              font-size: 24px; letter-spacing: 6px; color: ${GOLD};
              text-transform: uppercase; margin-top: 8px; }
  .divider { width: 120px; height: 2px; background: ${GOLD}; margin: 18px auto; }
  .lead { font-size: 16px; color: #5a6472; margin-top: 6px; }
  .name { font-family: 'Great Vibes', 'IBM Plex Sans'; font-weight: 400;
          font-size: 84px; color: ${NAVY}; margin: 4px 0 2px; line-height: 1.1; }
  .body-text { font-size: 17px; color: #3a4256; margin-top: 8px; }
  .course { font-family: 'Cormorant Garamond', 'IBM Plex Sans'; font-weight: 600;
            font-size: 30px; color: ${NAVY}; margin-top: 12px; }
  .meta { font-size: 13px; color: #6b7280; letter-spacing: 0.3px; margin-top: 20px; }
  .meta span { margin: 0 8px; }
  /* İmzalar — sayfaya ortalı, simetrik; alt dalganın hemen üstünde (~30px) */
  .signatures { position: absolute; bottom: 120px; left: 0; right: 0;
                display: flex; justify-content: center; gap: 160px; z-index: 4; }
  .sig { text-align: center; }
  .sig-line { width: 240px; height: 1px; background: #9aa3b2; margin: 0 auto 6px; }
  .sig-name { font-family: 'Archivo', 'IBM Plex Sans'; font-weight: 600; font-size: 18px; color: ${NAVY}; }
  .sig-title { font-size: 14px; color: #6b7280; margin-top: 2px; }
  /* QR — sağ altta; imzalarla aynı yatay hizada (alt kenar unvan alt kenarına yakın) */
  .qr { position: absolute; bottom: 120px; right: 100px; width: 130px;
        text-align: center; z-index: 4; }
  .qr img { width: 96px; height: 96px; display: block; margin: 0 auto; }
  .qr .no { font-size: 9px; color: #6b7280; margin-top: 5px; }
</style>
</head>
<body>
  <div class="page">
    <svg class="wave wave-top" viewBox="0 0 1123 120" preserveAspectRatio="none" height="90">
      <path d="M0,0 L1123,0 L1123,60 C850,110 650,20 420,70 C230,110 90,40 0,80 Z" fill="${NAVY}"/>
      <path d="M0,0 L1123,0 L1123,40 C820,90 620,10 400,55 C210,95 80,30 0,60 Z" fill="${GOLD}" opacity="0.35"/>
    </svg>
    <svg class="wave wave-bottom" viewBox="0 0 1123 120" preserveAspectRatio="none" height="90">
      <path d="M0,0 L1123,0 L1123,60 C850,110 650,20 420,70 C230,110 90,40 0,80 Z" fill="${NAVY}"/>
      <path d="M0,0 L1123,0 L1123,40 C820,90 620,10 400,55 C210,95 80,30 0,60 Z" fill="${GOLD}" opacity="0.35"/>
    </svg>

    <div class="frame"></div>
    <div class="corner c-tl"><svg viewBox="0 0 46 46"><path d="M2,44 L2,2 L44,2" fill="none" stroke="${GOLD}" stroke-width="2"/><circle cx="8" cy="8" r="3" fill="${GOLD}"/></svg></div>
    <div class="corner c-tr"><svg viewBox="0 0 46 46"><path d="M2,44 L2,2 L44,2" fill="none" stroke="${GOLD}" stroke-width="2"/><circle cx="8" cy="8" r="3" fill="${GOLD}"/></svg></div>
    <div class="corner c-bl"><svg viewBox="0 0 46 46"><path d="M2,44 L2,2 L44,2" fill="none" stroke="${GOLD}" stroke-width="2"/><circle cx="8" cy="8" r="3" fill="${GOLD}"/></svg></div>
    <div class="corner c-br"><svg viewBox="0 0 46 46"><path d="M2,44 L2,2 L44,2" fill="none" stroke="${GOLD}" stroke-width="2"/><circle cx="8" cy="8" r="3" fill="${GOLD}"/></svg></div>

    <div class="logos">
      <img src="${grupLogo}" alt="İleri Group">
      <img src="${akademiLogo}" alt="İleri Akademi">
    </div>

    <div class="content">
      <div class="title">SERTİFİKA</div>
      <div class="subtitle">Başarı Belgesi</div>
      <div class="divider"></div>
      <div class="lead">Bu belge</div>
      <div class="name">${esc(data.adSoyad)}</div>
      <div class="body-text">adlı katılımcının aşağıdaki eğitimi başarıyla tamamladığını belgeler.</div>
      <div class="course">${esc(data.egitimAdi)}</div>
      <div class="meta">
        <span>Tarih: ${esc(data.tarih)}</span>·
        <span>Sertifika No: ${esc(data.sertifikaNo)}</span>·
        <span>Geçerlilik: ${esc(data.gecerlilik)}</span>
      </div>
    </div>

    <div class="signatures">${imzalar}</div>

    <div class="qr">
      <img src="${esc(data.qrDataUrl)}" alt="QR">
      <div class="no">${esc(data.sertifikaNo)}</div>
    </div>
  </div>
</body>
</html>`;
}
