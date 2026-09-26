// @vitest-environment node
import { describe, it, expect } from "vitest";
import { coursesKpi, examsKpi } from "./page-kpi";
import { buildExamCardModel, type ExamCardInput } from "./exam-card-model";
import { buildCertificateCardModel } from "./certificate-card-model";
import type { CourseListItem } from "@/types/akademi";

const course = (o: Partial<CourseListItem>): CourseListItem => ({
  id: "c",
  title: "t",
  description: null,
  thumbnail: null,
  category: null,
  difficulty: "BEGINNER",
  duration: null,
  contentCount: 0,
  progressPercent: 0,
  isCompleted: false,
  isAssigned: true,
  ...o,
});

describe("coursesKpi", () => {
  it("toplam / devam / tamamlanan / zorunlu-bekleyen", () => {
    const list = [
      course({ id: "1", isCompleted: true, category: "Zorunlu" }),
      course({ id: "2", progressPercent: 40, category: "Zorunlu" }), // devam + zorunlu bekleyen
      course({ id: "3", progressPercent: 0, category: "Genel" }),
      course({ id: "4", progressPercent: 0, category: "Zorunlu" }), // zorunlu bekleyen
    ];
    expect(coursesKpi(list)).toEqual({
      total: 4,
      inProgress: 1,
      completed: 1,
      zorunluPending: 2,
    });
  });
});

const examBase: ExamCardInput = {
  id: "e",
  title: "t",
  passingScore: 70,
  timeLimit: 30,
  maxAttempts: 3,
  questionCount: 10,
  course: { id: "c", title: "Kurs" },
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
const withStatus = (s: Partial<ExamCardInput["userStatus"]>): ExamCardInput => ({
  ...examBase,
  userStatus: { ...examBase.userStatus, ...s },
});

describe("examsKpi", () => {
  it("bekleyen / geçilen / kalan / ortalama puan", () => {
    const list = [
      withStatus({ passed: true, canStart: false, lastResult: { attemptId: "a", score: 90, passed: true, status: "COMPLETED", completedAt: null } }),
      withStatus({ passed: false, lastResult: { attemptId: "b", score: 50, passed: false, status: "COMPLETED", completedAt: null } }),
      withStatus({}), // hiç girilmemiş → bekleyen
    ];
    expect(examsKpi(list)).toEqual({ pending: 1, passed: 1, failed: 1, avgScore: 70 });
  });

  it("tamamlanmış deneme yoksa ortalama 0", () => {
    expect(examsKpi([withStatus({})]).avgScore).toBe(0);
  });
});

describe("thumbnail fallback (exam kapağı)", () => {
  it("thumbnail varsa coverImage set, yoksa null", () => {
    const withThumb = buildExamCardModel({
      ...examBase,
      course: { id: "c", title: "Kurs", thumbnail: "/x.jpg" },
    });
    expect(withThumb.coverImage).toBe("/x.jpg");
    expect(buildExamCardModel(examBase).coverImage).toBeNull();
  });
});

describe("buildCertificateCardModel — durum", () => {
  const NOW = new Date("2026-10-01T00:00:00Z");
  const base = {
    id: "cert1",
    certificateNo: "CERT-2026-000123",
    verificationCode: "VER-1",
    issuedAt: "2026-09-19T10:00:00Z",
    validUntil: null as string | null,
    course: { id: "c", title: "Rekabet Hukuku", thumbnail: "/t.jpg" },
  };

  it("geçerli → yeşil Geçerli|PDF İndir", () => {
    const m = buildCertificateCardModel(base, NOW);
    expect(m.badge.color).toBe("green");
    expect(m.badge.left).toBe("Geçerli");
    expect(m.badge.right).toBe("PDF İndir");
    expect(m.badge.href).toBe("/api/akademi/certificates/cert1/download");
    expect(m.coverImage).toBe("/t.jpg");
    expect(m.href).toBe("/akademi/verify/VER-1");
  });

  it("süresi dolmuş → gri Süresi doldu|PDF İndir", () => {
    const m = buildCertificateCardModel({ ...base, validUntil: "2026-08-01T00:00:00Z" }, NOW);
    expect(m.badge.color).toBe("gray");
    expect(m.badge.left).toBe("Süresi doldu");
    expect(m.validity?.expired).toBe(true);
  });

  it("thumbnail yoksa coverImage null (degrade)", () => {
    const m = buildCertificateCardModel({ ...base, course: { id: "c", title: "K" } }, NOW);
    expect(m.coverImage).toBeNull();
  });
});
