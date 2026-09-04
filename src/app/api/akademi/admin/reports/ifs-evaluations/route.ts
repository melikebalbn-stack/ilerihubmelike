import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";
import { getUserPermissions } from "@/lib/auth/get-user-permissions";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { getUsersByBolum, resolveUserBolum } from "@/lib/user-personnel";
import { recomputeCourseProgress } from "@/lib/akademi/course-progress";
import { logAuditEvent } from "@/lib/audit-log";

// IFS canlı değerlendirme yazma yetkisi (PR-2): OR — yeni izin, mevcut
// grade.manual (geri uyum) veya tam admin. grade.manual ileride OR'dan çıkarılıp
// daraltılabilir.
// IFS görev/alan değerlendirmesi yazma yetkisi — TEK ANAHTAR.
//
// Eskiden OR şuydu: akademi.ifs.evaluate + akademi.grade.manual + akademi.admin.
// Üçü de kaldırıldı; kapı artık yalnız ifs.evaluate (IFS Eğitmeni / Super Admin).
//
// ÖLÇÜLDÜ (3 Eyl 2026, prod): bu daraltma ÜÇ kişiyi dışarıda bırakıyor —
// Elif Karadeniz, Elif Yıldırım, Gokce Eksioglu. Üçü de yalnız grade.manual +
// akademi.admin ile geçiyordu, ifs.evaluate taşımıyorlar. BİLEREK dışarıdalar:
// IFS görev değerlendirmesi eğitmenin işi, akademi/İK yöneticiliğinin değil.
// Üçünün bugüne kadar yazdığı IFS değerlendirmesi: 0 / 0 / 0.
// Fiilen değerlendirme yazan üç kişi (Melike Balaban, Nurgul Tastan,
// Melih Dilben) ifs.evaluate taşıyor — kimse kesilmiyor.
//
// Birine yeniden yetki gerekirse doğru yol bu diziyi genişletmek DEĞİL,
// o kişiye "IFS Eğitmeni" rolünü vermektir.
const IFS_EVAL_WRITE = ["ifs.evaluate"];

// IFS-5a: Görev değerlendirme matrisi — READ (read-only).
// Param: bolum (zorunlu) + courseId (IFS kursu/alanı) [+ opsiyonel userId].
// Yetki: akademi.report.view; akademi.admin -> her bölüm, aksi -> yalnız kendi
// bölümü (başka bölüm 403). Caller resolveAkademiUserId ile çözülür.
// N+1 YOK: getUsersByBolum + GOREV içerikleri + ContentProgress (+ userId varsa
// IfsTaskEvaluation) — per-user döngüde sorgu yok.
export async function GET(req: NextRequest) {
  const { session, error } = await requirePermission("ifs.rapor.view");
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
  // KAPSAM KARARI — burada OR BİLEREK duruyor (guard'larda tek anahtara indirildi).
  // Fark: guard kapıyı kapatır, 403 verir, hemen fark edilir. Kapsam kararı ise
  // sessizce AZ VERİ gösterir — yönetici kendini kendi bölümüne daraltılmış bulur
  // ve bunu kimse hata olarak bildirmez. Eski anahtarı burada bırakmak kimseyi
  // içeri ALMAZ (guard zaten ifs.* istiyor); yalnız geçiş döneminde yanlış
  // daraltmayı önler.
  const fullScope = perms.has("ifs.admin") || perms.has("akademi.admin");
  // IFS-5b: eğitmen düzenleme yetkisi (UI editable vs read-only).
  // PR-2: yazma OR setiyle hizalı (yeni izin / grade.manual / admin).
  const canEdit = IFS_EVAL_WRITE.some((p) => perms.has(p));
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
  // PR-3: UI mevcut değerleri gösterebilsin diye ornekStatus + degerlendirildiAt
  // de okunur (yalnız READ; yazma/şema değişmez).
  let evaluations: Record<
    string,
    {
      egitimVerildi: boolean;
      uygulamaliYapildi: boolean;
      ornekYapildi: boolean;
      ornekAciklama: string | null;
      ornekStatus: string;
      kursiyerDurum: string;
      degerlendirildiAt: string | null;
      projeEkibiYorum: string | null;
      danismanYorum: string | null;
    }
  > | null = null;

  // PR-3: per-ders eğitmen değerlendirmesi (seviye + not) — READ.
  let courseEvaluation: { seviye: string | null; not: string | null } | null =
    null;

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
            ornekAciklama: true,
            ornekStatus: true,
            kursiyerDurum: true,
            degerlendirildiAt: true,
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
        ornekAciklama: e?.ornekAciklama ?? null,
        ornekStatus: e?.ornekStatus ?? "PENDING",
        kursiyerDurum: e?.kursiyerDurum ?? "BEKLIYOR",
        degerlendirildiAt: e?.degerlendirildiAt?.toISOString() ?? null,
        projeEkibiYorum: e?.projeEkibiYorum ?? null,
        danismanYorum: e?.danismanYorum ?? null,
      };
    }

    const ce = await prisma.ifsCourseEvaluation.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { seviye: true, not: true },
    });
    courseEvaluation = { seviye: ce?.seviye ?? null, not: ce?.not ?? null };
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
    courseEvaluation,
  });
}

// IFS-5b + PR-2: Eğitmen/danışman değerlendirmesi kaydet (upsert).
// Yetki: OR(akademi.ifs.evaluate, akademi.grade.manual, akademi.admin).
// egitimVerildi/uygulamaliYapildi/projeEkibiYorum/danismanYorum (IFS-5b) +
// PR-2: ornekStatus (BASARILI|TEKRAR_GEREKLI|PENDING) + degerlendiren iz.
// ornekYapildi'ya ve ContentProgress'e DOKUNMAZ (kursiyer self-mark'ı ayrı).
// Yazımdan sonra recomputeCourseProgress → IFS % (BASARILI oranı) güncellenir.
const ORNEK_STATUS_VALUES = ["PENDING", "BASARILI", "TEKRAR_GEREKLI"] as const;
type OrnekStatusValue = (typeof ORNEK_STATUS_VALUES)[number];

export async function PATCH(req: NextRequest) {
  const { session, error } = await requirePermission(IFS_EVAL_WRITE);
  if (error) return error;
  const actorId = await resolveAkademiUserId(session);
  if (!actorId) {
    return NextResponse.json(
      { error: "Kullanıcı çözümlenemedi" },
      { status: 401 }
    );
  }

  let body: {
    userId?: string;
    contentId?: string;
    egitimVerildi?: unknown;
    uygulamaliYapildi?: unknown;
    projeEkibiYorum?: unknown;
    danismanYorum?: unknown;
    ornekStatus?: unknown;
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

  // İçerik gerçekten bir GOREV mi? courseId recompute için gerekli.
  const content = await prisma.content.findFirst({
    where: { id: contentId, type: "GOREV" },
    select: { id: true, courseId: true },
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
    ornekStatus?: OrnekStatusValue;
    degerlendirenId?: string;
    degerlendirildiAt?: Date;
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

  // PR-2: eğitmen statüsü + iz. Yalnız geçerli enum kabul edilir.
  if (body.ornekStatus !== undefined) {
    if (
      typeof body.ornekStatus !== "string" ||
      !ORNEK_STATUS_VALUES.includes(body.ornekStatus as OrnekStatusValue)
    ) {
      return NextResponse.json(
        { error: "Geçersiz ornekStatus" },
        { status: 400 }
      );
    }
    data.ornekStatus = body.ornekStatus as OrnekStatusValue;
    data.degerlendirenId = actorId;
    data.degerlendirildiAt = new Date();
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Güncellenecek alan yok" },
      { status: 400 }
    );
  }

  // Yazma + audit atomik (tx). ornekYapildi create'te default false; set edilmez.
  await prisma.$transaction(async (tx) => {
    await tx.ifsTaskEvaluation.upsert({
      where: { userId_contentId: { userId, contentId } },
      create: { userId, contentId, ...data },
      update: data,
    });
    await logAuditEvent({
      action: "IFS_TASK_EVALUATION_UPSERTED",
      actorId,
      targetType: "IFS_TASK_EVALUATION",
      targetId: contentId,
      details: {
        userId,
        contentId,
        courseId: content.courseId,
        ...data,
        degerlendirildiAt: data.degerlendirildiAt?.toISOString(),
      },
      tx,
    });
  });

  // Yazımdan sonra ilerleme yeniden hesaplanır (IFS'te % = BASARILI oranı; normal
  // kursta mevcut değeri korur).
  await recomputeCourseProgress(userId, content.courseId);

  return NextResponse.json({ success: true });
}
