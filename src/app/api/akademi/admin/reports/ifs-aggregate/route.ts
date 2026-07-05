import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/require-permission";
import { getUserPermissions } from "@/lib/auth/get-user-permissions";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { resolveUserBolum, getLinkedBolums } from "@/lib/user-personnel";
import { computeIfsAggregate } from "@/lib/akademi/ifs-aggregate";

// IFS değerlendirme grafik raporu — AGGREGATE.
// Hesap ortak katmanda: src/lib/akademi/ifs-aggregate.ts (computeIfsAggregate).
// METRİK: görev tamamlanma = ifsTaskEvaluation.ornekStatus===BASARILI (eğitmen
// onayı), ders tamamlanma = ifsCourseEvaluation.seviye===BASARILI. Matris
// completionPct'i (ContentProgress self-mark) KULLANILMAZ.
const querySchema = z.object({
  courseId: z.string().trim().min(1),
  bolum: z.string().trim().optional(),
  all: z.coerce.boolean().optional(), // boş bölümleri de göster
});

export async function GET(req: NextRequest) {
  const { session, error } = await requirePermission("akademi.report.view");
  if (error) return error;
  const callerId = await resolveAkademiUserId(session);
  if (!callerId) {
    return NextResponse.json(
      { error: "Kullanıcı çözümlenemedi" },
      { status: 401 }
    );
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams)
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Geçersiz parametre" },
      { status: 400 }
    );
  }
  const { courseId, bolum, all } = parsed.data;

  // Scope: müdür yalnız kendi bölümünü görebilir.
  const perms = await getUserPermissions(callerId);
  const fullScope = perms.has("akademi.admin");
  const ownBolum = fullScope ? null : await resolveUserBolum(callerId);

  // ── KİŞİ BAZINDA (bolum seçili) ──
  if (bolum) {
    if (!fullScope && ownBolum !== bolum) {
      return NextResponse.json(
        { error: "Bu bölümü görüntüleme yetkiniz yok" },
        { status: 403 }
      );
    }
    const agg = await computeIfsAggregate({
      courseId,
      bolums: [bolum],
      includeEmpty: true,
    });
    if (!agg) {
      return NextResponse.json(
        { error: "IFS kursu bulunamadı" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      mode: "kisi",
      bolum,
      courseTitle: agg.courseTitle,
      gorevCount: agg.gorevCount,
      users: agg.kisiRows.map((k) => ({
        userId: k.userId,
        ad: k.ad,
        basariliGorev: k.basariliGorev,
        gorevCount: k.gorevCount,
        pct: k.pct,
        seviye: k.seviye,
        not: k.not,
      })),
    });
  }

  // ── BÖLÜM BAZINDA (bolum yok) ──
  const bolums = fullScope
    ? await getLinkedBolums()
    : ownBolum
      ? [ownBolum]
      : [];

  const agg = await computeIfsAggregate({
    courseId,
    bolums,
    includeEmpty: !!all,
  });
  if (!agg) {
    return NextResponse.json({ error: "IFS kursu bulunamadı" }, { status: 404 });
  }

  return NextResponse.json({
    mode: "bolum",
    courseTitle: agg.courseTitle,
    gorevCount: agg.gorevCount,
    bolums: agg.bolumRows,
    totals: agg.totals,
  });
}
