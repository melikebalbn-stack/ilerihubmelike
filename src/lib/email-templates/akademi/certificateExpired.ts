import type { NotifyContext, RecipientGroup } from "@/lib/akademi-notify";
import {
  EmailContent,
  wrapHtml,
  escapeHtml,
  formatDateTR,
  ileriHubUrl,
} from "./_base";

export function certificateExpired(
  ctx: NotifyContext,
  recipients: RecipientGroup
): EmailContent {
  const courseTitle = escapeHtml(ctx.courseTitle);
  const userName = escapeHtml(recipients.user.name);
  const certNo =
    typeof ctx.data.certificateNo === "string"
      ? escapeHtml(ctx.data.certificateNo)
      : "—";
  const expiredAt = formatDateTR(ctx.data.expiredAt as Date | string | null);
  const url = ileriHubUrl(ctx.link ?? "/akademi/certificates");

  const subject = `Sertifika Geçersiz: ${ctx.courseTitle}`;

  const userBody = `
    <p>Merhaba ${userName},</p>
    <p>Aşağıdaki sertifikanızın geçerlilik süresi sona ermiştir.</p>
    <div class="info-box">
      <strong>Eğitim:</strong> ${courseTitle}<br>
      <strong>Sertifika No:</strong> ${certNo}<br>
      <strong>Bitiş Tarihi:</strong> ${expiredAt}
    </div>
    <a href="${url}" class="button">Sertifikayı Görüntüle</a>
    <div class="meta">Yetkinliğinizi sürdürmek için lütfen bölüm yöneticinizle yenileme süreci hakkında görüşün.</div>
  `;

  const managerBody = `
    <p>Bilgi maili.</p>
    <p><strong>${userName}</strong> isimli çalışanın sertifikasının geçerlilik süresi dolmuştur.</p>
    <div class="info-box">
      <strong>Eğitim:</strong> ${courseTitle}<br>
      <strong>Sertifika No:</strong> ${certNo}<br>
      <strong>Bitiş Tarihi:</strong> ${expiredAt}
    </div>
    <div class="meta">Çalışanın yetkinliğinin sürdürülmesi için yenileme süreci başlatılmalıdır.</div>
  `;

  return {
    subject,
    htmlForUser: wrapHtml("Sertifika Geçersiz Oldu", userBody),
    htmlForManager: wrapHtml("Sertifika Geçersizlik Bildirimi", managerBody),
    textForUser: `Merhaba ${recipients.user.name},\n\n"${ctx.courseTitle}" sertifikanız geçersiz olmuştur.\nBitiş: ${expiredAt}\n\nYenileme için bölüm yöneticinizle görüşün.\n\nİleri Group · Akademi`,
    textForManager: `${recipients.user.name} - "${ctx.courseTitle}" sertifikası geçersiz oldu.\nBitiş: ${expiredAt}\n\nİleri Group · Akademi`,
  };
}
