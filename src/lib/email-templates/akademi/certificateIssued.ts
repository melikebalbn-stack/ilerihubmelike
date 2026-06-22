import type { NotifyContext, RecipientGroup } from "@/lib/akademi-notify";
import {
  EmailContent,
  wrapHtml,
  escapeHtml,
  formatDateTR,
  ileriHubUrl,
} from "./_base";

export function certificateIssued(
  ctx: NotifyContext,
  recipients: RecipientGroup
): EmailContent {
  const courseTitle = escapeHtml(ctx.courseTitle);
  const userName = escapeHtml(recipients.user.name);
  const certNo =
    typeof ctx.data.certificateNo === "string"
      ? escapeHtml(ctx.data.certificateNo)
      : "—";
  const validUntil = ctx.data.validUntil
    ? formatDateTR(ctx.data.validUntil as Date | string)
    : "Süresiz";
  const url = ileriHubUrl(ctx.link ?? "/akademi/certificates");

  const subject = `Sertifikanız Hazır: ${ctx.courseTitle}`;

  const userBody = `
    <p>Merhaba ${userName},</p>
    <p>Tebrikler! <strong>${courseTitle}</strong> eğitimini başarıyla tamamladınız ve sertifikanız hazırlanmıştır.</p>
    <div class="info-box">
      <strong>Sertifika No:</strong> ${certNo}<br>
      <strong>Geçerlilik:</strong> ${validUntil}
    </div>
    <a href="${url}" class="button">Sertifikayı Görüntüle</a>
    <div class="meta">Sertifikanızı PDF olarak indirebilir, doğrulama bağlantısıyla paylaşabilirsiniz.</div>
  `;

  const managerBody = `
    <p>Bilgi maili.</p>
    <p><strong>${userName}</strong> isimli çalışan eğitimi tamamladı ve sertifikası düzenlendi.</p>
    <div class="info-box">
      <strong>Eğitim:</strong> ${courseTitle}<br>
      <strong>Sertifika No:</strong> ${certNo}<br>
      <strong>Geçerlilik:</strong> ${validUntil}
    </div>
  `;

  return {
    subject,
    htmlForUser: wrapHtml("Sertifikanız Hazır", userBody),
    htmlForManager: wrapHtml("Sertifika Düzenlendi", managerBody),
    textForUser: `Tebrikler ${recipients.user.name}!\n\n"${ctx.courseTitle}" eğitimini tamamladınız.\nSertifika No: ${certNo}\nGeçerlilik: ${validUntil}\n\nGörüntüle: ${url}\n\nİleri Group · Akademi`,
    textForManager: `${recipients.user.name} "${ctx.courseTitle}" eğitimini tamamladı.\nSertifika No: ${certNo}\nGeçerlilik: ${validUntil}\n\nİleri Group · Akademi`,
  };
}
