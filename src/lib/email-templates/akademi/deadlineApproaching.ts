import type { NotifyContext, RecipientGroup } from "@/lib/akademi-notify";
import {
  EmailContent,
  akademiMail,
  escapeHtml,
  formatDateTR,
  ileriHubUrl,
  p,
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

  const rows = [
    { label: "Eğitim", value: courseTitle },
    { label: "Son Tarih", value: deadline },
    { label: "Kalan Süre", value: `${daysLeft} gün` },
  ];

  return {
    subject,
    htmlForUser: akademiMail({
      title: "Eğitim son tarihi yaklaşıyor",
      subtitle: `${daysLeft} gün kaldı · Son tarih: ${deadline}`,
      preheader: `${ctx.courseTitle} için ${daysLeft} gün kaldı`,
      bodyHtml:
        p(`Merhaba ${userName},`) +
        p("Size atanan aşağıdaki eğitimin son tarihi yaklaşmaktadır."),
      infoRows: rows,
      cta: { label: "Eğitime Devam Et", url },
      footnote: "Lütfen eğitimi son tarihten önce tamamlayınız.",
    }),
    htmlForManager: akademiMail({
      title: "Eğitim son tarihi hatırlatması",
      subtitle: `${recipients.user.name} · ${daysLeft} gün kaldı`,
      preheader: `${recipients.user.name} — ${ctx.courseTitle} için ${daysLeft} gün kaldı`,
      bodyHtml:
        p("Bilgi maili.") +
        p(`<strong>${userName}</strong> isimli çalışana atanan eğitimin son tarihi yaklaşmaktadır.`),
      infoRows: rows,
    }),
    textForUser: `Merhaba ${recipients.user.name},\n\n"${ctx.courseTitle}" eğitiminin son tarihi yaklaşıyor.\nSon Tarih: ${deadline}\nKalan Süre: ${daysLeft} gün\n\nBağlantı: ${url}\n\nİleri Group · Akademi`,
    textForManager: `${recipients.user.name} için "${ctx.courseTitle}" eğitiminin son tarihi yaklaşıyor.\nSon Tarih: ${deadline}\nKalan: ${daysLeft} gün\n\nİleri Group · Akademi`,
  };
}
