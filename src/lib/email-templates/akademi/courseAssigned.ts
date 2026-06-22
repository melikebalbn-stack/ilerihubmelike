import type { NotifyContext, RecipientGroup } from "@/lib/akademi-notify";
import {
  EmailContent,
  wrapHtml,
  escapeHtml,
  formatDateTR,
  ileriHubUrl,
} from "./_base";

export function courseAssigned(
  ctx: NotifyContext,
  recipients: RecipientGroup
): EmailContent {
  const courseTitle = escapeHtml(ctx.courseTitle);
  const userName = escapeHtml(recipients.user.name);
  const deadline = formatDateTR(ctx.data.deadline as Date | string | null);
  const courseUrl = ileriHubUrl(ctx.link ?? "/akademi");

  const subject = `Yeni Eğitim: ${ctx.courseTitle}`;

  const userBody = `
    <p>Merhaba ${userName},</p>
    <p>Size yeni bir eğitim atandı. Aşağıdaki bilgileri inceleyip eğitime başlamanız beklenmektedir.</p>
    <div class="info-box">
      <strong>Eğitim:</strong> ${courseTitle}<br>
      <strong>Son Tarih:</strong> ${deadline}
    </div>
    <a href="${courseUrl}" class="button">Eğitime Git</a>
    <div class="meta">Eğitim son tarihinden önce tamamlamanız önemlidir. Süre yaklaştığında ek hatırlatma alacaksınız.</div>
  `;

  const managerBody = `
    <p>Bilgi maili.</p>
    <p><strong>${userName}</strong> isimli çalışana yeni bir eğitim atandı.</p>
    <div class="info-box">
      <strong>Eğitim:</strong> ${courseTitle}<br>
      <strong>Çalışan:</strong> ${userName}<br>
      <strong>Son Tarih:</strong> ${deadline}
    </div>
    <div class="meta">Bu mail bilgi amaçlıdır; sizin tarafınızdan bir aksiyon gerekmemektedir.</div>
  `;

  return {
    subject,
    htmlForUser: wrapHtml("Yeni Eğitim Atandı", userBody),
    htmlForManager: wrapHtml("Eğitim Ataması Bildirimi", managerBody),
    textForUser: `Merhaba ${recipients.user.name},\n\nSize yeni bir eğitim atandı.\n\nEğitim: ${ctx.courseTitle}\nSon Tarih: ${deadline}\n\nBağlantı: ${courseUrl}\n\nİleri Group · Akademi`,
    textForManager: `${recipients.user.name} isimli çalışana yeni eğitim atandı.\n\nEğitim: ${ctx.courseTitle}\nSon Tarih: ${deadline}\n\nİleri Group · Akademi`,
  };
}
