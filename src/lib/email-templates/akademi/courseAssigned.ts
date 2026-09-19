import type { NotifyContext, RecipientGroup } from "@/lib/akademi-notify";
import {
  EmailContent,
  akademiMail,
  escapeHtml,
  formatDateTR,
  ileriHubUrl,
  p,
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

  return {
    subject,
    htmlForUser: akademiMail({
      title: "Yeni eğitim atandı",
      subtitle: `Son tarih: ${deadline}`,
      preheader: `${ctx.courseTitle} eğitimi size atandı`,
      bodyHtml:
        p(`Merhaba ${userName},`) +
        p("Size yeni bir eğitim atandı. Aşağıdaki bilgileri inceleyip eğitime başlamanız beklenmektedir."),
      infoRows: [
        { label: "Eğitim", value: courseTitle },
        { label: "Son Tarih", value: deadline },
      ],
      cta: { label: "Eğitime Git", url: courseUrl },
      footnote:
        "Eğitimi son tarihinden önce tamamlamanız önemlidir; süre yaklaştığında ek hatırlatma alacaksınız.",
    }),
    htmlForManager: akademiMail({
      title: "Eğitim ataması bildirimi",
      subtitle: `${recipients.user.name} · Son tarih: ${deadline}`,
      preheader: `${recipients.user.name} için yeni eğitim: ${ctx.courseTitle}`,
      bodyHtml:
        p("Bilgi maili.") +
        p(`<strong>${userName}</strong> isimli çalışana yeni bir eğitim atandı.`),
      infoRows: [
        { label: "Eğitim", value: courseTitle },
        { label: "Çalışan", value: userName },
        { label: "Son Tarih", value: deadline },
      ],
      footnote: "Bu mail bilgi amaçlıdır; sizin tarafınızdan bir aksiyon gerekmemektedir.",
    }),
    textForUser: `Merhaba ${recipients.user.name},\n\nSize yeni bir eğitim atandı.\n\nEğitim: ${ctx.courseTitle}\nSon Tarih: ${deadline}\n\nBağlantı: ${courseUrl}\n\nİleri Group · Akademi`,
    textForManager: `${recipients.user.name} isimli çalışana yeni eğitim atandı.\n\nEğitim: ${ctx.courseTitle}\nSon Tarih: ${deadline}\n\nİleri Group · Akademi`,
  };
}
