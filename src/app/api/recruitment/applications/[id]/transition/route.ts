import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { JobApplicationStatus } from "@/generated/prisma";
import {
  allowedTargetsForRoles,
  canTransitionAny,
  requiresAssignedManager,
  type TransitionRole,
} from "@/lib/recruitment/transitions";
import { transitionApplicationStatus } from "@/lib/recruitment/stage-log";

export const dynamic = "force-dynamic";

// NOT (middleware raporu): src/middleware.ts matcher'ı /api/* KAPSAMAZ (yalnız sayfa
// route'ları: /dashboard, /personnel, /envanter ...). Bu yüzden API auth'u route içinde
// yapılır — requireSession aşağıda oturumu zorunlu kılar. Bilinçli/gerekli guard.

const BodySchema = z.object({
  toStatus: z.nativeEnum(JobApplicationStatus),
  note: z.string().trim().max(2000).optional(),
  assignedManagerId: z.string().trim().min(1).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1) Oturum
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;

  // Body doğrula
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Geçersiz istek gövdesi", detay: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { toStatus, note, assignedManagerId } = parsed.data;

  // 2) Başvuruyu çek
  const application = await prisma.publicJobApplication.findUnique({
    where: { id },
    select: { id: true, status: true, assignedManagerId: true, fullName: true },
  });
  if (!application) {
    return NextResponse.json({ error: "Başvuru bulunamadı" }, { status: 404 });
  }

  // 3) Rol(ler): kullanıcı BİRDEN ÇOK role sahip olabilir (hem İK hem atanan müdür).
  //    (session.user.id bu repoda DB User.id'dir.) Hiç rol yoksa 403.
  const perms = session.user.permissions ?? [];
  const roles: TransitionRole[] = [];
  if (perms.includes("recruitment.admin") || perms.includes("hr.admin")) roles.push("IK");
  if (application.assignedManagerId === session.user.id) roles.push("MUDUR");
  if (roles.length === 0) {
    return NextResponse.json(
      { error: "Bu başvuru için geçiş yetkiniz yok" },
      { status: 403 },
    );
  }

  const current = application.status;

  // 4) İzin matrisi — rollerin BİRLEŞİK (union) izinli hedefleri. Otorite transitions.ts'te.
  if (!canTransitionAny(current, toStatus, roles)) {
    return NextResponse.json(
      {
        error: "Bu geçişe izin yok",
        from: current,
        to: toStatus,
        roles,
        allowedTargets: allowedTargetsForRoles(current, roles),
      },
      { status: 400 },
    );
  }

  // 5) MUDUR_DEGERLENDIRME → atanan müdür zorunlu.
  //    (mevcut atama varsa ve yeni verilmediyse onu kullan; ikisi de yoksa 400.)
  const efektifManagerId = assignedManagerId ?? application.assignedManagerId ?? null;
  if (requiresAssignedManager(toStatus) && !efektifManagerId) {
    return NextResponse.json(
      { error: "MUDUR_DEGERLENDIRME için assignedManagerId zorunludur" },
      { status: 400 },
    );
  }

  // 6) Geçiş (tx + commit sonrası bildirim, stage-log wrapper'ında)
  try {
    const updated = await transitionApplicationStatus({
      applicationId: id,
      toStatus,
      note: note ?? null,
      changedBy: session.user.id,
      // Yalnız yeni atama verildiyse yaz; verilmediyse mevcut korunur.
      assignedManagerId: assignedManagerId ?? undefined,
      actorName: session.user.name ?? null,
    });
    // 7) Güncel kayıt
    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    console.error("Başvuru geçişi başarısız:", err);
    return NextResponse.json(
      { error: "Geçiş sırasında hata oluştu" },
      { status: 500 },
    );
  }
}
