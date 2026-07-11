import crypto from "crypto";

// Aday sınav oturumu için kriptografik olarak güçlü token.
// cuid() tahmin edilebilir bileşenler içerir → bir public sayfanın TEK kimlik
// doğrulaması olamaz. 32 byte crypto-random → ~256 bit entropi, base64url.
export function generateAssessmentToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}
