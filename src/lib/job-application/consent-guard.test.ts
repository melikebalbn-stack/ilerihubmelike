import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// prisma mock — guard'ın consent-varlık + taslak-status dallarını izole test etmek için.
const consentFindUnique = vi.fn();
const appFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobApplicationConsent: { findUnique: (...a: unknown[]) => consentFindUnique(...a) },
    publicJobApplication: { findUnique: (...a: unknown[]) => appFindUnique(...a) },
  },
}));

import { verifyConsentedDraft } from "./consent-guard";
import { signDraftToken } from "./draft-cookie";

describe("verifyConsentedDraft (guard 403 yolları)", () => {
  beforeAll(() => {
    process.env.JOBAPP_COOKIE_SECRET = "test-secret-guard";
  });
  beforeEach(() => {
    consentFindUnique.mockReset();
    appFindUnique.mockReset();
  });

  it("geçerli token + consent VAR + status TASLAK → applicationId", async () => {
    consentFindUnique.mockResolvedValue({ id: "consent_1" });
    appFindUnique.mockResolvedValue({ status: "HEALTH_PENDING" }); // taslak
    const token = signDraftToken("app_1");
    await expect(verifyConsentedDraft(token)).resolves.toBe("app_1");
  });

  it("CONSENT_PENDING (health adımı) da taslak → applicationId", async () => {
    consentFindUnique.mockResolvedValue({ id: "consent_c" });
    appFindUnique.mockResolvedValue({ status: "CONSENT_PENDING" });
    const token = signDraftToken("app_c");
    await expect(verifyConsentedDraft(token)).resolves.toBe("app_c");
  });

  it("geçerli token ama consent YOK → null (403)", async () => {
    consentFindUnique.mockResolvedValue(null);
    const token = signDraftToken("app_2");
    await expect(verifyConsentedDraft(token)).resolves.toBeNull();
    expect(appFindUnique).not.toHaveBeenCalled(); // consent yoksa status'e hiç gitme
  });

  // REGRESYON — İzzet→Yaşar cookie-ezme: consent+cookie geçerli AMA başvuru
  // artık taslak değil (REJECTED/PENDING). verifyConsentedDraft null dönmeli →
  // ana form 403/409 verir, mevcut kayıt EZİLMEZ. Bir daha olmasın.
  it("consent VAR ama status REJECTED (işlenmiş) → null (ezme engellenir)", async () => {
    consentFindUnique.mockResolvedValue({ id: "consent_izzet" });
    appFindUnique.mockResolvedValue({ status: "REJECTED" });
    const token = signDraftToken("app_izzet");
    await expect(verifyConsentedDraft(token)).resolves.toBeNull();
  });

  it("consent VAR ama status PENDING (zaten gönderilmiş) → null", async () => {
    consentFindUnique.mockResolvedValue({ id: "consent_p" });
    appFindUnique.mockResolvedValue({ status: "PENDING" });
    const token = signDraftToken("app_p");
    await expect(verifyConsentedDraft(token)).resolves.toBeNull();
  });

  it("consent VAR ama başvuru kaydı YOK → null", async () => {
    consentFindUnique.mockResolvedValue({ id: "consent_x" });
    appFindUnique.mockResolvedValue(null);
    const token = signDraftToken("app_x");
    await expect(verifyConsentedDraft(token)).resolves.toBeNull();
  });

  it("tamper edilmiş token → null, DB'ye HİÇ gitmez", async () => {
    const token = signDraftToken("app_3");
    const tampered = "app_HACK" + token.slice(token.lastIndexOf("."));
    await expect(verifyConsentedDraft(tampered)).resolves.toBeNull();
    expect(consentFindUnique).not.toHaveBeenCalled();
    expect(appFindUnique).not.toHaveBeenCalled();
  });

  it("cookie yok → null, DB'ye gitmez", async () => {
    await expect(verifyConsentedDraft(undefined)).resolves.toBeNull();
    await expect(verifyConsentedDraft(null)).resolves.toBeNull();
    expect(consentFindUnique).not.toHaveBeenCalled();
    expect(appFindUnique).not.toHaveBeenCalled();
  });
});
