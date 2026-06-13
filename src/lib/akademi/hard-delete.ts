import type { Prisma } from "@/generated/prisma";

// Akademi kurs/içerik HARD-DELETE — bağımlıları doğru sırada (yapraklar önce)
// transaction içinde siler. onDelete=Cascade olanlar bile, Restrict olan
// kardeşleri (ör. ContentProgress) DB cascade'ini bloke ettiği için manuel
// silinir; Cascade olanlar da explicit silinir (sıra-bağımsız, idempotent).
//
// Course onDelete haritası:
//   Content(Cascade) → ContentProgress(Restrict!), IfsTaskMeta(Cascade), IfsTaskEvaluation(Cascade)
//   PackageCourse(Cascade), IfsCourseEvaluation(Cascade)
//   CourseAssignment(Restrict) → UserCourseAssignment(Restrict)
//   CourseProgress(Restrict), AkademiCertificate(Restrict), Exam(Restrict)
//   Exam → ExamQuestion(Cascade), UserExamAttempt(Restrict) → UserExamAnswer(Cascade)

type Tx = Prisma.TransactionClient;

export interface CourseDeleteCounts {
  contents: number;
  contentProgress: number;
  ifsTaskEvaluations: number;
  assignments: number;
  userAssignments: number;
  courseProgress: number;
  certificates: number;
  ifsCourseEvaluations: number;
  packageCourses: number;
  exams: number;
  examAttempts: number;
}

/** Verilen içeriklerin tüm bağımlılarını + içerikleri siler. */
export async function hardDeleteContents(
  tx: Tx,
  contentIds: string[]
): Promise<{ contentProgress: number; ifsTaskEvaluations: number; contents: number }> {
  if (contentIds.length === 0)
    return { contentProgress: 0, ifsTaskEvaluations: 0, contents: 0 };

  const cp = await tx.contentProgress.deleteMany({
    where: { contentId: { in: contentIds } },
  });
  const ite = await tx.ifsTaskEvaluation.deleteMany({
    where: { contentId: { in: contentIds } },
  });
  await tx.ifsTaskMeta.deleteMany({ where: { contentId: { in: contentIds } } });
  const c = await tx.content.deleteMany({ where: { id: { in: contentIds } } });

  return {
    contentProgress: cp.count,
    ifsTaskEvaluations: ite.count,
    contents: c.count,
  };
}

export async function hardDeleteContent(tx: Tx, contentId: string) {
  return hardDeleteContents(tx, [contentId]);
}

/** Bir kursu ve TÜM bağımlılarını siler. Çağıran $transaction sağlamalı. */
export async function hardDeleteCourse(
  tx: Tx,
  courseId: string
): Promise<CourseDeleteCounts> {
  // 1) İçerik + içerik bağımlıları (ContentProgress/IfsTaskEvaluation/IfsTaskMeta)
  const contents = await tx.content.findMany({
    where: { courseId },
    select: { id: true },
  });
  const cRes = await hardDeleteContents(
    tx,
    contents.map((c) => c.id)
  );

  // 2) Exam zinciri (kursa ait sınavlar)
  const exams = await tx.exam.findMany({
    where: { courseId },
    select: { id: true },
  });
  const examIds = exams.map((e) => e.id);
  let examAttempts = 0;
  if (examIds.length) {
    // UserExamAttempt (exam Restrict) → UserExamAnswer Cascade ile gider
    const att = await tx.userExamAttempt.deleteMany({
      where: { examId: { in: examIds } },
    });
    examAttempts = att.count;
    await tx.examQuestion.deleteMany({ where: { examId: { in: examIds } } });
    await tx.exam.deleteMany({ where: { id: { in: examIds } } });
  }

  // 3) CourseAssignment zinciri
  const assigns = await tx.courseAssignment.findMany({
    where: { courseId },
    select: { id: true },
  });
  const assignIds = assigns.map((a) => a.id);
  let userAssignments = 0;
  if (assignIds.length) {
    const ua = await tx.userCourseAssignment.deleteMany({
      where: { assignmentId: { in: assignIds } },
    });
    userAssignments = ua.count;
    await tx.courseAssignment.deleteMany({ where: { id: { in: assignIds } } });
  }

  // 4) Doğrudan bağlılar
  const cp = await tx.courseProgress.deleteMany({ where: { courseId } });
  const cert = await tx.akademiCertificate.deleteMany({ where: { courseId } });
  const ice = await tx.ifsCourseEvaluation.deleteMany({ where: { courseId } });
  const pc = await tx.packageCourse.deleteMany({ where: { courseId } });

  // 5) Kurs
  await tx.course.delete({ where: { id: courseId } });

  return {
    contents: cRes.contents,
    contentProgress: cRes.contentProgress,
    ifsTaskEvaluations: cRes.ifsTaskEvaluations,
    assignments: assignIds.length,
    userAssignments,
    courseProgress: cp.count,
    certificates: cert.count,
    ifsCourseEvaluations: ice.count,
    packageCourses: pc.count,
    exams: examIds.length,
    examAttempts,
  };
}
