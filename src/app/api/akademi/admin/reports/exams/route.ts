import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";
import { parseAkademiType, viaOptionalCourseWhere } from "@/lib/akademi/admin-type-filter";
import { isAutoScored } from "@/lib/akademi/question-types";
import { scoreQuestion } from "@/lib/akademi/scoring";
import { puanDagilimi, sinavKpiHesapla } from "@/lib/akademi/sinav-kpi";

export async function GET(req: NextRequest) {
  const { error } = await requirePermission('akademi.report.view');
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const examId = searchParams.get("examId");

  // examId verilmişse tekil rapor — type süzgeci uygulanmaz.
  if (examId) {
    return getSingleExamReport(examId);
  }
  // type=normal (default) → IFS gizli; ifs → yalnız IFS; all → hepsi.
  const { type, error: typeError } = parseAkademiType(searchParams);
  if (typeError) return typeError;

  const exams = await prisma.exam.findMany({
    where: viaOptionalCourseWhere(type),
    select: {
      id: true,
      title: true,
      isActive: true,
      passingScore: true,
      timeLimit: true,
      maxAttempts: true,
      course: { select: { id: true, title: true } },
      _count: { select: { questions: true } },
      attempts: {
        select: {
          userId: true,
          status: true,
          score: true,
          passed: true,
          completedAt: true,
          startedAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Kişi bazlı "atanan" sayısı: sınavın kursuna atanmış kullanıcılar.
  // Kurssuz sınavda atama kavramı yok → yalnız denemeye girenler sayılır.
  // Tek sorgu (N+1 yok): tüm kurslar için atamalar birlikte çekilir.
  const kursIdleri = Array.from(
    new Set(exams.map((e) => e.course?.id).filter((x): x is string => !!x))
  );
  const atamaSatirlari = kursIdleri.length
    ? await prisma.userCourseAssignment.findMany({
        where: { assignment: { courseId: { in: kursIdleri } } },
        select: { userId: true, assignment: { select: { courseId: true } } },
      })
    : [];
  const kursAtananlari = new Map<string, Set<string>>();
  for (const satir of atamaSatirlari) {
    const kursId = satir.assignment.courseId;
    const kume = kursAtananlari.get(kursId);
    if (kume) kume.add(satir.userId);
    else kursAtananlari.set(kursId, new Set([satir.userId]));
  }

  const result = exams.map((e) => {
    const completed = e.attempts.filter((a) => a.status === "COMPLETED");
    const pending = e.attempts.filter(
      (a) => a.status === "PENDING_REVIEW"
    ).length;
    const passed = completed.filter((a) => a.passed).length;
    const passRate =
      completed.length > 0 ? Math.round((passed / completed.length) * 100) : 0;
    const avgScore =
      completed.length > 0
        ? Math.round(
            completed.reduce((s, a) => s + (a.score ?? 0), 0) / completed.length
          )
        : 0;

    const durations = completed
      .filter((a) => a.completedAt && a.startedAt)
      .map(
        (a) =>
          (new Date(a.completedAt!).getTime() -
            new Date(a.startedAt).getTime()) /
          60000
      );
    const avgDuration =
      durations.length > 0
        ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
        : 0;

    const atananlar = e.course
      ? Array.from(kursAtananlari.get(e.course.id) ?? [])
      : [];
    const kpi = sinavKpiHesapla(atananlar, e.attempts);

    return {
      id: e.id,
      title: e.title,
      isActive: e.isActive,
      passingScore: e.passingScore,
      timeLimit: e.timeLimit,
      maxAttempts: e.maxAttempts,
      course: e.course,
      questionCount: e._count.questions,
      totalAttempts: e.attempts.length,
      completedAttempts: completed.length,
      pendingReview: pending,
      passed,
      passRate,
      avgScore,
      avgDurationMinutes: avgDuration,
      // Kişi bazlı durum (Melih, 11.10.2026): deneme sayısı değil, kaç kişiye
      // atandı / kaçı geçti / kaldı / hiç girmedi.
      atanan: kpi.atanan,
      gectiKisi: kpi.gecti,
      kaldiKisi: kpi.kaldi,
      devamKisi: kpi.devam,
      baslamadiKisi: kpi.baslamadi,
      kapsamKisi: kpi.kapsam,
      basariOrani: kpi.basariOrani,
    };
  });

  return NextResponse.json({ exams: result });
}

async function getSingleExamReport(examId: string) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      course: { select: { id: true, title: true } },
      attempts: {
        select: { userId: true, status: true, score: true, passed: true },
      },
      questions: {
        orderBy: { order: "asc" },
        include: {
          options: true,
          answers: {
            where: { attempt: { status: "COMPLETED" } },
            select: { optionId: true, selectedOptionIds: true },
          },
        },
      },
    },
  });

  if (!exam) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const questionStats = exam.questions.map((q) => {
    const totalAnswers = q.answers.length;
    let correctCount = 0;

    if (isAutoScored(q.type) && totalAnswers > 0) {
      for (const a of q.answers) {
        const ans = {
          questionId: q.id,
          selectedOptionIds: a.optionId
            ? [a.optionId]
            : a.selectedOptionIds.length > 0
            ? a.selectedOptionIds
            : [],
        };
        const r = scoreQuestion(
          {
            id: q.id,
            type: q.type,
            points: q.points,
            options: q.options.map((o) => ({
              id: o.id,
              isCorrect: o.isCorrect,
            })),
          },
          ans
        );
        if (r.isCorrect) correctCount++;
      }
    }

    const correctRate =
      totalAnswers > 0 && isAutoScored(q.type)
        ? Math.round((correctCount / totalAnswers) * 100)
        : null;

    let difficulty: "easy" | "medium" | "hard" | "manual";
    if (correctRate === null) difficulty = "manual";
    else if (correctRate >= 80) difficulty = "easy";
    else if (correctRate >= 50) difficulty = "medium";
    else difficulty = "hard";

    return {
      id: q.id,
      order: q.order,
      question: q.question,
      type: q.type,
      points: q.points,
      isManualGraded: q.isManualGraded,
      totalAnswers,
      correctCount: isAutoScored(q.type) ? correctCount : null,
      correctRate,
      difficulty,
    };
  });

  // Grafik verisi: kişi durum dağılımı + puan histogramı.
  const atananlar = exam.course
    ? (
        await prisma.userCourseAssignment.findMany({
          where: { assignment: { courseId: exam.course.id } },
          select: { userId: true },
        })
      ).map((a) => a.userId)
    : [];
  const kpi = sinavKpiHesapla(atananlar, exam.attempts);

  return NextResponse.json({
    exam: { id: exam.id, title: exam.title, course: exam.course },
    kpi,
    durumDagilimi: [
      { durum: "Geçti", adet: kpi.gecti },
      { durum: "Kaldı", adet: kpi.kaldi },
      { durum: "Devam", adet: kpi.devam },
      { durum: "Başlamadı", adet: kpi.baslamadi },
    ],
    puanDagilimi: puanDagilimi(exam.attempts),
    questions: questionStats,
  });
}
