import type { NotifyContext, RecipientGroup } from "@/lib/akademi-notify";
import {
  EmailContent,
  wrapHtml,
  escapeHtml,
  formatDateTR,
  ileriHubUrl,
} from "./_base";

export function deadlineApproaching(
  ctx: NotifyContext,
  recipients: RecipientGroup
): EmailContent {
  const courseTitle = escapeHtml(ctx.courseTitle);
  const userName = escapeHtml(recipients.user.name);
  const deadline = formatDateTR(ctx.data.deadline as Date | string | null);
  const daysLeft = Number(ctx.data.daysLeft ?? 7);
  const url = ileriHubUrl(ctx.link ?? "/akademi");

  const subject = `Hatırlatma: ${ctx.courseTitle} (${daysLeft} gün kaldı)`;

  const userBody = `
    <p>Merhaba ${userName},</p>
    <p>Size atanan aşağıdaki eğitimin son tarihi yaklaşmaktadır.</p>
    <div class="info-box">
      <strong>Eğitim:</strong> ${courseTitle}<br>
      <strong>Son Tarih:</strong> ${deadline}<br>
      <strong>Kalan Süre:</strong> ${daysLeft} gün
    </div>
    <a href="${url}" class="button">Eğitime Devam Et</a>
    <div class="meta">Lütfen eğitimi son tarihten önce tamamlayınız.</div>
  `;

  const managerBody = `
    <p>Bilgi maili.</p>
    <p><strong>${userName}</strong> isimli çalışana atanan eğitimin son tarihi yaklaşmaktadır.</p>
    <div class="info-box">
      <strong>Eğitim:</strong> ${courseTitle}<br>
      <strong>Son Tarih:</strong> ${deadline}<br>
      <strong>Kalan Süre:</strong> ${daysLeft} gün
    </div>
  `;

  return {
    subject,
    htmlForUser: wrapHtml("Eğitim Son Tarihi Yaklaşıyor", userBody),
    htmlForManager: wrapHtml("Eğitim Deadline Hatırlatma", managerBody),
    textForUser: `Merhaba ${recipients.user.name},\n\n"${ctx.courseTitle}" eğitiminin son tarihi yaklaşıyor.\nSon Tarih: ${deadline}\nKalan Süre: ${daysLeft} gün\n\nBağlantı: ${url}\n\nİleri Group · Akademi`,
    textForManager: `${recipients.user.name} için "${ctx.courseTitle}" eğitiminin son tarihi yaklaşıyor.\nSon Tarih: ${deadline}\nKalan: ${daysLeft} gün\n\nİleri Group · Akademi`,
  };
}
