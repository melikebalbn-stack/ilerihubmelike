import type { NotifyContext, RecipientGroup } from "@/lib/akademi-notify";
import { EmailContent, wrapHtml, escapeHtml, ileriHubUrl } from "./_base";

export function examPassed(
  ctx: NotifyContext,
  recipients: RecipientGroup
): EmailContent {
  const courseTitle = escapeHtml(ctx.courseTitle);
  const userName = escapeHtml(recipients.user.name);
  const score = Number(ctx.data.score ?? 0);
  const passingScore = Number(ctx.data.passingScore ?? 0);
  const attempt = Number(ctx.data.attemptNumber ?? 1);
  const url = ileriHubUrl(ctx.link ?? "/akademi");

  const subject = `Tebrikler: ${ctx.courseTitle} sınavını geçtiniz`;

  const userBody = `
    <p>Merhaba ${userName},</p>
    <p>Tebrikler! <strong>${courseTitle}</strong> sınavını başarıyla geçtiniz.</p>
    <div class="info-box">
      <strong>Puan:</strong> %${score}<br>
      <strong>Geçme Barajı:</strong> %${passingScore}<br>
      <strong>Deneme:</strong> ${attempt}
    </div>
    <a href="${url}" class="button">Sonucu Görüntüle</a>
    <div class="meta">Eğitim sertifikanız hazırlanıyorsa ayrıca bildirim alacaksınız.</div>
  `;

  const managerBody = `
    <p>Bilgi maili.</p>
    <p><strong>${userName}</strong> isimli çalışan eğitim sınavını başarıyla geçti.</p>
    <div class="info-box">
      <strong>Eğitim:</strong> ${courseTitle}<br>
      <strong>Puan:</strong> %${score} (Baraj: %${passingScore})<br>
      <strong>Deneme:</strong> ${attempt}
    </div>
  `;

  return {
    subject,
    htmlForUser: wrapHtml("Sınavı Geçtiniz", userBody),
    htmlForManager: wrapHtml("Sınav Başarısı Bildirimi", managerBody),
    textForUser: `Tebrikler ${recipients.user.name}!\n\n"${ctx.courseTitle}" sınavını geçtiniz.\nPuan: %${score} (Baraj: %${passingScore})\nDeneme: ${attempt}\n\nİleri Group · Akademi`,
    textForManager: `${recipients.user.name} "${ctx.courseTitle}" sınavını geçti.\nPuan: %${score} / Baraj: %${passingScore}\nDeneme: ${attempt}\n\nİleri Group · Akademi`,
  };
}
