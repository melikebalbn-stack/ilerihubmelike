import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// prisma mock — guard'ın consent-varlık dalını izole test etmek için.
const findUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { jobApplicationConsent: { findUnique: (...a: unknown[]) => findUnique(...a) } },
}));

import { verifyConsentedDraft } from "./consent-guard";
import { signDraftToken } from "./draft-cookie";

describe("verifyConsentedDraft (guard 403 yolları)", () => {
  beforeAll(() => {
    process.env.JOBAPP_COOKIE_SECRET = "test-secret-guard";
  });
  beforeEach(() => findUnique.mockReset());

  it("geçerli token + consent VAR → applicationId", async () => {
    findUnique.mockResolvedValue({ id: "consent_1" });
    const token = signDraftToken("app_1");
    await expect(verifyConsentedDraft(token)).resolves.toBe("app_1");
  });

  it("geçerli token ama consent YOK → null (403)", async () => {
    findUnique.mockResolvedValue(null);
    const token = signDraftToken("app_2");
    await expect(verifyConsentedDraft(token)).resolves.toBeNull();
  });

  it("tamper edilmiş token → null, DB'ye HİÇ gitmez", async () => {
    const token = signDraftToken("app_3");
    const tampered = "app_HACK" + token.slice(token.lastIndexOf("."));
    await expect(verifyConsentedDraft(tampered)).resolves.toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("cookie yok → null, DB'ye gitmez", async () => {
    await expect(verifyConsentedDraft(undefined)).resolves.toBeNull();
    await expect(verifyConsentedDraft(null)).resolves.toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });
});
