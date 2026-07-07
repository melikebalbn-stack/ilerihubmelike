import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireUserMock = vi.fn();
vi.mock("@/lib/auth/require-user", () => ({ requireUser: () => requireUserMock() }));

const findUnique = vi.fn();
const logCreate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobApplicationConsent: { findUnique: (...a: unknown[]) => findUnique(...a) },
    jobApplicationAccessLog: { create: (...a: unknown[]) => logCreate(...a) },
  },
}));

import { GET } from "./route";

const ctx = (id = "app1") => ({ params: Promise.resolve({ id }) });
const req = (url = "http://localhost/api/job-application/app1/consent") => new NextRequest(url);
const CONSENT = {
  adSoyad: "Ali Veli",
  tcKimlikNo: "12345678901",
  documentCode: "IK-T-866",
  documentRev: "00",
  consentTextHash: "abc",
  signedAt: new Date("2026-07-07"),
  signatureImage: "data:image/png;base64,AAAA",
  ipAddress: "1.2.3.4",
};

beforeEach(() => {
  requireUserMock.mockReset();
  findUnique.mockReset();
  logCreate.mockReset();
});

describe("GET consent (rol-gate + mask + accessLog)", () => {
  it("yetkisiz rol → 403, DB'ye gitmez", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "u1", role: "EMPLOYEE" }, error: null });
    const res = await GET(req(), ctx());
    expect(res.status).toBe(403);
    expect(findUnique).not.toHaveBeenCalled();
    expect(logCreate).not.toHaveBeenCalled();
  });

  it("yetkili + kayıt yok (eski başvuru) → { consent: null }, log yok", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "u1", role: "HR_MANAGER" }, error: null });
    findUnique.mockResolvedValue(null);
    const res = await GET(req(), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ consent: null });
    expect(logCreate).not.toHaveBeenCalled();
  });

  it("yetkili + kayıt var → TC MASKELİ + accessLog VIEW_CONSENT", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" }, error: null });
    findUnique.mockResolvedValue(CONSENT);
    const res = await GET(req(), ctx());
    const body = await res.json();
    expect(body.consent.tcKimlikNo).toBe("123****901"); // maskeli
    expect(logCreate).toHaveBeenCalledTimes(1);
    expect(logCreate.mock.calls[0][0].data.accessType).toBe("VIEW_CONSENT");
  });

  it("unmask=true → TC AÇIK + accessLog UNMASK_CONSENT", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "u1", role: "SUPER_ADMIN" }, error: null });
    findUnique.mockResolvedValue(CONSENT);
    const res = await GET(req("http://localhost/api/job-application/app1/consent?unmask=true"), ctx());
    const body = await res.json();
    expect(body.consent.tcKimlikNo).toBe("12345678901"); // açık
    expect(logCreate.mock.calls[0][0].data.accessType).toBe("UNMASK_CONSENT");
  });
});
