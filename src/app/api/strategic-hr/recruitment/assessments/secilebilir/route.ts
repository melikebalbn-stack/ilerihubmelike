import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";
import { resolveTransitionRoles } from "@/lib/recruitment/resolve-roles";

export const dynamic = "force-dynamic";

// GET — SINAV geçişi modalı için SEÇİLEBİLİR (aktif) sınavlar.
// İK yetkisi şart (resolveTransitionRoles — başvuru-bağımsız liste, assignedManagerId yok).
// Middleware /api/* kapsamaz → route içi guard.
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const roles = resolveTransitionRoles({
    permissions: session.user.permissions,
    userId: session.user.id,
    assignedManagerId: null,
  });
  if (!roles.includes("IK")) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  }

  const sinavlar = await prisma.candidateAssessment.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      durationMin: true,
      passingScore: true,
      _count: { select: { questions: true } },
    },
  });

  return NextResponse.json(
    sinavlar.map((s) => ({
      id: s.id,
      title: s.name,
      durationMin: s.durationMin,
      passingScore: s.passingScore,
      soruSayisi: s._count.questions,
    })),
  );
}
