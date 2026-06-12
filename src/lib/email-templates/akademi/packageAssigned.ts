import { wrapHtml, escapeHtml, ileriHubUrl } from "./_base";

/**
 * Paket ataması maili — ALICI YALNIZ KULLANICI (müdür/İK fan-out YOK).
 * COURSE_ASSIGNED'dan farklı: paket seviyesinde tek mail (paket adı + kurs sayısı).
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

  const body = `
    <p>Merhaba ${userName},</p>
    <p>Size yeni bir eğitim paketi atandı.</p>
    <div class="info-box">
      <strong>Paket:</strong> ${pkg}<br>
      <strong>Kurs sayısı:</strong> ${input.courseCount}
    </div>
    <a href="${url}" class="button">Eğitimlerime Git</a>
    <div class="meta">Paketteki eğitimleri İleriHub Akademi üzerinden görüntüleyip başlayabilirsiniz.</div>
  `;

  const text = `Merhaba ${input.userName},\n\nSize yeni bir eğitim paketi atandı.\n\nPaket: ${input.packageName}\nKurs sayısı: ${input.courseCount}\n\nBağlantı: ${url}\n\nİleri Group · Akademi`;

  return { subject, html: wrapHtml("Yeni Eğitim Paketi Atandı", body), text };
}
