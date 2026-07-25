import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { resolveTransitionRoles } from "@/lib/recruitment/resolve-roles";
import {
  allowedTargetsForRoles,
  requiresAssignedManager,
  requiresRejectionReason,
} from "@/lib/recruitment/transitions";

export const dynamic = "force-dynamic";

// GET — Başvuru aşama geçmişi (StageLog) + kullanıcının bu başvuru üzerindeki WORKFLOW bağlamı.
//
// Middleware /api/* KAPSAMAZ → route içi guard zorunlu (transition route ile aynı desen).
// Yetki: İK (recruitment.admin / hr.admin) VEYA atanan müdür. İkisi de değilse 403.
// İzin hesabı yalnız SUNUCUDA (resolveTransitionRoles + allowedTargetsForRoles) — client
// yetki hesaplamaz; butonlarını buradan dönen allowedTargets'tan türetir.

function userName(u: {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
} | undefined): string | null {
  if (!u) return null;
  const composed = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  return composed || u.name || u.email || null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;

  // Başvuru + atanan müdür (rol belirleme için).
  const application = await prisma.publicJobApplication.findUnique({
    where: { id },
    select: { id: true, status: true, assignedManagerId: true },
  });
  if (!application) {
    return NextResponse.json({ error: "Başvuru bulunamadı" }, { status: 404 });
  }

  // Rol(ler) — TEK KAYNAK (transition route ile aynı helper).
  const roles = resolveTransitionRoles({
    permissions: session.user.permissions,
    userId: session.user.id,
    assignedManagerId: application.assignedManagerId,
  });
  if (roles.length === 0) {
    return NextResponse.json({ error: "Bu başvuruyu görüntüleme yetkiniz yok" }, { status: 403 });
  }

  // StageLog kayıtları (createdAt ASC). changedBy düz String id (User relation'ı yok),
  // bu yüzden manuel join: id'leri topla → User adı/unvanı çek → eşle. Ham id dönmez.
  const rows = await prisma.publicJobApplicationStageLog.findMany({
    where: { applicationId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      note: true,
      createdAt: true,
      changedBy: true,
    },
  });

  const userIds = [...new Set(rows.map((r) => r.changedBy).filter((x): x is string => !!x))];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, firstName: true, lastName: true, email: true, jobTitle: true },
      })
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  const logs = rows.map((r) => {
    const u = r.changedBy ? userById.get(r.changedBy) : undefined;
    return {
      id: r.id,
      fromStatus: r.fromStatus,
      toStatus: r.toStatus,
      note: r.note,
      createdAt: r.createdAt,
      changedByName: userName(u),
      changedByTitle: u?.jobTitle ?? null,
    };
  });

  // Workflow bağlamı: bu durumdan rollerin geçebileceği hedefler + hangi hedef ek girdi ister.
  const allowedTargets = allowedTargetsForRoles(application.status, roles);
  const requiresManagerTargets = allowedTargets.filter(requiresAssignedManager);
  const requiresReasonTargets = allowedTargets.filter(requiresRejectionReason);

  return NextResponse.json({
    logs,
    workflow: {
      currentStatus: application.status,
      roles,
      allowedTargets,
      isTerminal: allowedTargets.length === 0,
      assignedManagerId: application.assignedManagerId,
      requiresManagerTargets,
      requiresReasonTargets,
    },
  });
}
