import type { NotifyContext, RecipientGroup } from "@/lib/akademi-notify";
import {
  EmailContent,
  akademiMail,
  escapeHtml,
  formatDateTR,
  ileriHubUrl,
  p,
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

  const rows = [
    { label: "Eğitim", value: courseTitle },
    { label: "Son Tarih", value: deadline },
    { label: "Gecikme", value: `${daysLate} gün` },
  ];

  return {
    subject,
    htmlForUser: akademiMail({
      title: "Eğitim süresi geçti",
      subtitle: `Son tarih: ${deadline} · ${daysLate} gün gecikme`,
      preheader: `${ctx.courseTitle} eğitiminin son tarihi geçti`,
      bodyHtml:
        p(`Merhaba ${userName},`) +
        p("Size atanan aşağıdaki eğitimin son tarihi geçmiştir. Lütfen en kısa sürede tamamlayınız."),
      infoRows: rows,
      cta: { label: "Eğitimi Tamamla", url },
      footnote: "Geciken eğitimler bölüm müdürünüze ve İK ekibine raporlanır.",
    }),
    htmlForManager: akademiMail({
      title: "Geciken eğitim bildirimi",
      subtitle: `${recipients.user.name} · ${daysLate} gün gecikme`,
      preheader: `${recipients.user.name} — ${ctx.courseTitle} süresinde tamamlanmadı`,
      bodyHtml:
        p("Bilgi maili.") +
        p(`<strong>${userName}</strong> isimli çalışan, atanan eğitimi süresinde tamamlayamamıştır.`),
      infoRows: rows,
      footnote: "Lütfen ilgili çalışanla iletişime geçerek eğitimin tamamlanmasını sağlayınız.",
    }),
    textForUser: `Merhaba ${recipients.user.name},\n\n"${ctx.courseTitle}" eğitiminin son tarihi geçmiştir.\nSon Tarih: ${deadline}\nGecikme: ${daysLate} gün\n\nLütfen en kısa sürede tamamlayınız.\nBağlantı: ${url}\n\nİleri Group · Akademi`,
    textForManager: `${recipients.user.name} "${ctx.courseTitle}" eğitimini süresinde tamamlamadı.\nSon Tarih: ${deadline}\nGecikme: ${daysLate} gün\n\nİleri Group · Akademi`,
  };
}
