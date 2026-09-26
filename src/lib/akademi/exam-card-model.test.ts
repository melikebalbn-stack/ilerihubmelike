// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildExamCardModel, type ExamCardInput } from "./exam-card-model";

const base: ExamCardInput = {
  id: "e1",
  title: "Rekabet Hukuku Sınavı",
  passingScore: 70,
  timeLimit: 30,
  maxAttempts: 3,
  questionCount: 15,
  course: { id: "c1", title: "Rekabet Hukuku" },
  userStatus: {
    canStart: true,
    passed: false,
    passedScore: null,
    hasInProgress: false,
    inProgressAttemptId: null,
    usedAttempts: 0,
    remainingAttempts: 3,
    lastResult: null,
  },
};

describe("buildExamCardModel — durum → SplitBadge", () => {
  it("hiç girilmemiş → kırmızı Bekliyor|Sınava Başla", () => {
    const m = buildExamCardModel(base);
    expect(m.badge.color).toBe("red");
    expect(m.badge.left).toBe("Bekliyor");
    expect(m.badge.right).toBe("Sınava Başla");
    expect(m.badge.href).toBe("/akademi/exams/e1");
    expect(m.tag).toEqual({ label: "Bekliyor", color: "amber" });
  });

  it("geçti → yeşil Geçti|Sonucu Gör (→ result)", () => {
    const m = buildExamCardModel({
      ...base,
      userStatus: {
        ...base.userStatus,
        canStart: false,
        passed: true,
        passedScore: 88,
        usedAttempts: 1,
        remainingAttempts: 2,
        lastResult: { attemptId: "a1", score: 88, passed: true, status: "COMPLETED", completedAt: null },
      },
    });
    expect(m.badge.color).toBe("green");
    expect(m.badge.left).toBe("Geçti");
    expect(m.badge.right).toBe("Sonucu Gör");
    expect(m.badge.href).toBe("/akademi/exams/e1/result/a1");
    expect(m.tag).toEqual({ label: "Geçti", color: "green" });
  });

  it("kaldı + hak var → mavi %NN|Tekrar Dene, etiket Kaldı", () => {
    const m = buildExamCardModel({
      ...base,
      userStatus: {
        ...base.userStatus,
        canStart: true,
        passed: false,
        usedAttempts: 1,
        remainingAttempts: 2,
        lastResult: { attemptId: "a2", score: 55, passed: false, status: "COMPLETED", completedAt: null },
      },
    });
    expect(m.badge.color).toBe("blue");
    expect(m.badge.left).toBe("%55");
    expect(m.badge.right).toBe("Tekrar Dene");
    expect(m.tag).toEqual({ label: "Kaldı", color: "red" });
    expect(m.lastScore).toEqual({ label: "Son: %55", passed: false });
  });

  it("kaldı + hak bitti → gri Hak bitti|Sonucu Gör", () => {
    const m = buildExamCardModel({
      ...base,
      userStatus: {
        ...base.userStatus,
        canStart: false,
        passed: false,
        usedAttempts: 3,
        remainingAttempts: 0,
        lastResult: { attemptId: "a3", score: 40, passed: false, status: "COMPLETED", completedAt: null },
      },
    });
    expect(m.badge.color).toBe("gray");
    expect(m.badge.left).toBe("Hak bitti");
    expect(m.badge.right).toBe("Sonucu Gör");
    expect(m.badge.href).toBe("/akademi/exams/e1/result/a3");
    expect(m.tag).toEqual({ label: "Süresi doldu", color: "gray" });
  });

  it("devam eden → amber Devam Et (→ take)", () => {
    const m = buildExamCardModel({
      ...base,
      userStatus: { ...base.userStatus, canStart: false, hasInProgress: true, inProgressAttemptId: "ip1" },
    });
    expect(m.badge.color).toBe("amber");
    expect(m.badge.right).toBe("Devam Et");
    expect(m.badge.href).toBe("/akademi/exams/e1/take");
  });

  it("meta + kapak rozeti gerçek sayılardan", () => {
    const m = buildExamCardModel(base);
    expect(m.metaLine).toBe("Rekabet Hukuku · Geçme %70 · Deneme 0/3");
    expect(m.durationBadge).toBe("15 soru · 30 dk");
  });
});
