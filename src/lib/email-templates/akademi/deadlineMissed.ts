import type { NotifyContext, RecipientGroup } from "@/lib/akademi-notify";
import {
  EmailContent,
  wrapHtml,
  escapeHtml,
  formatDateTR,
  ileriHubUrl,
} from "./_base";

export function deadlineMissed(
  ctx: NotifyContext,
  recipients: RecipientGroup
): EmailContent {
  const courseTitle = escapeHtml(ctx.courseTitle);
  const userName = escapeHtml(recipients.user.name);
  const deadline = formatDateTR(ctx.data.deadline as Date | string | null);
  const daysLate = Number(ctx.data.daysLate ?? 0);
  const url = ileriHubUrl(ctx.link ?? "/akademi");

  const subject = `Eğitim Süresi Geçti: ${ctx.courseTitle}`;

  const userBody = `
    <p>Merhaba ${userName},</p>
    <p>Size atanan aşağıdaki eğitimin son tarihi geçmiştir. Lütfen en kısa sürede tamamlayınız.</p>
    <div class="info-box">
      <strong>Eğitim:</strong> ${courseTitle}<br>
      <strong>Son Tarih:</strong> ${deadline}<br>
      <strong>Gecikme:</strong> ${daysLate} gün
    </div>
    <a href="${url}" class="button">Eğitimi Tamamla</a>
    <div class="meta">Geciken eğitimler bölüm müdürünüze ve İK ekibine raporlanır.</div>
  `;

  const managerBody = `
    <p>Bilgi maili.</p>
    <p><strong>${userName}</strong> isimli çalışan, atanan eğitimi süresinde tamamlayamamıştır.</p>
    <div class="info-box">
      <strong>Eğitim:</strong> ${courseTitle}<br>
      <strong>Son Tarih:</strong> ${deadline}<br>
      <strong>Gecikme:</strong> ${daysLate} gün
    </div>
    <div class="meta">Lütfen ilgili çalışanla iletişime geçerek eğitimin tamamlanmasını sağlayınız.</div>
  `;

  return {
    subject,
    htmlForUser: wrapHtml("Eğitim Süresi Geçti", userBody),
    htmlForManager: wrapHtml("Geciken Eğitim Bildirimi", managerBody),
    textForUser: `Merhaba ${recipients.user.name},\n\n"${ctx.courseTitle}" eğitiminin son tarihi geçmiştir.\nSon Tarih: ${deadline}\nGecikme: ${daysLate} gün\n\nLütfen en kısa sürede tamamlayınız.\nBağlantı: ${url}\n\nİleri Group · Akademi`,
    textForManager: `${recipients.user.name} "${ctx.courseTitle}" eğitimini süresinde tamamlamadı.\nSon Tarih: ${deadline}\nGecikme: ${daysLate} gün\n\nİleri Group · Akademi`,
  };
}
