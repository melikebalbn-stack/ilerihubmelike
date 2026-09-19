import type { NotifyContext, RecipientGroup } from "@/lib/akademi-notify";
import {
  EmailContent,
  akademiMail,
  escapeHtml,
  formatDateTR,
  ileriHubUrl,
  p,
} from "./_base";

export function certificateExpiringSoon(
  ctx: NotifyContext,
  recipients: RecipientGroup
): EmailContent {
  const courseTitle = escapeHtml(ctx.courseTitle);
  const userName = escapeHtml(recipients.user.name);
  const certNo =
    typeof ctx.data.certificateNo === "string"
      ? escapeHtml(ctx.data.certificateNo)
      : "—";
  const validUntil = formatDateTR(ctx.data.validUntil as Date | string | null);
  const daysLeft = Number(ctx.data.daysLeft ?? 30);
  const url = ileriHubUrl(ctx.link ?? "/akademi/certificates");

  const subject = `Sertifika Süresi Doluyor: ${ctx.courseTitle} (${daysLeft} gün)`;

  const rows = [
    { label: "Eğitim", value: courseTitle },
    { label: "Sertifika No", value: certNo },
    { label: "Bitiş Tarihi", value: validUntil },
    { label: "Kalan Süre", value: `${daysLeft} gün` },
  ];

  return {
    subject,
    htmlForUser: akademiMail({
      title: "Sertifika süresi doluyor",
      subtitle: `${daysLeft} gün kaldı · Bitiş: ${validUntil}`,
      preheader: `${ctx.courseTitle} sertifikanız ${daysLeft} gün içinde doluyor`,
      bodyHtml:
        p(`Merhaba ${userName},`) +
        p("Aşağıdaki sertifikanızın geçerlilik süresi yakında dolacaktır. Yenileme süreci için bölüm yöneticinizle iletişime geçin."),
      infoRows: rows,
      cta: { label: "Sertifikayı Görüntüle", url },
      footnote: "Sertifikanın geçerliliğini koruması için ilgili eğitimi tekrar almanız gerekebilir.",
    }),
    htmlForManager: akademiMail({
      title: "Sertifika yenileme hatırlatması",
      subtitle: `${recipients.user.name} · ${daysLeft} gün kaldı`,
      preheader: `${recipients.user.name} — ${ctx.courseTitle} sertifikası ${daysLeft} gün içinde doluyor`,
      bodyHtml:
        p("Bilgi maili.") +
        p(`<strong>${userName}</strong> isimli çalışanın sertifikası yakında geçersiz olacaktır.`),
      infoRows: rows,
      footnote: "Yenileme planlamasını yapmak için bu bildirim gönderilmiştir.",
    }),
    textForUser: `Merhaba ${recipients.user.name},\n\n"${ctx.courseTitle}" sertifikanızın süresi doluyor.\nBitiş: ${validUntil}\nKalan: ${daysLeft} gün\n\nİleri Group · Akademi`,
    textForManager: `${recipients.user.name} - "${ctx.courseTitle}" sertifikası yakında geçersiz olacak.\nBitiş: ${validUntil}\nKalan: ${daysLeft} gün\n\nİleri Group · Akademi`,
  };
}
