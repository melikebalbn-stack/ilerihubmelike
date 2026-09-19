import { akademiMail, escapeHtml, ileriHubUrl, p } from "./_base";

/**
 * Paket ataması maili — ALICI YALNIZ KULLANICI (müdür/İK fan-out YOK).
 * Kurumsal yerleşim (../layout.ts); logo CID → gönderen `logoAttachments()` verir.
 * İmza değişmez (packageName/courseCount/link); text fallback korunur.
 */
export function packageAssignedEmail(input: {
  userName: string;
  packageName: string;
  courseCount: number;
  link: string;
}): { subject: string; html: string; text: string } {
  const userName = escapeHtml(input.userName);
  const pkg = escapeHtml(input.packageName);
  const url = ileriHubUrl(input.link);
  const subject = `Yeni Eğitim Paketi: ${input.packageName}`;

  const html = akademiMail({
    title: "Yeni eğitim paketi atandı",
    subtitle: `${input.courseCount} kurs`,
    preheader: `${input.packageName} eğitim paketi size atandı`,
    bodyHtml: p(`Merhaba ${userName},`) + p("Size yeni bir eğitim paketi atandı."),
    infoRows: [
      { label: "Eğitim Paketi", value: pkg },
      { label: "Kurs Sayısı", value: String(input.courseCount) },
    ],
    cta: { label: "Eğitime Git", url },
  });

  const text = `Merhaba ${input.userName},\n\nSize yeni bir eğitim paketi atandı.\n\nPaket: ${input.packageName}\nKurs sayısı: ${input.courseCount}\n\nBağlantı: ${url}\n\nİleri Group · Akademi`;

  return { subject, html, text };
}
