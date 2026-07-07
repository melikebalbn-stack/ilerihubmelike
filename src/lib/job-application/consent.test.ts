import { describe, it, expect, beforeAll } from "vitest";
import {
  isValidSignatureImage,
  validateConsentInput,
} from "./consent-validation";
import { signDraftToken, verifyDraftToken } from "./draft-cookie";

const validSig = "data:image/png;base64," + "A".repeat(600);

describe("isValidSignatureImage", () => {
  it("geçerli PNG dataURL (yeterli uzunluk) → true", () => {
    expect(isValidSignatureImage(validSig)).toBe(true);
  });
  it("boş / çok kısa (boş canvas) → false", () => {
    expect(isValidSignatureImage("")).toBe(false);
    expect(isValidSignatureImage("data:image/png;base64,AAAA")).toBe(false);
    expect(isValidSignatureImage(null)).toBe(false);
    expect(isValidSignatureImage(undefined)).toBe(false);
  });
  it("png olmayan / bozuk format → false", () => {
    expect(isValidSignatureImage("data:image/jpeg;base64," + "A".repeat(600))).toBe(false);
    expect(isValidSignatureImage("A".repeat(600))).toBe(false);
  });
});

describe("validateConsentInput", () => {
  const base = {
    adSoyad: "Ali Veli",
    tcKimlikNo: "10000000146",
    consentAccepted: true,
    signatureImage: validSig,
  };
  it("tüm alanlar geçerli → ok", () => {
    expect(validateConsentInput(base)).toEqual({ ok: true });
  });
  it("adSoyad boş → hata", () => {
    expect(validateConsentInput({ ...base, adSoyad: " " }).ok).toBe(false);
  });
  it("geçersiz TC → hata", () => {
    expect(validateConsentInput({ ...base, tcKimlikNo: "123" }).ok).toBe(false);
  });
  it("onay verilmedi → hata", () => {
    expect(validateConsentInput({ ...base, consentAccepted: false }).ok).toBe(false);
  });
  it("imza boş → hata", () => {
    const r = validateConsentInput({ ...base, signatureImage: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("İmza");
  });
});

describe("draft-cookie HMAC (tamper reddi)", () => {
  beforeAll(() => {
    process.env.JOBAPP_COOKIE_SECRET = "test-secret-123";
  });

  it("sign → verify roundtrip → applicationId", () => {
    const token = signDraftToken("app_abc123");
    expect(verifyDraftToken(token)).toBe("app_abc123");
  });

  it("imza bozulursa → null (tamper)", () => {
    const token = signDraftToken("app_abc123");
    const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
    expect(verifyDraftToken(tampered)).toBeNull();
  });

  it("applicationId bozulursa → null (imza uymaz)", () => {
    const token = signDraftToken("app_abc123");
    const idx = token.lastIndexOf(".");
    const tampered = "app_XXXfake" + token.slice(idx);
    expect(verifyDraftToken(tampered)).toBeNull();
  });

  it("boş / formatsız token → null", () => {
    expect(verifyDraftToken(null)).toBeNull();
    expect(verifyDraftToken(undefined)).toBeNull();
    expect(verifyDraftToken("noDotToken")).toBeNull();
    expect(verifyDraftToken(".sigonly")).toBeNull();
  });

  it("farklı secret ile imzalanmış token → null", () => {
    const token = signDraftToken("app_abc123");
    process.env.JOBAPP_COOKIE_SECRET = "different-secret";
    expect(verifyDraftToken(token)).toBeNull();
    process.env.JOBAPP_COOKIE_SECRET = "test-secret-123";
  });

  it("JOBAPP_COOKIE_SECRET yoksa → açık hata (sessiz fallback yok)", () => {
    const saved = process.env.JOBAPP_COOKIE_SECRET;
    delete process.env.JOBAPP_COOKIE_SECRET;
    expect(() => signDraftToken("x")).toThrow("JOBAPP_COOKIE_SECRET tanımlı değil");
    process.env.JOBAPP_COOKIE_SECRET = saved;
  });
});
