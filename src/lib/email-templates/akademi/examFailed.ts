import type { NotifyContext, RecipientGroup } from "@/lib/akademi-notify";
import { EmailContent, wrapHtml, escapeHtml, ileriHubUrl } from "./_base";

export function examFailed(
  ctx: NotifyContext,
  recipients: RecipientGroup
): EmailContent {
  const courseTitle = escapeHtml(ctx.courseTitle);
  const userName = escapeHtml(recipients.user.name);
  const score = Number(ctx.data.score ?? 0);
  const passingScore = Number(ctx.data.passingScore ?? 0);
  const attempt = Number(ctx.data.attemptNumber ?? 1);
  const canRetake = Boolean(ctx.data.canRetake);
  const url = ileriHubUrl(ctx.link ?? "/akademi");

  const subject = `Sınav Sonucu: ${ctx.courseTitle}`;

  const retakeNote = canRetake
    ? "Tekrar deneme hakkınız bulunuyor."
    : "Maksimum deneme sayısına ulaştınız. Bölüm yöneticinizle iletişime geçin.";

  const userBody = `
    <p>Merhaba ${userName},</p>
    <p>${courseTitle} sınavında geçme barajının altında kaldınız.</p>
    <div class="info-box">
      <strong>Puan:</strong> %${score}<br>
      <strong>Geçme Barajı:</strong> %${passingScore}<br>
      <strong>Deneme:</strong> ${attempt}<br>
      <strong>Tekrar Deneme:</strong> ${canRetake ? "Evet" : "Hayır"}
    </div>
    <a href="${url}" class="button">Sonucu Görüntüle</a>
    <div class="meta">${retakeNote}</div>
  `;

  const managerBody = `
    <p>Bilgi maili.</p>
    <p><strong>${userName}</strong> isimli çalışan eğitim sınavında başarısız oldu.</p>
    <div class="info-box">
      <strong>Eğitim:</strong> ${courseTitle}<br>
      <strong>Puan:</strong> %${score} (Baraj: %${passingScore})<br>
      <strong>Deneme:</strong> ${attempt}<br>
      <strong>Tekrar Deneme:</strong> ${canRetake ? "Mümkün" : "Tükendi"}
    </div>
  `;

  return {
    subject,
    htmlForUser: wrapHtml("Sınav Sonucu", userBody),
    htmlForManager: wrapHtml("Sınav Başarısızlığı Bildirimi", managerBody),
    textForUser: `Merhaba ${recipients.user.name},\n\n"${ctx.courseTitle}" sınavında geçme barajının altında kaldınız.\nPuan: %${score} (Baraj: %${passingScore})\nDeneme: ${attempt}\n${retakeNote}\n\nİleri Group · Akademi`,
    textForManager: `${recipients.user.name} "${ctx.courseTitle}" sınavında başarısız oldu.\nPuan: %${score} / Baraj: %${passingScore}\nDeneme: ${attempt}\nTekrar: ${canRetake ? "Mümkün" : "Tükendi"}\n\nİleri Group · Akademi`,
  };
}
