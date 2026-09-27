import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";
import { kursAra, kursZorunluMu, atamaKpiHesap, type AtamaSatir } from "@/lib/akademi/atama-model";

// GET - Kurs BAZLI atama listesi + global KPI. Kişi listesi BURADA yüklenmez
// (kurs seçilince ayrı uç). Sunucu taraflı arama + çip + sayfalama.
export async function GET(request: NextRequest) {
  const { error } = await requirePermission("akademi.admin");
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const cip = searchParams.get("cip") ?? "all"; // all | zorunlu | gecikmesi
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const now = new Date();

  // Container → courseId eşlemesi + tüm kişi atamaları + ilerleme (JS aggregate).
  const containers = await prisma.courseAssignment.findMany({ select: { id: true, courseId: true } });
  const contToCourse = new Map(containers.map((c) => [c.id, c.courseId]));

  const uca = await prisma.userCourseAssignment.findMany({
    select: { userId: true, assignmentId: true, dueDate: true },
  });
  const progress = await prisma.courseProgress.findMany({
    select: { userId: true, courseId: true, percentage: true, completedAt: true },
  });
  const progMap = new Map(progress.map((p) => [`${p.userId}:${p.courseId}`, p]));

  // Kurs bazlı toplama
  type Agg = { atanan: number; tamamlayan: number; ilerlemeTop: number; gecikmis: number; enYakin: Date | null };
  const byCourse = new Map<string, Agg>();
  const kpiRows: AtamaSatir[] = [];

  for (const a of uca) {
    const courseId = contToCourse.get(a.assignmentId);
    if (!courseId) continue;
    const p = progMap.get(`${a.userId}:${courseId}`);
    const isCompleted = Boolean(p?.completedAt);
    const pct = p?.percentage ?? 0;
    kpiRows.push({ courseId, dueDate: a.dueDate, isCompleted });

    let agg = byCourse.get(courseId);
    if (!agg) {
      agg = { atanan: 0, tamamlayan: 0, ilerlemeTop: 0, gecikmis: 0, enYakin: null };
      byCourse.set(courseId, agg);
    }
    agg.atanan++;
    agg.ilerlemeTop += pct;
    if (isCompleted) agg.tamamlayan++;
    else if (a.dueDate && new Date(a.dueDate) < now) agg.gecikmis++;
    if (!isCompleted && a.dueDate) {
      const d = new Date(a.dueDate);
      if (!agg.enYakin || d < agg.enYakin) agg.enYakin = d;
    }
  }

  const kpi = atamaKpiHesap(kpiRows, now);

  // Kurs meta + filtreler
  const courses = await prisma.course.findMany({
    where: { isActive: true },
    select: { id: true, title: true, category: true, isIfs: true },
    orderBy: { title: "asc" },
  });

  let liste = courses
    .filter((c) => byCourse.has(c.id)) // yalnız atama içeren kurslar
    .map((c) => {
      const agg = byCourse.get(c.id)!;
      return {
        id: c.id,
        title: c.title,
        category: c.category,
        zorunlu: kursZorunluMu(c.category),
        atanan: agg.atanan,
        tamamlayan: agg.tamamlayan,
        ortalamaIlerleme: agg.atanan ? Math.round(agg.ilerlemeTop / agg.atanan) : 0,
        gecikmis: agg.gecikmis,
        enYakinDueDate: agg.enYakin ? agg.enYakin.toISOString() : null,
      };
    });

  if (cip === "zorunlu") liste = liste.filter((k) => k.zorunlu);
  else if (cip === "gecikmesi") liste = liste.filter((k) => k.gecikmis > 0);
  liste = kursAra(liste, search);

  const toplam = liste.length;
  const sayfa = liste.slice((page - 1) * limit, page * limit);

  // Çip sayıları (arama uygulanmadan, tüm atamalı kurslar üstünden)
  const tumu = courses.filter((c) => byCourse.has(c.id));
  const cipSayilar = {
    all: tumu.length,
    zorunlu: tumu.filter((c) => kursZorunluMu(c.category)).length,
    gecikmesi: tumu.filter((c) => (byCourse.get(c.id)?.gecikmis ?? 0) > 0).length,
  };

  return NextResponse.json({ kpi, kurslar: sayfa, toplam, page, limit, cipSayilar });
}
