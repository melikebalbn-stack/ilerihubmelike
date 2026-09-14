import { z } from "zod";
import type { Prisma } from "@/generated/prisma";

/**
 * Akademi admin agregasyon uçları için IFS/normal ayrımı.
 *
 * admin/courses ve admin/packages'taki `?type=` deseninin aynısı:
 *   normal (varsayılan) → IFS gizli · ifs → yalnız IFS · all → hepsi.
 *
 * Ortak tablolar (course_progress, user_course_assignments, exams, sertifika)
 * bölünmüyor; ayrım daima `courses.isIfs` ilişkisi üzerinden. Kurssuz sınav /
 * sertifika (courseId NULL) akademi sayılır — IFS kaydı kurssuz olamaz.
 *
 * YALNIZ liste/agregasyon uçları için. Tekil uçlara ([id], contents/[id]/
 * progress, ifs-complete) uygulanmaz: /ifs/odevler ekranı onları paylaşıyor.
 */
export const akademiTypeSchema = z
  .enum(["normal", "ifs", "all"])
  .default("normal");

export type AkademiType = z.infer<typeof akademiTypeSchema>;

/** Kurs tablosu doğrudan süzülürken. */
export function courseTypeWhere(type: AkademiType): Prisma.CourseWhereInput {
  return type === "all" ? {} : { isIfs: type === "ifs" };
}

/** `course` ilişkisi ZORUNLU olan modeller (CourseProgress, CourseAssignment). */
export function viaCourseWhere(type: AkademiType): { course?: Prisma.CourseWhereInput } {
  return type === "all" ? {} : { course: { isIfs: type === "ifs" } };
}

/**
 * `course` ilişkisi OPSİYONEL olan modeller (Exam, AkademiCertificate).
 * normal: kursu normal olan VEYA kurssuz · ifs: kursu IFS olan · all: süzgeç yok.
 */
export function viaOptionalCourseWhere(
  type: AkademiType
): { OR?: Array<{ course?: Prisma.CourseWhereInput; courseId?: null }> } {
  if (type === "all") return {};
  if (type === "ifs") return { OR: [{ course: { isIfs: true } }] };
  return { OR: [{ course: { isIfs: false } }, { courseId: null }] };
}
