// ============================================================================
// İleriHub — Kalibrasyon hatırlatma maili (kurumsal yerleşim, üst şerit "Kalibrasyon")
// ----------------------------------------------------------------------------
// Sadece mail GÖVDESİNİ üretir. Alıcı listesi / zamanlama / tetikleme kuralları
// check-notifications route'unda; bu dosya onlara DOKUNMAZ.
//
// Alan adları Hub şemasına (CalibrationDevice) göre check-notifications
// route'unda map'lenir; interface'in kendisi tasarım sözleşmesi olarak korunur.
// ============================================================================

import { renderEmail, p, dataTable, TOKENS } from "@/lib/email-templates/layout";

export interface KalibrasyonDevice {
  cihazId: string;                   // "Kod" — Cihaz ID (örn. "C 1019")
  cihazTipi?: string | null;         // "Cihaz Tipi" — device.name (örn. "Dijital Kumpas")
  departman?: string | null;         // "Cihaz Yeri" = departman + bölüm
  uretimBolumu?: string | null;      // "Cihaz Yeri" ikinci parça (device.productionSection - Bölüm)
  seriNo?: string | null;            // "Seri Numarası"
  model: string;                     // "Cihaz Detayı" — model
  sorumluKisi?: string | null;       // "Zimmet Sorumlusu"
  planlananKalibrasyonTarihi: Date | string;  // "Gelecek Kal./Doğ. Tarihi"
  kalanGun: number;                  // negatif = süresi geçti
  cihazDurumu?: string | null;       // "Durum"
}

const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

const fmtDate = (d: Date | string): string => {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(dt.getDate())}.${p(dt.getMonth() + 1)}.${dt.getFullYear()}`;
};

// Cihaz Yeri = departman + bölüm (boş olanlar atlanır).
const cihazYeri = (d: KalibrasyonDevice): string =>
  [d.departman, d.uretimBolumu].map((x) => (x ?? "").trim()).filter(Boolean).join(" · ");

function rowHtml(dev: KalibrasyonDevice): string[] {
  const g = dev.kalanGun;
  let kalan = `${g} gün`;
  if (g < 0) {
    kalan = `<strong style="color:${TOKENS.red};white-space:nowrap;">${g} gün</strong> <span style="font-size:11px;color:${TOKENS.red};">(${Math.abs(g)} gün geçti)</span>`;
  } else if (g <= 15) {
    kalan = `<strong style="color:${TOKENS.amber};white-space:nowrap;">${g} gün</strong>`;
  } else {
    kalan = `<strong style="white-space:nowrap;">${g} gün</strong>`;
  }
  const durum = dev.cihazDurumu
    ? `<span style="display:inline-block;font-size:11px;font-weight:bold;color:${TOKENS.amber};background-color:#fef3c7;border:1px solid #fcd34d;padding:1px 6px;white-space:nowrap;">${esc(dev.cihazDurumu)}</span>`
    : "—";
  return [
    `<strong style="font-family:Consolas,Menlo,monospace;white-space:nowrap;">${esc(dev.cihazId)}</strong>`,
    esc(dev.cihazTipi || "—"),
    esc(cihazYeri(dev) || "—"),
    `<span style="color:${TOKENS.muted};">${esc(dev.seriNo || "—")}</span>`,
    `<strong>${esc(dev.model)}</strong>`,
    esc(dev.sorumluKisi || "—"),
    `<span style="white-space:nowrap;">${fmtDate(dev.planlananKalibrasyonTarihi)}</span>`,
    kalan,
    durum,
  ];
}

export function buildKalibrasyonMailHtml(
  devices: KalibrasyonDevice[],
  opts: { baslik?: string; tarihBaslik?: string } = {}
): string {
  const baslik = opts.baslik ?? "Kalibrasyon Tarihi Gelen Cihazlar";
  const tarihBaslik = opts.tarihBaslik ?? "Gelecek Kal. Tarihi";
  const bugun = fmtDate(new Date());

  // 9 sütunlu cihaz listesi 600px'e sığmaz → geniş kart (800px); yerleşim aynı.
  return renderEmail({
    module: "Kalibrasyon",
    width: 800,
    title: baslik,
    subtitle: `Otomatik rapor · ${bugun} · ${devices.length} cihaz`,
    preheader: `${baslik} — ${devices.length} cihaz`,
    afterHtml:
      dataTable(
        ["Kod", "Cihaz Tipi", "Cihaz Yeri", "Seri Numarası", "Cihaz Detayı", "Zimmet Sorumlusu", tarihBaslik, "Kalan Gün", "Durum"],
        devices.map(rowHtml),
        ["left", "left", "left", "left", "left", "left", "left", "right", "left"]
      ) + p(`<strong>Toplam: ${devices.length} cihaz</strong>`),
  });
}
