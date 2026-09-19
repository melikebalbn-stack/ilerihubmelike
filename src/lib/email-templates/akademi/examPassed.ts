import type { NotifyContext, RecipientGroup } from "@/lib/akademi-notify";
import { EmailContent, akademiMail, escapeHtml, ileriHubUrl, p } from "./_base";

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

  return {
    subject,
    htmlForUser: akademiMail({
      title: "Sınavı geçtiniz",
      subtitle: `Puan: %${score} · Geçme barajı: %${passingScore}`,
      preheader: `${ctx.courseTitle} sınavını %${score} ile geçtiniz`,
      bodyHtml:
        p(`Merhaba ${userName},`) +
        p(`Tebrikler! <strong>${courseTitle}</strong> sınavını başarıyla geçtiniz.`),
      infoRows: [
        { label: "Eğitim", value: courseTitle },
        { label: "Puan", value: `%${score}` },
        { label: "Geçme Barajı", value: `%${passingScore}` },
        { label: "Deneme", value: String(attempt) },
      ],
      cta: { label: "Sonucu Görüntüle", url },
      footnote: "Eğitim sertifikanız hazırlanıyorsa ayrıca bildirim alacaksınız.",
    }),
    htmlForManager: akademiMail({
      title: "Sınav başarısı bildirimi",
      subtitle: `${recipients.user.name} · %${score}`,
      preheader: `${recipients.user.name} — ${ctx.courseTitle} sınavını geçti`,
      bodyHtml:
        p("Bilgi maili.") +
        p(`<strong>${userName}</strong> isimli çalışan eğitim sınavını başarıyla geçti.`),
      infoRows: [
        { label: "Eğitim", value: courseTitle },
        { label: "Puan", value: `%${score} (Baraj: %${passingScore})` },
        { label: "Deneme", value: String(attempt) },
      ],
    }),
    textForUser: `Tebrikler ${recipients.user.name}!\n\n"${ctx.courseTitle}" sınavını geçtiniz.\nPuan: %${score} (Baraj: %${passingScore})\nDeneme: ${attempt}\n\nİleri Group · Akademi`,
    textForManager: `${recipients.user.name} "${ctx.courseTitle}" sınavını geçti.\nPuan: %${score} / Baraj: %${passingScore}\nDeneme: ${attempt}\n\nİleri Group · Akademi`,
  };
}
