// Sonraki adım (sağlık / başvuru) guard'ı: geçerli taslak cookie'si VE consent kaydı
// olmadan ilerlenemez (backend enforce). KVKK onaylanmadan sağlık/başvuru POST reddedilir.
import { prisma } from "@/lib/prisma";
import { verifyDraftToken } from "./draft-cookie";
import type { JobApplicationStatus } from "@/generated/prisma";

// Taslak (asıl form henüz gönderilmemiş) statüler — BEYAZ LİSTE.
// Yeni statü eklenirse otomatik "taslak-değil" sayılır → güvenli varsayılan
// (blocklist değil; ileride statü eklenince yanlışlıkla taslak sanılmaz).
export const DRAFT_STATUSES: JobApplicationStatus[] = ["CONSENT_PENDING", "HEALTH_PENDING"];

export function isDraftStatus(status: JobApplicationStatus | null | undefined): boolean {
  return !!status && DRAFT_STATUSES.includes(status);
}

/**
 * Cookie token'ını doğrula + o taslağın KVKK consent kaydı VAR mı + hâlâ TASLAK mı.
 * Geçerliyse applicationId, değilse null (çağıran 403 döner).
 * - token imzası bozuk/yok → null (tamper reddi)
 * - consent kaydı yok → null (KVKK verilmemiş)
 * - status taslak değil (PENDING+/işlenmiş) → null (çift emniyet: cookie yeniden
 *   kullanımıyla gönderilmiş başvurunun ezilmesini engeller)
 */
export async function verifyConsentedDraft(
  token: string | undefined | null
): Promise<string | null> {
  const applicationId = verifyDraftToken(token);
  if (!applicationId) return null;
  const consent = await prisma.jobApplicationConsent.findUnique({
    where: { applicationId },
    select: { id: true },
  });
  if (!consent) return null;
  const app = await prisma.publicJobApplication.findUnique({
    where: { id: applicationId },
    select: { status: true },
  });
  if (!app || !isDraftStatus(app.status)) return null;
  return applicationId;
}
