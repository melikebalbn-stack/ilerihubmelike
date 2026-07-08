import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireUserMock = vi.fn();
vi.mock("@/lib/auth/require-user", () => ({ requireUser: () => requireUserMock() }));

const findUnique = vi.fn();
const logCreate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobApplicationHealth: { findUnique: (...a: unknown[]) => findUnique(...a) },
    jobApplicationAccessLog: { create: (...a: unknown[]) => logCreate(...a) },
  },
}));

import { GET } from "./route";

const ctx = (id = "app1") => ({ params: Promise.resolve({ id }) });
const req = () => new NextRequest("http://localhost/api/job-application/app1/health");

function healthRecord() {
  return {
    ameliyatOlduMu: true, ameliyatNotu: "Fıtık",
    gecmisHastalikNotu: null,
    astimSoru1: true, astimSoru1_1: true, astimSoru1_2: false,
    astimSoru2: false, astimSoru3: false, astimSoru4: false,
    astimSoru5: false, astimSoru6: false, astimSoru7: false,
    dogumTarihi: null, testTarihi: new Date(), cinsiyet: "BAY",
    telefonGunduz: "0555", telefonGece: null,
    items: Array.from({ length: 26 }, (_, i) => ({
      itemNo: i + 1, itemLabel: `M${i + 1}`, deger: i + 1 === 4 || i + 1 === 26,
    })),
  };
}

beforeEach(() => {
  requireUserMock.mockReset();
  findUnique.mockReset();
  logCreate.mockReset();
});

describe("GET health (rol-gate + accessLog + summary)", () => {
  it("yetkisiz → 403, DB'ye gitmez", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "u1", role: "EMPLOYEE" }, error: null });
    const res = await GET(req(), ctx());
    expect(res.status).toBe(403);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("yetkili + kayıt yok → { health: null }, log yok", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "u1", role: "HR_MANAGER" }, error: null });
    findUnique.mockResolvedValue(null);
    const res = await GET(req(), ctx());
    expect(await res.json()).toEqual({ health: null });
    expect(logCreate).not.toHaveBeenCalled();
  });

  it("yetkili + kayıt var → summary + accessLog VIEW_HEALTH", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" }, error: null });
    findUnique.mockResolvedValue(healthRecord());
    const res = await GET(req(), ctx());
    const body = await res.json();
    expect(body.summary.varItems.map((v: { itemNo: number }) => v.itemNo)).toEqual([4]);
    expect(body.summary.ameliyat).toEqual({ oldu: true, not: "Fıtık" });
    expect(body.summary.astimEvetler.map((a: { no: string }) => a.no)).toContain("1.1");
    expect(logCreate.mock.calls[0][0].data.accessType).toBe("VIEW_HEALTH");
  });
});
