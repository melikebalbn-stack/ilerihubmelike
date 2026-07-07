// İş başvuru taslak taşıma — HMAC imzalı token (httpOnly cookie).
// Sır JOBAPP_COOKIE_SECRET env'den okunur; TANIMLI DEĞİLSE açık hata (sessiz fallback YOK).

import crypto from "crypto";

export const DRAFT_COOKIE_NAME = "jobapp_draft";

function getSecret(): string {
  const s = process.env.JOBAPP_COOKIE_SECRET;
  if (!s || s.trim() === "") {
    throw new Error("JOBAPP_COOKIE_SECRET tanımlı değil");
  }
  return s;
}

function hmac(applicationId: string): string {
  return crypto
    .createHmac("sha256", getSecret())
    .update(applicationId)
    .digest("base64url");
}

/** applicationId → "applicationId.signature" imzalı token. */
export function signDraftToken(applicationId: string): string {
  return `${applicationId}.${hmac(applicationId)}`;
}

/**
 * Token doğrula → applicationId veya null. İmza uyuşmazsa/format bozuksa null.
 * timing-safe karşılaştırma (tamper direnci).
 */
export function verifyDraftToken(token: string | undefined | null): string | null {
  if (!token || typeof token !== "string") return null;
  const idx = token.lastIndexOf(".");
  if (idx <= 0 || idx === token.length - 1) return null;
  const applicationId = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = hmac(applicationId);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  return applicationId;
}
