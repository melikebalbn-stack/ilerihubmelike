import type { NotifyContext, RecipientGroup } from "@/lib/akademi-notify";
import {
  EmailContent,
  akademiMail,
  escapeHtml,
  formatDateTR,
  ileriHubUrl,
  p,
} from "./_base";

export function certificateIssued(
  ctx: NotifyContext,
  recipients: RecipientGroup
): EmailContent {
  const courseTitle = escapeHtml(ctx.courseTitle);
  const userName = escapeHtml(recipients.user.name);
  const certNoRaw =
    typeof ctx.data.certificateNo === "string" ? ctx.data.certificateNo : "—";
  const certNo = escapeHtml(certNoRaw);
  const validUntil = ctx.data.validUntil
    ? formatDateTR(ctx.data.validUntil as Date | string)
    : "Süresiz";
  const url = ileriHubUrl(ctx.link ?? "/akademi/certificates");
  const issuedAt = formatDateTR(new Date());

  const subject = `Sertifikanız Hazır: ${ctx.courseTitle}`;

  // Onaylı taslak: "Sınav sonucu" satırı YOK (sertifika sınavsız da düzenlenebilir).
  const rows = [
    { label: "Eğitim", value: courseTitle },
    { label: "Sertifika No", value: certNo },
    { label: "Geçerlilik", value: validUntil },
  ];

  return {
    subject,
    htmlForUser: akademiMail({
      title: "Sertifikanız hazır",
      subtitle: `${issuedAt} · Sertifika No: ${certNoRaw}`,
      preheader: `${ctx.courseTitle} sertifikanız hazır — ${certNoRaw}`,
      bodyHtml:
        p(`Merhaba ${userName},`) +
        p(`Tebrikler! <strong>${courseTitle}</strong> eğitimini başarıyla tamamladınız ve sertifikanız düzenlendi.`),
      infoRows: rows,
      cta: { label: "Sertifikayı Görüntüle", url },
      footnote: "Sertifikanızı PDF olarak indirebilir, doğrulama bağlantısıyla paylaşabilirsiniz.",
    }),
    htmlForManager: akademiMail({
      title: "Sertifika düzenlendi",
      subtitle: `${recipients.user.name} · ${issuedAt}`,
      preheader: `${recipients.user.name} — ${ctx.courseTitle} sertifikası düzenlendi`,
      bodyHtml:
        p("Bilgi maili.") +
        p(`<strong>${userName}</strong> isimli çalışan eğitimi tamamladı ve sertifikası düzenlendi.`),
      infoRows: rows,
    }),
    textForUser: `Tebrikler ${recipients.user.name}!\n\n"${ctx.courseTitle}" eğitimini tamamladınız.\nSertifika No: ${certNo}\nGeçerlilik: ${validUntil}\n\nGörüntüle: ${url}\n\nİleri Group · Akademi`,
    textForManager: `${recipients.user.name} "${ctx.courseTitle}" eğitimini tamamladı.\nSertifika No: ${certNo}\nGeçerlilik: ${validUntil}\n\nİleri Group · Akademi`,
  };
}
