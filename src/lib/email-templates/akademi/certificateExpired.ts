import type { NotifyContext, RecipientGroup } from "@/lib/akademi-notify";
import {
  EmailContent,
  akademiMail,
  escapeHtml,
  formatDateTR,
  ileriHubUrl,
  p,
} from "./_base";

export function certificateExpired(
  ctx: NotifyContext,
  recipients: RecipientGroup
): EmailContent {
  const courseTitle = escapeHtml(ctx.courseTitle);
  const userName = escapeHtml(recipients.user.name);
  const certNo =
    typeof ctx.data.certificateNo === "string"
      ? escapeHtml(ctx.data.certificateNo)
      : "—";
  const expiredAt = formatDateTR(ctx.data.expiredAt as Date | string | null);
  const url = ileriHubUrl(ctx.link ?? "/akademi/certificates");

  const subject = `Sertifika Geçersiz: ${ctx.courseTitle}`;

  const rows = [
    { label: "Eğitim", value: courseTitle },
    { label: "Sertifika No", value: certNo },
    { label: "Bitiş Tarihi", value: expiredAt },
  ];

  return {
    subject,
    htmlForUser: akademiMail({
      title: "Sertifika geçersiz oldu",
      subtitle: `Bitiş: ${expiredAt}`,
      preheader: `${ctx.courseTitle} sertifikanızın süresi doldu`,
      bodyHtml:
        p(`Merhaba ${userName},`) +
        p("Aşağıdaki sertifikanızın geçerlilik süresi sona ermiştir."),
      infoRows: rows,
      cta: { label: "Sertifikayı Görüntüle", url },
      footnote: "Yetkinliğinizi sürdürmek için lütfen bölüm yöneticinizle yenileme süreci hakkında görüşün.",
    }),
    htmlForManager: akademiMail({
      title: "Sertifika geçersizlik bildirimi",
      subtitle: `${recipients.user.name} · Bitiş: ${expiredAt}`,
      preheader: `${recipients.user.name} — ${ctx.courseTitle} sertifikası geçersiz oldu`,
      bodyHtml:
        p("Bilgi maili.") +
        p(`<strong>${userName}</strong> isimli çalışanın sertifikasının geçerlilik süresi dolmuştur.`),
      infoRows: rows,
      footnote: "Çalışanın yetkinliğinin sürdürülmesi için yenileme süreci başlatılmalıdır.",
    }),
    textForUser: `Merhaba ${recipients.user.name},\n\n"${ctx.courseTitle}" sertifikanız geçersiz olmuştur.\nBitiş: ${expiredAt}\n\nYenileme için bölüm yöneticinizle görüşün.\n\nİleri Group · Akademi`,
    textForManager: `${recipients.user.name} - "${ctx.courseTitle}" sertifikası geçersiz oldu.\nBitiş: ${expiredAt}\n\nİleri Group · Akademi`,
  };
}
