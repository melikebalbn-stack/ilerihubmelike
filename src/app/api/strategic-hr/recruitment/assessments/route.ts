import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assessmentGuard } from "@/lib/assessment/guard";
import type { AssessmentType } from "@/generated/prisma";

// GET — sınav tanımları listesi (soru sayısı ile)
export async function GET() {
  const g = await assessmentGuard();
  if (g.error) return g.error;

  const sinavlar = await prisma.candidateAssessment.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { questions: true, sessions: true } } },
  });
  return NextResponse.json(sinavlar);
}

// POST — yeni sınav tanımı (admin)
export async function POST(req: NextRequest) {
  const g = await assessmentGuard({ requireAdmin: true });
  if (g.error) return g.error;

  const body = await req.json();
  const { name, type, durationMin, passingScore } = body ?? {};
  if (!name || !durationMin || passingScore == null) {
    return NextResponse.json({ error: "name, durationMin ve passingScore zorunlu" }, { status: 400 });
  }

  const sinav = await prisma.candidateAssessment.create({
    data: {
      name: String(name),
      type: (type as AssessmentType) ?? "GENEL",
      durationMin: Number(durationMin),
      passingScore: Number(passingScore),
    },
  });
  return NextResponse.json(sinav, { status: 201 });
}
