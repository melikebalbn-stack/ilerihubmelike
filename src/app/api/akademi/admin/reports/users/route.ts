import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  parseAkademiType,
  reportUserBaseWhere,
  userHasAkademiTraceWhere,
  viaCourseWhere,
  viaOptionalCourseWhere,
} from "@/lib/akademi/admin-type-filter";
import type { Prisma } from "@/generated/prisma";
import {
  parseYakaGrubu,
  yakaGrubu,
  yakaGrubuWhere,
} from "@/lib/akademi/yaka-gruplari";

export async function GET(req: NextRequest) {
  const { error } = await requirePermission('akademi.report.view');
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const bolum = searchParams.get("bolum")?.trim();
  // type=normal (default) → IFS gizli; ifs → yalnız IFS; all → hepsi.
  const { type, error: typeError } = parseAkademiType(searchParams);
  if (typeError) return typeError;
  // onlyAssigned=1 → yalnız (type kapsamında) atama/ilerleme/deneme izi olanlar.
  const onlyAssigned = searchParams.get("onlyAssigned") === "1";

  // Taban: aktif hesap, KIOSK rolü hariç (bluecollar kalır). Arama OR'u ve
  // "iz var" OR'u çakışmasın diye AND dizisinde birleşir.
  const and: Prisma.UserWhereInput[] = [reportUserBaseWhere];
  if (search) {
    and.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    });
  }
  if (bolum) and.push({ personnel: { bolum, aktif: true } });
  // Yaka süzgeci: Yönetici / Beyaz / Gri / Mavi (bkz. lib/akademi/yaka-gruplari).
  const yaka = parseYakaGrubu(searchParams.get("yaka"));
  if (yaka) and.push({ personnel: { is: yakaGrubuWhere(yaka) } });
  if (onlyAssigned) and.push(userHasAkademiTraceWhere(type));
  const where: Prisma.UserWhereInput = { AND: and };

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      personnel: {
        select: { bolum: true, yakaRengi: true, yakaDetayi: true },
      },
      _count: {
        select: {
          akademiCertificates: true,
        },
      },
    },
    take: 500,
    orderBy: { name: "asc" },
  });

  // İlerleme + sınav verileri ayrı queries ile (relation'lar büyük olabilir)
  const userIds = users.map((u) => u.id);

  if (userIds.length === 0) {
    return NextResponse.json({ users: [] });
  }

  const [progressRows, attemptRows, atamaRows] = await Promise.all([
    prisma.courseProgress.findMany({
      where: { ...viaCourseWhere(type), userId: { in: userIds } },
      select: { userId: true, percentage: true, completedAt: true },
    }),
    prisma.userExamAttempt.findMany({
      where: {
        exam: viaOptionalCourseWhere(type),
        userId: { in: userIds },
        status: "COMPLETED",
      },
      select: { userId: true, examId: true, score: true, passed: true },
    }),
    // Atanan kurslar + o kursların sınavları. "Kaç sınav atandı / kaçını
    // yapmadı" bu listeden çıkar; deneme kaydı olmayan sınav da sayılır.
    prisma.userCourseAssignment.findMany({
      where: { userId: { in: userIds }, assignment: viaCourseWhere(type) },
      select: {
        userId: true,
        assignment: {
          select: {
            courseId: true,
            course: {
              select: { exams: { where: { isActive: true }, select: { id: true } } },
            },
          },
        },
      },
    }),
  ]);

  // Kişi → atanan kurs id'leri ve atanan sınav id'leri (tekil).
  const atananKurslar = new Map<string, Set<string>>();
  const atananSinavlar = new Map<string, Set<string>>();
  for (const a of atamaRows) {
    const kurslar = atananKurslar.get(a.userId) ?? new Set<string>();
    kurslar.add(a.assignment.courseId);
    atananKurslar.set(a.userId, kurslar);

    const sinavlar = atananSinavlar.get(a.userId) ?? new Set<string>();
    for (const e of a.assignment.course?.exams ?? []) sinavlar.add(e.id);
    atananSinavlar.set(a.userId, sinavlar);
  }

  // Kişi → geçtiği sınav id'leri (bir sınavda birden çok deneme tek sayılır).
  const gecilenSinavlar = new Map<string, Set<string>>();
  const girilenSinavlar = new Map<string, Set<string>>();
  for (const a of attemptRows) {
    const girilen = girilenSinavlar.get(a.userId) ?? new Set<string>();
    girilen.add(a.examId);
    girilenSinavlar.set(a.userId, girilen);
    if (a.passed) {
      const gecilen = gecilenSinavlar.get(a.userId) ?? new Set<string>();
      gecilen.add(a.examId);
      gecilenSinavlar.set(a.userId, gecilen);
    }
  }

  const progressByUser = new Map<
    string,
    { total: number; completed: number }
  >();
  for (const p of progressRows) {
    const cur = progressByUser.get(p.userId) ?? { total: 0, completed: 0 };
    cur.total += 1;
    if (p.completedAt) cur.completed += 1;
    progressByUser.set(p.userId, cur);
  }

  const attemptsByUser = new Map<
    string,
    { total: number; passed: number; scoreSum: number }
  >();
  for (const a of attemptRows) {
    const cur =
      attemptsByUser.get(a.userId) ?? { total: 0, passed: 0, scoreSum: 0 };
    cur.total += 1;
    if (a.passed) cur.passed += 1;
    cur.scoreSum += a.score ?? 0;
    attemptsByUser.set(a.userId, cur);
  }

  const result = users.map((u) => {
    const p = progressByUser.get(u.id) ?? { total: 0, completed: 0 };
    const a = attemptsByUser.get(u.id) ?? { total: 0, passed: 0, scoreSum: 0 };
    const avgScore = a.total > 0 ? Math.round(a.scoreSum / a.total) : 0;
    const atananKursSayisi = atananKurslar.get(u.id)?.size ?? 0;
    const atananSinavKumesi = atananSinavlar.get(u.id) ?? new Set<string>();
    const gecilen = gecilenSinavlar.get(u.id) ?? new Set<string>();
    const girilen = girilenSinavlar.get(u.id) ?? new Set<string>();
    // Atanan sınavlar içinde: geçtiği / kalmış (girdi ama geçemedi) / hiç girmediği.
    let gectigiSinav = 0;
    let kaldigiSinav = 0;
    let girmedigiSinav = 0;
    for (const sinavId of atananSinavKumesi) {
      if (gecilen.has(sinavId)) gectigiSinav++;
      else if (girilen.has(sinavId)) kaldigiSinav++;
      else girmedigiSinav++;
    }

    return {
      id: u.id,
      name: u.name ?? u.email ?? "—",
      email: u.email,
      bolum: u.personnel?.bolum ?? null,
      yaka: u.personnel
        ? yakaGrubu({
            yakaRengi: u.personnel.yakaRengi,
            yakaDetayi: u.personnel.yakaDetayi,
          })
        : null,
      // Kurs
      atananKurs: atananKursSayisi,
      completedCourses: p.completed,
      totalCourseProgress: p.total,
      // Sınav — kişi bazlı, atanan sınav üzerinden (Melih, 11.10.2026)
      atananSinav: atananSinavKumesi.size,
      gectigiSinav,
      kaldigiSinav,
      girmedigiSinav,
      passedExams: a.passed,
      totalAttempts: a.total,
      avgScore,
      certificateCount: u._count.akademiCertificates,
    };
  });

  return NextResponse.json({ users: result });
}
