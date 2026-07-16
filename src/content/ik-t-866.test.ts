import { describe, it, expect } from "vitest";
import { IK_T_866, ikT866Version, ikT866FullText } from "./ik-t-866";

describe("IK-T-866 içerik", () => {
  it("versiyon = kod-rev", () => {
    expect(ikT866Version()).toBe("IK-T-866-00");
    expect(IK_T_866.documentRev).toBe("00");
  });

  it("iki bölüm de dolu (aydınlatma + muvafakatname)", () => {
    expect(IK_T_866.aydinlatma.metin.length).toBeGreaterThan(200);
    expect(IK_T_866.muvafakatname.metin.length).toBeGreaterThan(200);
  });

  it("hash kaynağı (ikT866FullText) HER İKİ bölümü kapsar", () => {
    const full = ikT866FullText();
    expect(full).toContain(IK_T_866.aydinlatma.metin);
    expect(full).toContain(IK_T_866.muvafakatname.metin);
    // Muvafakatnameye özgü ibare hash kapsamında olmalı (tamper-evidence).
    expect(full).toContain("muvafakat ediyorum, izin veriyorum");
  });
});
