// Sonraki adım (sağlık / başvuru) guard'ı: geçerli taslak cookie'si VE consent kaydı
// olmadan ilerlenemez (backend enforce). KVKK onaylanmadan sağlık/başvuru POST reddedilir.
import { prisma } from "@/lib/prisma";
import { verifyDraftToken } from "./draft-cookie";

/**
 * Cookie token'ını doğrula + o taslağın KVKK consent kaydı VAR mı kontrol et.
 * Geçerliyse applicationId, değilse null (çağıran 403 döner).
 * - token imzası bozuk/yok → null (tamper reddi)
 * - consent kaydı yok → null (KVKK verilmemiş)
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
  return consent ? applicationId : null;
}
