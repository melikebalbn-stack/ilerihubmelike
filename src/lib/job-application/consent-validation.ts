// KVKK consent payload doğrulama — SAF mantık (test edilebilir; DB/isteğe bağımsız).
import { validateTcKimlik } from "./tc-kimlik";

/**
 * Canvas imzası geçerli mi? data:image/png;base64,... formatı + boş-imza reddi.
 * Boş/çizilmemiş canvas çok küçük bir PNG üretir; eşik ile ayrılır (heuristik).
 */
export function isValidSignatureImage(v: unknown): boolean {
  if (typeof v !== "string") return false;
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(v.trim());
  if (!m) return false;
  return m[1].length > 500; // boş canvas ~<300 char; gerçek imza çok daha büyük
}

export interface ConsentInput {
  adSoyad?: string;
  tcKimlikNo?: string;
  consentAccepted?: boolean;
  signatureImage?: string;
}

export type ConsentValidationResult =
  | { ok: true }
  | { ok: false; error: string };

/** Tüm KVKK alanlarını doğrula (adSoyad, TC algoritması, onay, imza-boş). */
export function validateConsentInput(input: ConsentInput): ConsentValidationResult {
  if (!input.adSoyad || input.adSoyad.trim().length < 2) {
    return { ok: false, error: "Ad Soyad zorunludur" };
  }
  if (!validateTcKimlik((input.tcKimlikNo ?? "").trim())) {
    return { ok: false, error: "Geçerli bir T.C. Kimlik No giriniz" };
  }
  if (input.consentAccepted !== true) {
    return { ok: false, error: "KVKK aydınlatma metnini onaylamanız zorunludur" };
  }
  if (!isValidSignatureImage(input.signatureImage)) {
    return { ok: false, error: "İmza alanı boş bırakılamaz" };
  }
  return { ok: true };
}
