import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAkademiAdmin } from "@/lib/akademi-admin-guard";
import { getLinkedBolums } from "@/lib/user-personnel";
import * as XLSX from "xlsx";

type ExportType =
  | "all"
  | "users"
  | "courses"
  | "exams"
  | "certificates"
  | "departments";

export async function GET(req: NextRequest) {
  const { error } = await requireAkademiAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const typeParam = (searchParams.get("type") ?? "all") as ExportType;

  const wb = XLSX.utils.book_new();

  if (typeParam === "all" || typeParam === "users") {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        personnel: { select: { bolum: true } },
        _count: { select: { akademiCertificates: true } },
      },
      orderBy: { name: "asc" },
    });
    const userIds = users.map((u) => u.id);
    const [progressRows, attemptRows] = await Promise.all([
      prisma.courseProgress.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, completedAt: true },
      }),
      prisma.userExamAttempt.findMany({
        where: { userId: { in: userIds }, status: "COMPLETED" },
        select: { userId: true, score: true, passed: true },
      }),
    ]);
    const pByU = new Map<string, { total: number; completed: number }>();
    for (const p of progressRows) {
      const c = pByU.get(p.userId) ?? { total: 0, completed: 0 };
      c.total += 1;
      if (p.completedAt) c.completed += 1;
      pByU.set(p.userId, c);
    }
    const aByU = new Map<
      string,
      { total: number; passed: number; sum: number }
    >();
    for (const a of attemptRows) {
      const c = aByU.get(a.userId) ?? { total: 0, passed: 0, sum: 0 };
      c.total += 1;
      if (a.passed) c.passed += 1;
      c.sum += a.score ?? 0;
      aByU.set(a.userId, c);
    }
    const rows = users.map((u) => {
      const p = pByU.get(u.id) ?? { total: 0, completed: 0 };
      const a = aByU.get(u.id) ?? { total: 0, passed: 0, sum: 0 };
      return {
        "Ad Soyad": u.name ?? u.email ?? "",
        "E-posta": u.email,
        Bölüm: u.personnel?.bolum ?? "",
        "Tamamlanan Kurs": p.completed,
        "Toplam Kurs": p.total,
        "Geçilen Sınav": a.passed,
        "Toplam Deneme": a.total,
        "Ort. Puan": a.total > 0 ? Math.round(a.sum / a.total) : 0,
        Sertifika: u._count.akademiCertificates,
      };
    });
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rows),
      "Kullanıcılar"
    );
  }

  if (typeParam === "all" || typeParam === "courses") {
    const courses = await prisma.course.findMany({
      include: {
        progress: { select: { completedAt: true } },
        _count: {
          select: { contents: true, exams: true, certificates: true },
        },
      },
    });
    const rows = courses.map((c) => ({
      Kurs: c.title,
      Aktif: c.isActive ? "Evet" : "Hayır",
      İçerik: c._count.contents,
      Sınav: c._count.exams,
      Kayıtlı: c.progress.length,
      Tamamlayan: c.progress.filter((p) => p.completedAt).length,
      Sertifika: c._count.certificates,
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rows),
      "Kurslar"
    );
  }

  if (typeParam === "all" || typeParam === "exams") {
    const exams = await prisma.exam.findMany({
      include: {
        attempts: { select: { status: true, passed: true, score: true } },
        course: { select: { title: true } },
      },
    });
    const rows = exams.map((e) => {
      const completed = e.attempts.filter((a) => a.status === "COMPLETED");
      const passed = completed.filter((a) => a.passed).length;
      return {
        Sınav: e.title,
        Kurs: e.course?.title ?? "",
        Aktif: e.isActive ? "Evet" : "Hayır",
        "Geçme Barajı": e.passingScore,
        "Toplam Deneme": e.attempts.length,
        Tamamlanan: completed.length,
        Geçen: passed,
        "Geçme Oranı %":
          completed.length > 0
            ? Math.round((passed / completed.length) * 100)
            : 0,
        "Ort. Puan":
          completed.length > 0
            ? Math.round(
                completed.reduce((s, a) => s + (a.score ?? 0), 0) /
                  completed.length
              )
            : 0,
      };
    });
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rows),
      "Sınavlar"
    );
  }

  if (typeParam === "all" || typeParam === "certificates") {
    const certs = await prisma.akademiCertificate.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
            personnel: { select: { bolum: true } },
          },
        },
        course: { select: { title: true } },
        _count: { select: { downloads: true, verifications: true } },
      },
      orderBy: { issuedAt: "desc" },
    });
    const rows = certs.map((c) => ({
      "Sertifika No": c.certificateNo,
      Kullanıcı: c.user.name ?? c.user.email ?? "",
      "E-posta": c.user.email,
      Bölüm: c.user.personnel?.bolum ?? "",
      Kurs: c.course?.title ?? "",
      Veriliş: new Date(c.issuedAt).toLocaleDateString("tr-TR"),
      Geçerlilik: c.validUntil
        ? new Date(c.validUntil).toLocaleDateString("tr-TR")
        : "Sınırsız",
      İndirme: c._count.downloads,
      Doğrulama: c._count.verifications,
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rows),
      "Sertifikalar"
    );
  }

  if (typeParam === "all" || typeParam === "departments") {
    const bolums = await getLinkedBolums();
    const rows = await Promise.all(
      bolums.map(async (bolum) => {
        const users = await prisma.user.findMany({
          where: { personnel: { bolum } },
          select: { id: true },
        });
        const userIds = users.map((u) => u.id);
        if (userIds.length === 0) {
          return {
            Bölüm: bolum,
            Kullanıcı: 0,
            "Tamamlanan Kurs": 0,
            "Geçen Sınav": 0,
            Sertifika: 0,
          };
        }
        const [completed, passed, certs] = await Promise.all([
          prisma.courseProgress.count({
            where: { userId: { in: userIds }, completedAt: { not: null } },
          }),
          prisma.userExamAttempt.count({
            where: {
              userId: { in: userIds },
              status: "COMPLETED",
              passed: true,
            },
          }),
          prisma.akademiCertificate.count({
            where: { userId: { in: userIds } },
          }),
        ]);
        return {
          Bölüm: bolum,
          Kullanıcı: userIds.length,
          "Tamamlanan Kurs": completed,
          "Geçen Sınav": passed,
          Sertifika: certs,
        };
      })
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rows),
      "Bölümler"
    );
  }

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const dateStr = new Date().toISOString().split("T")[0];
  const fileName = `akademi-rapor-${typeParam}-${dateStr}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
