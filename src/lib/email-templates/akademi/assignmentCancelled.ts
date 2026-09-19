import type { NotifyContext, RecipientGroup } from "@/lib/akademi-notify";
import { EmailContent, akademiMail, escapeHtml, ileriHubUrl, p } from "./_base";

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

  return {
    subject,
    htmlForUser: akademiMail({
      title: "Eğitim ataması iptal edildi",
      subtitle: ctx.courseTitle,
      preheader: `${ctx.courseTitle} eğitim atamanız iptal edildi`,
      bodyHtml:
        p(`Merhaba ${userName},`) +
        p("Size atanan aşağıdaki eğitim iptal edilmiştir."),
      infoRows: [
        { label: "Eğitim", value: courseTitle },
        { label: "Sebep", value: reason },
      ],
      cta: { label: "Akademiye Git", url },
      footnote: "Bu eğitim için artık herhangi bir aksiyon almanız gerekmemektedir.",
    }),
    htmlForManager: akademiMail({
      title: "Eğitim iptali bildirimi",
      subtitle: `${recipients.user.name} · ${ctx.courseTitle}`,
      preheader: `${recipients.user.name} için eğitim ataması iptal edildi`,
      bodyHtml:
        p("Bilgi maili.") +
        p(`<strong>${userName}</strong> isimli çalışanın eğitim ataması iptal edildi.`),
      infoRows: [
        { label: "Eğitim", value: courseTitle },
        { label: "Sebep", value: reason },
      ],
    }),
    textForUser: `Merhaba ${recipients.user.name},\n\nSize atanan "${ctx.courseTitle}" eğitimi iptal edilmiştir.\nSebep: ${ctx.data.reason ?? "Belirtilmedi"}\n\nİleri Group · Akademi`,
    textForManager: `${recipients.user.name} için "${ctx.courseTitle}" eğitim ataması iptal edildi.\nSebep: ${ctx.data.reason ?? "Belirtilmedi"}\n\nİleri Group · Akademi`,
  };
}
