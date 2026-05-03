import type { NotifyContext, RecipientGroup } from "@/lib/akademi-notify";
import {
  EmailContent,
  wrapHtml,
  escapeHtml,
  formatDateTR,
  ileriHubUrl,
} from "./_base";

export function certificateExpiringSoon(
  ctx: NotifyContext,
  recipients: RecipientGroup
): EmailContent {
  const courseTitle = escapeHtml(ctx.courseTitle);
  const userName = escapeHtml(recipients.user.name);
  const certNo =
    typeof ctx.data.certificateNo === "string"
      ? escapeHtml(ctx.data.certificateNo)
      : "—";
  const validUntil = formatDateTR(ctx.data.validUntil as Date | string | null);
  const daysLeft = Number(ctx.data.daysLeft ?? 30);
  const url = ileriHubUrl(ctx.link ?? "/akademi/certificates");

  const subject = `Sertifika Süresi Doluyor: ${ctx.courseTitle} (${daysLeft} gün)`;

  const userBody = `
    <p>Merhaba ${userName},</p>
    <p>Aşağıdaki sertifikanızın geçerlilik süresi yakında dolacaktır. Yenileme süreci için bölüm yöneticinizle iletişime geçin.</p>
    <div class="info-box">
      <strong>Eğitim:</strong> ${courseTitle}<br>
      <strong>Sertifika No:</strong> ${certNo}<br>
      <strong>Bitiş Tarihi:</strong> ${validUntil}<br>
      <strong>Kalan Süre:</strong> ${daysLeft} gün
    </div>
    <a href="${url}" class="button">Sertifikayı Görüntüle</a>
    <div class="meta">Sertifikanın geçerliliğini koruması için ilgili eğitimi tekrar almanız gerekebilir.</div>
  `;

  const managerBody = `
    <p>Bilgi maili.</p>
    <p><strong>${userName}</strong> isimli çalışanın sertifikası yakında geçersiz olacaktır.</p>
    <div class="info-box">
      <strong>Eğitim:</strong> ${courseTitle}<br>
      <strong>Sertifika No:</strong> ${certNo}<br>
      <strong>Bitiş Tarihi:</strong> ${validUntil}<br>
      <strong>Kalan Süre:</strong> ${daysLeft} gün
    </div>
    <div class="meta">Yenileme planlamasını yapmak için bu bildirim gönderilmiştir.</div>
  `;

  return {
    subject,
    htmlForUser: wrapHtml("Sertifika Süresi Doluyor", userBody),
    htmlForManager: wrapHtml("Sertifika Yenileme Hatırlatma", managerBody),
    textForUser: `Merhaba ${recipients.user.name},\n\n"${ctx.courseTitle}" sertifikanızın süresi doluyor.\nBitiş: ${validUntil}\nKalan: ${daysLeft} gün\n\nİleri Group · Akademi`,
    textForManager: `${recipients.user.name} - "${ctx.courseTitle}" sertifikası yakında geçersiz olacak.\nBitiş: ${validUntil}\nKalan: ${daysLeft} gün\n\nİleri Group · Akademi`,
  };
}
