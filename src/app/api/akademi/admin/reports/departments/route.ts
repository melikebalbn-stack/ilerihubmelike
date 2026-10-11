import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  parseAkademiType,
  viaCourseWhere,
  viaOptionalCourseWhere,
} from "@/lib/akademi/admin-type-filter";
import { AKTIF_PERSONEL, getLinkedBolums } from "@/lib/user-personnel";
import { bosYakaSayaci, yakaGrubu } from "@/lib/akademi/yaka-gruplari";

export async function GET(req: NextRequest) {
  const { error } = await requirePermission('akademi.report.view');
  if (error) return error;

  // type=normal (default) → IFS gizli; ifs → yalnız IFS; all → hepsi.
  // Bölüm/kullanıcı listesi süzülmez; kurs tamamlama, deneme, sertifika sayaçları süzülür.
  const { type, error: typeError } = parseAkademiType(req.nextUrl.searchParams);
  if (typeError) return typeError;
  const progressW = viaCourseWhere(type);
  const examW = viaOptionalCourseWhere(type);
  const certW = viaOptionalCourseWhere(type);

  const bolums = await getLinkedBolums();

  const result = await Promise.all(
    bolums.map(async (bolum) => {
      const users = await prisma.user.findMany({
        where: { personnel: { bolum, ...AKTIF_PERSONEL } },
        select: {
          id: true,
          personnel: { select: { yakaRengi: true, yakaDetayi: true } },
        },
      });
      const userIds = users.map((u) => u.id);

      // Yaka kırılımı (Melih, 11.10.2026): yönetici / beyaz / gri / mavi.
      // Dördünün toplamı userCount'a eşittir.
      const yakalar = bosYakaSayaci();
      for (const u of users) {
        if (!u.personnel) continue;
        yakalar[
          yakaGrubu({
            yakaRengi: u.personnel.yakaRengi,
            yakaDetayi: u.personnel.yakaDetayi,
          })
        ]++;
      }

      if (userIds.length === 0) {
        return {
          bolum,
          userCount: 0,
          yakalar,
          completedCourses: 0,
          totalAttempts: 0,
          passedAttempts: 0,
          passRate: 0,
          certificateCount: 0,
        };
      }

      const [completedCourses, attempts, passedAttempts, certs] =
        await Promise.all([
          prisma.courseProgress.count({
            where: { ...progressW, userId: { in: userIds }, completedAt: { not: null } },
          }),
          prisma.userExamAttempt.count({
            where: { exam: examW, userId: { in: userIds }, status: "COMPLETED" },
          }),
          prisma.userExamAttempt.count({
            where: {
              exam: examW,
              userId: { in: userIds },
              status: "COMPLETED",
              passed: true,
            },
          }),
          prisma.akademiCertificate.count({
            where: { ...certW, userId: { in: userIds } },
          }),
        ]);

      return {
        bolum,
        userCount: userIds.length,
        yakalar,
        completedCourses,
        totalAttempts: attempts,
        passedAttempts,
        passRate:
          attempts > 0 ? Math.round((passedAttempts / attempts) * 100) : 0,
        certificateCount: certs,
      };
    })
  );

  result.sort((a, b) => b.userCount - a.userCount);
  return NextResponse.json({ departments: result });
}
