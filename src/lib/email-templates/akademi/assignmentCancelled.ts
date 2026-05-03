import type { NotifyContext, RecipientGroup } from "@/lib/akademi-notify";
import { EmailContent, wrapHtml, escapeHtml, ileriHubUrl } from "./_base";

export function assignmentCancelled(
  ctx: NotifyContext,
  recipients: RecipientGroup
): EmailContent {
  const courseTitle = escapeHtml(ctx.courseTitle);
  const userName = escapeHtml(recipients.user.name);
  const reason =
    typeof ctx.data.reason === "string" && ctx.data.reason.trim()
      ? escapeHtml(ctx.data.reason)
      : "Belirtilmedi";
  const url = ileriHubUrl(ctx.link ?? "/akademi");

  const subject = `Eğitim Ataması İptal: ${ctx.courseTitle}`;

  const userBody = `
    <p>Merhaba ${userName},</p>
    <p>Size atanan aşağıdaki eğitim iptal edilmiştir.</p>
    <div class="info-box">
      <strong>Eğitim:</strong> ${courseTitle}<br>
      <strong>Sebep:</strong> ${reason}
    </div>
    <a href="${url}" class="button">Akademiye Git</a>
    <div class="meta">Bu eğitim için artık herhangi bir aksiyon almanız gerekmemektedir.</div>
  `;

  const managerBody = `
    <p>Bilgi maili.</p>
    <p><strong>${userName}</strong> isimli çalışanın eğitim ataması iptal edildi.</p>
    <div class="info-box">
      <strong>Eğitim:</strong> ${courseTitle}<br>
      <strong>Sebep:</strong> ${reason}
    </div>
  `;

  return {
    subject,
    htmlForUser: wrapHtml("Eğitim Ataması İptal Edildi", userBody),
    htmlForManager: wrapHtml("Eğitim İptali Bildirimi", managerBody),
    textForUser: `Merhaba ${recipients.user.name},\n\nSize atanan "${ctx.courseTitle}" eğitimi iptal edilmiştir.\nSebep: ${ctx.data.reason ?? "Belirtilmedi"}\n\nİleri Group · Akademi`,
    textForManager: `${recipients.user.name} için "${ctx.courseTitle}" eğitim ataması iptal edildi.\nSebep: ${ctx.data.reason ?? "Belirtilmedi"}\n\nİleri Group · Akademi`,
  };
}
