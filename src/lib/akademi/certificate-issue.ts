import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { generateCertificatePdf } from "./certificate-pdf";
import { notifyAkademiEvent } from "@/lib/akademi-notify";

/**
 * Bir user için bir kursta sertifika oluşturur (idempotent).
 *
 * - Mevcut cert varsa skip
 * - Default template DB'den çekilir, yoksa minimal seed insert
 * - certificateNo: CERT-{YYYY}-{6 hane}
 * - verificationCode: 12 karakter base36 (crypto.randomBytes)
 * - PDF üretilip filePath set edilir; PDF üretimi hata verirse cert DB'de kalır
 * - AkademiNotification gönderilir (type: 'CERTIFICATE_ISSUED')
 */
export async function issueCertificateIfEligible(
  userId: string,
  courseId: string
) {
  const existing = await prisma.akademiCertificate.findFirst({
    where: { userId, courseId },
  });
  if (existing) return existing;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true },
  });
  if (!user || !course) return null;

  let template = await prisma.akademiCertificateTemplate.findFirst({
    where: { isDefault: true },
  });
  if (!template) {
    template = await prisma.akademiCertificateTemplate.create({
      data: {
        name: "Varsayılan Sertifika Şablonu",
        content:
          "<div>Default — PDF generator A4 landscape hardcoded layout kullanır</div>",
        isDefault: true,
      },
    });
  }

  const year = new Date().getFullYear();
  const randomPart = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, "0");
  const certificateNo = `CERT-${year}-${randomPart}`;
  const verificationCode = crypto
    .randomBytes(9)
    .toString("base64url")
    .replace(/[_-]/g, "")
    .slice(0, 12)
    .toUpperCase();

  const validUntil = template.defaultValidityMonths
    ? new Date(
        Date.now() +
          template.defaultValidityMonths * 30 * 24 * 60 * 60 * 1000
      )
    : null;

  let cert;
  try {
    cert = await prisma.akademiCertificate.create({
      data: {
        userId,
        courseId,
        templateId: template.id,
        certificateNo,
        verificationCode,
        filePath: null,
        validUntil,
      },
    });
  } catch (e) {
    // Race: aynı (userId, courseId) için başka bir process önce yarattıysa unique violation
    const after = await prisma.akademiCertificate.findFirst({
      where: { userId, courseId },
    });
    if (after) return after;
    throw e;
  }

  try {
    const pdfPath = await generateCertificatePdf({
      certificateNo,
      verificationCode,
      userName: user.name || user.email,
      courseName: course.title,
      issuedAt: cert.issuedAt,
      validUntil: cert.validUntil,
      templateId: template.id,
    });
    cert = await prisma.akademiCertificate.update({
      where: { id: cert.id },
      data: { filePath: pdfPath },
    });
  } catch (e) {
    console.error("[certificate-issue] PDF generation failed:", e);
    // Cert DB'de kayıtlı, filePath null kalır; download endpoint recovery yapar
  }

  // In-app + mail (notify-akademi her ikisini birden yönetir)
  notifyAkademiEvent({
    userId,
    eventType: "CERTIFICATE_ISSUED",
    courseTitle: course.title,
    data: {
      title: "Sertifikanız hazır",
      message: `"${course.title}" kursunu başarıyla tamamladınız. Sertifika numaranız: ${certificateNo}`,
      certificateNo: cert.certificateNo,
      validUntil: cert.validUntil,
    },
    link: `/akademi/certificates/${cert.id}`,
  }).catch((err) =>
    console.error("[certificate-issue] notify failed:", err)
  );

  return cert;
}
