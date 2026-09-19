import type { NotifyContext, RecipientGroup } from "@/lib/akademi-notify";
import { EmailContent, akademiMail, escapeHtml, ileriHubUrl, p } from "./_base";

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

  return {
    subject,
    htmlForUser: akademiMail({
      title: "Sınav sonucu",
      subtitle: `Puan: %${score} · Geçme barajı: %${passingScore}`,
      preheader: `${ctx.courseTitle} sınav sonucunuz: %${score}`,
      bodyHtml:
        p(`Merhaba ${userName},`) +
        p(`${courseTitle} sınavında geçme barajının altında kaldınız.`),
      infoRows: [
        { label: "Eğitim", value: courseTitle },
        { label: "Puan", value: `%${score}` },
        { label: "Geçme Barajı", value: `%${passingScore}` },
        { label: "Deneme", value: String(attempt) },
        { label: "Tekrar Deneme", value: canRetake ? "Evet" : "Hayır" },
      ],
      cta: { label: "Sonucu Görüntüle", url },
      footnote: retakeNote,
    }),
    htmlForManager: akademiMail({
      title: "Sınav başarısızlığı bildirimi",
      subtitle: `${recipients.user.name} · %${score}`,
      preheader: `${recipients.user.name} — ${ctx.courseTitle} sınavında başarısız`,
      bodyHtml:
        p("Bilgi maili.") +
        p(`<strong>${userName}</strong> isimli çalışan eğitim sınavında başarısız oldu.`),
      infoRows: [
        { label: "Eğitim", value: courseTitle },
        { label: "Puan", value: `%${score} (Baraj: %${passingScore})` },
        { label: "Deneme", value: String(attempt) },
        { label: "Tekrar Deneme", value: canRetake ? "Mümkün" : "Tükendi" },
      ],
    }),
    textForUser: `Merhaba ${recipients.user.name},\n\n"${ctx.courseTitle}" sınavında geçme barajının altında kaldınız.\nPuan: %${score} (Baraj: %${passingScore})\nDeneme: ${attempt}\n${retakeNote}\n\nİleri Group · Akademi`,
    textForManager: `${recipients.user.name} "${ctx.courseTitle}" sınavında başarısız oldu.\nPuan: %${score} / Baraj: %${passingScore}\nDeneme: ${attempt}\nTekrar: ${canRetake ? "Mümkün" : "Tükendi"}\n\nİleri Group · Akademi`,
  };
}
