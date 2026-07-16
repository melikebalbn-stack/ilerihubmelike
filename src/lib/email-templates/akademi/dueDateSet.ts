import { escapeHtml, formatDateTR, ileriHubUrl, wrapHtml } from "./_base";

// PR-IFS-RAPOR-2b: Kullanıcının IFS eğitim görevlerine son tarih atandığında
// (veya öne çekildiğinde) gönderilen tek-kişilik bilgilendirme maili.
export function dueDateSetEmail(input: {
  adSoyad: string;
  packageName: string;
  dueDate: Date;
}): { subject: string; html: string; text: string } {
  const tarih = formatDateTR(input.dueDate);
  const subject = `IFS eğitim görevleriniz için son tarih: ${tarih} — ${input.packageName}`;

  const body = `
    <p>Merhaba ${escapeHtml(input.adSoyad)},</p>
    <p>IFS geçiş eğitim görevleriniz için bir <strong>son tarih</strong> belirlendi.</p>
    <div class="info-box">
      <strong>Eğitim Paketi:</strong> ${escapeHtml(input.packageName)}<br>
      <strong>Son Tarih:</strong> ${escapeHtml(tarih)}
    </div>
    <p>Lütfen görevlerinizi belirtilen son tarihe kadar tamamlayın.</p>
    <a class="button" href="${ileriHubUrl("/akademi")}">Akademi'ye Git</a>
  `;
  const html = wrapHtml("IFS Eğitim Son Tarihi", body);

  const text =
    `Merhaba ${input.adSoyad},\n\n` +
    `IFS geçiş eğitim görevleriniz için son tarih belirlendi.\n` +
    `Eğitim Paketi: ${input.packageName}\n` +
    `Son Tarih: ${tarih}\n\n` +
    `Lütfen görevlerinizi belirtilen son tarihe kadar tamamlayın.\n` +
    `${ileriHubUrl("/akademi")}`;

  return { subject, html, text };
}
