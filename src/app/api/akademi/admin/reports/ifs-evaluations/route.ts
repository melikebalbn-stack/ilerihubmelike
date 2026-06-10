import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";
import { getUserPermissions } from "@/lib/auth/get-user-permissions";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { getUsersByBolum, resolveUserBolum } from "@/lib/user-personnel";

// IFS-5a: Görev değerlendirme matrisi — READ (read-only).
// Param: bolum (zorunlu) + courseId (IFS kursu/alanı) [+ opsiyonel userId].
// Yetki: akademi.report.view; akademi.admin -> her bölüm, aksi -> yalnız kendi
// bölümü (başka bölüm 403). Caller resolveAkademiUserId ile çözülür.
// N+1 YOK: getUsersByBolum + GOREV içerikleri + ContentProgress (+ userId varsa
// IfsTaskEvaluation) — per-user döngüde sorgu yok.
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

  const bolum = req.nextUrl.searchParams.get("bolum")?.trim() || null;
  const courseId = req.nextUrl.searchParams.get("courseId")?.trim() || null;
  const userId = req.nextUrl.searchParams.get("userId")?.trim() || null;

  if (!bolum) {
    return NextResponse.json({ error: "bolum gerekli" }, { status: 400 });
  }
  if (!courseId) {
    return NextResponse.json({ error: "courseId gerekli" }, { status: 400 });
  }

  // Scope: müdür yalnız kendi bölümünü görebilir.
  const perms = await getUserPermissions(callerId);
  const fullScope = perms.has("akademi.admin");
  // IFS-5b: eğitmen düzenleme yetkisi (UI editable vs read-only).
  const canEdit = perms.has("akademi.grade.manual");
  if (!fullScope) {
    const ownBolum = await resolveUserBolum(callerId);
    if (!ownBolum || ownBolum !== bolum) {
      return NextResponse.json(
        { error: "Bu bölümü görüntüleme yetkiniz yok" },
        { status: 403 }
      );
    }
  }

  const users = await getUsersByBolum(bolum);
  const tasks = await prisma.content.findMany({
    where: { courseId, type: "GOREV", isActive: true },
    orderBy: { order: "asc" },
    select: {
      id: true,
      title: true,
      order: true,
      ifsMeta: {
        select: { modul: true, altModul: true, ifsEkran: true },
      },
    },
  });

  const userIds = users.map((u) => u.id);
  const taskIds = tasks.map((t) => t.id);

  // Kullanıcı başına tamamlanma (ContentProgress.completed) — tek sorgu.
  const completedRows =
    userIds.length && taskIds.length
      ? await prisma.contentProgress.findMany({
          where: {
            userId: { in: userIds },
            contentId: { in: taskIds },
            completed: true,
          },
          select: { userId: true },
        })
      : [];
  const completedByUser = new Map<string, number>();
  for (const r of completedRows) {
    completedByUser.set(r.userId, (completedByUser.get(r.userId) ?? 0) + 1);
  }

  const total = tasks.length;
  const usersOut = users.map((u) => {
    const done = completedByUser.get(u.id) ?? 0;
    return {
      userId: u.id,
      name: u.name ?? u.email ?? u.id,
      completedCount: done,
      totalTasks: total,
      completionPct: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  });

  const tasksOut = tasks.map((t) => ({
    contentId: t.id,
    konu: t.title,
    modul: t.ifsMeta?.modul ?? null,
    altModul: t.ifsMeta?.altModul ?? null,
    ifsEkran: t.ifsMeta?.ifsEkran ?? null,
    order: t.order,
  }));

  // Seçili kullanıcı varsa onun değerlendirme hücreleri (tek sorgu).
  let evaluations: Record<
    string,
    {
      egitimVerildi: boolean;
      uygulamaliYapildi: boolean;
      ornekYapildi: boolean;
      projeEkibiYorum: string | null;
      danismanYorum: string | null;
    }
  > | null = null;

  if (userId) {
    // Seçilen kullanıcı bu bölümde mi? (scope tutarlılığı)
    if (!userIds.includes(userId)) {
      return NextResponse.json(
        { error: "Kullanıcı bu bölümde değil" },
        { status: 400 }
      );
    }
    const evalRows = taskIds.length
      ? await prisma.ifsTaskEvaluation.findMany({
          where: { userId, contentId: { in: taskIds } },
          select: {
            contentId: true,
            egitimVerildi: true,
            uygulamaliYapildi: true,
            ornekYapildi: true,
            projeEkibiYorum: true,
            danismanYorum: true,
          },
        })
      : [];
    const map = new Map(evalRows.map((e) => [e.contentId, e]));
    evaluations = {};
    for (const t of tasks) {
      const e = map.get(t.id);
      evaluations[t.id] = {
        egitimVerildi: e?.egitimVerildi ?? false,
        uygulamaliYapildi: e?.uygulamaliYapildi ?? false,
        ornekYapildi: e?.ornekYapildi ?? false,
        projeEkibiYorum: e?.projeEkibiYorum ?? null,
        danismanYorum: e?.danismanYorum ?? null,
      };
    }
  }

  return NextResponse.json({
    bolum,
    courseId,
    scope: fullScope ? "full" : "own",
    canEdit,
    tasks: tasksOut,
    users: usersOut,
    userId,
    evaluations,
  });
}

// IFS-5b: Eğitmen/danışman değerlendirmesi kaydet (upsert).
// requirePermission(akademi.grade.manual). YALNIZ egitimVerildi/uygulamaliYapildi/
// projeEkibiYorum/danismanYorum. ornekYapildi'ya ve ContentProgress'e DOKUNMAZ
// (kullanıcı-driven tamamlanma etkilenmez).
export async function PATCH(req: NextRequest) {
  const { error } = await requirePermission("akademi.grade.manual");
  if (error) return error;

  let body: {
    userId?: string;
    contentId?: string;
    egitimVerildi?: unknown;
    uygulamaliYapildi?: unknown;
    projeEkibiYorum?: unknown;
    danismanYorum?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const userId = body.userId?.trim();
  const contentId = body.contentId?.trim();
  if (!userId || !contentId) {
    return NextResponse.json(
      { error: "userId ve contentId gerekli" },
      { status: 400 }
    );
  }

  // İçerik gerçekten bir GOREV mi?
  const content = await prisma.content.findFirst({
    where: { id: contentId, type: "GOREV" },
    select: { id: true },
  });
  if (!content) {
    return NextResponse.json(
      { error: "Görev (GOREV) bulunamadı" },
      { status: 404 }
    );
  }

  const data: {
    egitimVerildi?: boolean;
    uygulamaliYapildi?: boolean;
    projeEkibiYorum?: string | null;
    danismanYorum?: string | null;
  } = {};
  if (typeof body.egitimVerildi === "boolean")
    data.egitimVerildi = body.egitimVerildi;
  if (typeof body.uygulamaliYapildi === "boolean")
    data.uygulamaliYapildi = body.uygulamaliYapildi;
  if (body.projeEkibiYorum !== undefined)
    data.projeEkibiYorum =
      typeof body.projeEkibiYorum === "string"
        ? body.projeEkibiYorum.trim() || null
        : null;
  if (body.danismanYorum !== undefined)
    data.danismanYorum =
      typeof body.danismanYorum === "string"
        ? body.danismanYorum.trim() || null
        : null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Güncellenecek alan yok" },
      { status: 400 }
    );
  }

  // ornekYapildi create'te default false; hiçbir yerde set edilmez.
  await prisma.ifsTaskEvaluation.upsert({
    where: { userId_contentId: { userId, contentId } },
    create: { userId, contentId, ...data },
    update: data,
  });

  return NextResponse.json({ success: true });
}
