export type EmailContent = {
  subject: string;
  htmlForUser: string;
  htmlForManager: string;
  textForUser: string;
  textForManager: string;
};

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatDateTR(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function ileriHubUrl(path: string): string {
  const base =
    process.env.ILERIHUB_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  return `${base}${path.startsWith("/") ? path : "/" + path}`;
}

export function wrapHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; background: #f5f7fa; margin: 0; padding: 20px; color: #2d3748; }
  .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
  .header { background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); color: #ffffff; padding: 24px 32px; }
  .header h1 { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: 0.3px; }
  .header .brand { font-size: 13px; opacity: 0.85; margin-top: 4px; }
  .content { padding: 28px 32px; }
  .content p { line-height: 1.6; margin: 0 0 14px 0; }
  .info-box { background: #f0fdfa; border-left: 4px solid #0d9488; padding: 16px 18px; margin: 18px 0; border-radius: 4px; }
  .info-box strong { color: #134e4a; }
  .button { display: inline-block; background: #0d9488; color: #ffffff !important; padding: 11px 22px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px; margin-top: 8px; }
  .footer { padding: 18px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center; }
  .meta { font-size: 12px; color: #6b7280; margin-top: 14px; padding-top: 14px; border-top: 1px solid #e5e7eb; }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(title)}</h1>
      <div class="brand">İleri Group · Akademi</div>
    </div>
    <div class="content">${body}</div>
    <div class="footer">
      Bu e-posta ILERIHub Akademi modülü tarafından otomatik gönderilmiştir.<br>
      İleri Group © ${new Date().getFullYear()}
    </div>
  </div>
</body>
</html>`;
}
