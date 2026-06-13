import { escapeHtml, ileriHubUrl } from "./_base";

const NAVY = "#1B4F72";

/**
 * Paket ataması maili — ALICI YALNIZ KULLANICI (müdür/İK fan-out YOK).
 * ILERI markalı, email-safe (tablo tabanlı + inline style, gradient YOK).
 * İmza değişmez (packageName/courseCount/link); text fallback korunur.
 */
export function packageAssignedEmail(input: {
  userName: string;
  packageName: string;
  courseCount: number;
  link: string;
}): { subject: string; html: string; text: string } {
  const userName = escapeHtml(input.userName);
  const pkg = escapeHtml(input.packageName);
  const url = ileriHubUrl(input.link);
  const subject = `Yeni Eğitim Paketi: ${input.packageName}`;

  const html = `<!doctype html>
<html lang="tr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
          <!-- Beyaz logo şeridi (renkli logo lacivert üzerinde görünmez → beyaz zemin) -->
          <tr>
            <td align="left" style="background:#ffffff;padding:18px 28px 12px;">
              <img src="cid:ilerihub-logo" alt="ILERIHub Akademi" height="30" style="display:block;border:0;height:30px;width:auto;">
            </td>
          </tr>
          <!-- Lacivert başlık şeridi -->
          <tr>
            <td bgcolor="${NAVY}" style="background:${NAVY};padding:12px 28px;">
              <span style="color:#ffffff;font-size:14px;font-weight:700;letter-spacing:.4px;">Akademi</span>
            </td>
          </tr>
          <!-- Gövde -->
          <tr>
            <td style="padding:28px;">
              <h1 style="margin:0 0 14px;font-size:20px;font-weight:700;color:#1f2733;">Yeni eğitim paketi atandı</h1>
              <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#475569;">Merhaba ${userName},<br>Size yeni bir eğitim paketi atandı.</p>

              <!-- Paket kartı (sol kenar lacivert) -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid ${NAVY};border-radius:6px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <div style="font-size:16px;font-weight:700;color:#1f2733;">${pkg}</div>
                    <div style="margin-top:4px;font-size:13px;color:#64748b;">${input.courseCount} kurs</div>
                  </td>
                </tr>
              </table>

              <!-- Buton (padding renkli td'de → lacivert kutu yazıyı tam sarar) -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 6px;">
                <tr>
                  <td bgcolor="${NAVY}" align="center" style="background:${NAVY};border-radius:6px;padding:13px 34px;">
                    <a href="${url}" style="color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">Eğitime git</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #e2e8f0;padding:16px 28px;background:#fbfcfd;">
              <p style="margin:0;font-size:11px;line-height:1.5;color:#94a3b8;">Bu e-posta İleriHub Akademi tarafından otomatik gönderilmiştir; lütfen yanıtlamayınız.<br>© İleri Group · Akademi</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Merhaba ${input.userName},\n\nSize yeni bir eğitim paketi atandı.\n\nPaket: ${input.packageName}\nKurs sayısı: ${input.courseCount}\n\nBağlantı: ${url}\n\nİleri Group · Akademi`;

  return { subject, html, text };
}
