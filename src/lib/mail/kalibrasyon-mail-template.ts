// ============================================================================
// İleriHub — Kalibrasyon hatırlatma maili (ERP-stili Excel tablo)
// ----------------------------------------------------------------------------
// Sadece mail GÖVDESİNİ üretir. Alıcı listesi / zamanlama / tetikleme kuralları
// check-notifications route'unda; bu dosya onlara DOKUNMAZ.
//
// Alan adları Hub şemasına (CalibrationDevice) göre check-notifications
// route'unda map'lenir; interface'in kendisi tasarım sözleşmesi olarak korunur.
// ============================================================================

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

function rowHtml(dev: KalibrasyonDevice): string {
  const g = dev.kalanGun;
  let kalanCls = "kalan";
  let kalanTxt = `${g} gün`;
  if (g < 0) { kalanCls = "kalan over"; kalanTxt = `${g} gün <span class="tag">(${Math.abs(g)} gün geçti)</span>`; }
  else if (g <= 15) { kalanCls = "kalan warn"; }

  return `        <tr>
          <td class="kod">${esc(dev.cihazId)}</td>
          <td>${esc(dev.cihazTipi || "—")}</td>
          <td>${esc(cihazYeri(dev) || "—")}</td>
          <td class="muted">${esc(dev.seriNo || "—")}</td>
          <td class="detay">${esc(dev.model)}</td>
          <td>${esc(dev.sorumluKisi || "—")}</td>
          <td class="nowrap">${fmtDate(dev.planlananKalibrasyonTarihi)}</td>
          <td class="${kalanCls}">${kalanTxt}</td>
          <td>${dev.cihazDurumu ? `<span class="durum">${esc(dev.cihazDurumu)}</span>` : "—"}</td>
        </tr>`;
}

export function buildKalibrasyonMailHtml(
  devices: KalibrasyonDevice[],
  opts: { baslik?: string; tarihBaslik?: string } = {}
): string {
  const baslik = opts.baslik ?? "Kalibrasyon Tarihi Gelen Cihazlar";
  const tarihBaslik = opts.tarihBaslik ?? "Gelecek Kal. Tarihi";
  const bugun = fmtDate(new Date());
  const yil = new Date().getFullYear();
  const tbody = devices.map(rowHtml).join("\n");

  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8">
<style>
  body{margin:0;background:#eef1f7;font-family:-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:#1f2733;padding:24px}
  .wrap{max-width:1000px;margin:0 auto;background:#fff;border:1px solid #cbd5e1;border-radius:12px;overflow:hidden}
  .bar{height:6px;background:#2f7dc0}
  .head{padding:22px 26px 6px}
  .brand{font-size:12px;letter-spacing:.13em;text-transform:uppercase;color:#9aa0ab;font-weight:700;margin:0}
  h1{font-size:21px;font-weight:800;margin:10px 0 4px}
  .meta{font-size:13.5px;color:#6b7280;margin:0}
  .count{display:inline-block;margin-top:10px;font-size:12px;font-weight:700;padding:4px 11px;border-radius:999px;color:#fff;background:#2f7dc0}
  .tablewrap{padding:18px 26px 8px;overflow-x:auto}
  table{border-collapse:collapse;width:100%;font-size:13px}
  thead th{background:#53A0D9;color:#fff;text-align:left;padding:10px 12px;border:1px solid #2f7dc0;font-weight:700;font-size:12px;white-space:nowrap}
  tbody td{padding:9px 12px;border:1px solid #cbd5e1;vertical-align:middle}
  tbody tr:nth-child(even) td{background:#eaf4fb}
  .kod{font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:700;white-space:nowrap}
  .detay{font-weight:600}
  .muted{color:#6b7280}
  .nowrap{white-space:nowrap}
  .kalan{font-weight:700;white-space:nowrap;text-align:right}
  .kalan.over{color:#c0392b}
  .kalan.warn{color:#b45309}
  .kalan .tag{font-weight:600;font-size:11px}
  .durum{display:inline-block;font-size:11.5px;font-weight:700;color:#b45309;background:#fef3c7;border:1px solid #fcd34d;padding:2px 8px;border-radius:999px;white-space:nowrap}
  .total{padding:6px 26px 4px;font-size:14px;font-weight:700}
  .foot{border-top:1px solid #cbd5e1;padding:14px 26px 20px;background:#fbfbfc;margin-top:12px}
  .foot p{margin:0 0 5px;font-size:12px;color:#9aa0ab;line-height:1.5}
</style></head>
<body>
  <div class="wrap">
    <div class="bar"></div>
    <div class="head">
      <p class="brand">İLERİ GROUP · KALİBRASYON YÖNETİM SİSTEMİ</p>
      <h1>${esc(baslik)}</h1>
      <p class="meta">Otomatik rapor · ${bugun}</p>
      <span class="count">${devices.length} cihaz</span>
    </div>
    <div class="tablewrap">
      <table>
        <thead><tr>
          <th>Kod</th><th>Cihaz Tipi</th><th>Cihaz Yeri</th><th>Seri Numarası</th><th>Cihaz Detayı</th>
          <th>Zimmet Sorumlusu</th><th>${esc(tarihBaslik)}</th><th>Kalan Gün</th><th>Durum</th>
        </tr></thead>
        <tbody>
${tbody}
        </tbody>
      </table>
    </div>
    <p class="total">Toplam: ${devices.length} cihaz</p>
    <div class="foot">
      <p>Bu e-posta otomatik olarak İleriHub Kalibrasyon Yönetim Sistemi tarafından gönderilmiştir. Lütfen yanıtlamayınız.</p>
      <p>© ${yil} İleri Group · System Development Team</p>
    </div>
  </div>
</body></html>`;
}
