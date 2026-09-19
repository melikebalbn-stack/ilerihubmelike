import { akademiMail, escapeHtml, formatDateTR, ileriHubUrl, p } from "./_base";

// PR-IFS-RAPOR-2b: Kullanıcının IFS eğitim görevlerine son tarih atandığında
// (veya öne çekildiğinde) gönderilen tek-kişilik bilgilendirme maili.
export function dueDateSetEmail(input: {
  adSoyad: string;
  packageName: string;
  dueDate: Date;
}): { subject: string; html: string; text: string } {
  const tarih = formatDateTR(input.dueDate);
  const subject = `IFS eğitim görevleriniz için son tarih: ${tarih} — ${input.packageName}`;
  const url = ileriHubUrl("/akademi");

  const html = akademiMail({
    title: "IFS eğitim son tarihi",
    subtitle: `Son tarih: ${tarih}`,
    preheader: `${input.packageName} görevleriniz için son tarih: ${tarih}`,
    bodyHtml:
      p(`Merhaba ${escapeHtml(input.adSoyad)},`) +
      p("IFS geçiş eğitim görevleriniz için bir <strong>son tarih</strong> belirlendi."),
    infoRows: [
      { label: "Eğitim Paketi", value: escapeHtml(input.packageName) },
      { label: "Son Tarih", value: escapeHtml(tarih) },
    ],
    afterHtml: p("Lütfen görevlerinizi belirtilen son tarihe kadar tamamlayın."),
    cta: { label: "Akademi'ye Git", url },
  });

  const text =
    `Merhaba ${input.adSoyad},\n\n` +
    `IFS geçiş eğitim görevleriniz için son tarih belirlendi.\n` +
    `Eğitim Paketi: ${input.packageName}\n` +
    `Son Tarih: ${tarih}\n\n` +
    `Lütfen görevlerinizi belirtilen son tarihe kadar tamamlayın.\n` +
    `${url}`;

  return { subject, html, text };
}
