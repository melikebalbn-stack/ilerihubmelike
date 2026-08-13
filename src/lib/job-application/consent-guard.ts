// Sonraki adım (sağlık / başvuru) guard'ı: geçerli taslak cookie'si VE consent kaydı
// olmadan ilerlenemez (backend enforce). KVKK onaylanmadan sağlık/başvuru POST reddedilir.
import { prisma } from "@/lib/prisma";
import { verifyDraftToken } from "./draft-cookie";
import type { JobApplicationStatus } from "@/generated/prisma";
import { IK_T_866 } from "@/content/ik-t-866";

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

// ── Faz 1: aday düzeltmesi (ADAYA_GERI_GONDERILDI) ────────────────────────────
//
// KVKK onayı ve sağlık beyanı KAYITLARI KORUNUR — yeniden ALINMAZ. Gerekçe:
//   · JobApplicationConsent / JobApplicationHealth 1:1 ve applicationId @unique →
//     aynı başvuruya ikinci onay kaydı zaten yazılamaz.
//   · Onay kaydı signatureImage (canvas imzası) + consentTextHash (gösterilen metnin
//     SHA-256'sı, tamper-evidence) taşıyor. Silip yeniden almak var olan hukuki delili
//     yok eder; aday aynı kişi, onay kapsamı (işe alım süreci) değişmiyor.
//
// TEK İSTİSNA: onay kaydındaki documentCode/documentRev GÜNCEL metinden farklıysa
// (KVKK metni revize edilmişse), aday artık yürürlükte olmayan bir metne onay vermiş
// olur → yeniden onay gerekir. Karşılaştırma mevcut alanlardan yapılır; yeni kolon yok.

/** Düzeltme yolunun kabul ettiği statü — tek eleman ama TEK KAYNAK olsun diye sabit. */
export const DUZELTME_STATUSES: JobApplicationStatus[] = ["ADAYA_GERI_GONDERILDI"];

export function isDuzeltmeStatus(status: JobApplicationStatus | null | undefined): boolean {
  return !!status && DUZELTME_STATUSES.includes(status);
}

export type DuzeltmeOnayDurumu =
  | { ok: true }
  | { ok: false; kod: "CONSENT_YOK" | "HEALTH_YOK" | "REV_ESKI"; mesaj: string };

/**
 * Düzeltme gönderimi öncesi onay durumu. Kayıtlar duruyorsa ve rev GÜNCELSE ok:true —
 * aday KVKK/sağlık adımlarını TEKRAR GÖRMEZ, doğrudan formu doldurur.
 */
export async function duzeltmeOnayDurumu(applicationId: string): Promise<DuzeltmeOnayDurumu> {
  const [consent, health] = await Promise.all([
    prisma.jobApplicationConsent.findUnique({
      where: { applicationId },
      select: { documentCode: true, documentRev: true },
    }),
    prisma.jobApplicationHealth.findUnique({
      where: { applicationId },
      select: { id: true },
    }),
  ]);

  if (!consent) {
    return { ok: false, kod: "CONSENT_YOK", mesaj: "KVKK onayı bulunamadı, yeniden alınmalı." };
  }
  if (!health) {
    return { ok: false, kod: "HEALTH_YOK", mesaj: "Sağlık beyanı bulunamadı, yeniden alınmalı." };
  }
  if (
    consent.documentCode !== IK_T_866.documentCode ||
    consent.documentRev !== IK_T_866.documentRev
  ) {
    return {
      ok: false,
      kod: "REV_ESKI",
      mesaj:
        `KVKK metni güncellendi (${consent.documentCode} Rev.${consent.documentRev} → ` +
        `${IK_T_866.documentCode} Rev.${IK_T_866.documentRev}). Onayın yenilenmesi gerekiyor.`,
    };
  }
  return { ok: true };
}
