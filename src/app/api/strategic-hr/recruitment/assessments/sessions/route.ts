import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assessmentGuard } from "@/lib/assessment/guard";

// Token geçerlilik süresi: 72 saat.
const GECERLILIK_MS = 72 * 60 * 60 * 1000;

// Sınav ATANABİLİR başvuru statüleri: aktif pipeline. ACCEPTED/REJECTED (terminal) ve
// taslak (CONSENT_PENDING/HEALTH_PENDING) hariç.
const ATANABILIR_STATUS = new Set(["PENDING", "REVIEWING", "SHORTLISTED", "INTERVIEW"]);

// Faz-1 kuralı: token üretilir ve oturumda saklanır ama HİÇBİR yanıtta dışa açılmaz.
// (Public /sinav/[token] akışı Faz 2.) Bu select token içermez.
const OTURUM_SELECT = {
  id: true,
  publicJobApplicationId: true,
  assessmentId: true,
  status: true,
  assignedAt: true,
  expiresAt: true,
  startedAt: true,
  finishedAt: true,
  score: true,
  result: true,
  assessment: { select: { id: true, name: true, type: true, passingScore: true } },
} as const;

// GET — bir başvurunun oturumları  (?publicJobApplicationId=...)
export async function GET(req: NextRequest) {
  const g = await assessmentGuard();
  if (g.error) return g.error;

  const publicJobApplicationId = req.nextUrl.searchParams.get("publicJobApplicationId");
  const where = publicJobApplicationId ? { publicJobApplicationId } : {};
  const oturumlar = await prisma.assessmentSession.findMany({
    where,
    orderBy: { assignedAt: "desc" },
    select: OTURUM_SELECT,
  });
  return NextResponse.json(oturumlar);
}

// POST — sınav ata (admin). Idempotent: (publicJobApplicationId, assessmentId) tekildir.
// Bağ: PublicJobApplication (gerçek başvuru kuyruğu). JobApplication DEĞİL.
export async function POST(req: NextRequest) {
  const g = await assessmentGuard({ requireAdmin: true });
  if (g.error) return g.error;

  const body = await req.json();
  const { publicJobApplicationId, assessmentId } = body ?? {};
  if (!publicJobApplicationId || !assessmentId) {
    return NextResponse.json(
      { error: "publicJobApplicationId ve assessmentId zorunlu" },
      { status: 400 },
    );
  }

  // Bağların geçerliliği.
  const [basvuru, sinav] = await Promise.all([
    prisma.publicJobApplication.findUnique({
      where: { id: publicJobApplicationId },
      select: { id: true, status: true },
    }),
    prisma.candidateAssessment.findUnique({
      where: { id: assessmentId },
      select: { id: true, isActive: true },
    }),
  ]);
  if (!basvuru) return NextResponse.json({ error: "Başvuru bulunamadı" }, { status: 404 });
  if (!sinav) return NextResponse.json({ error: "Sınav bulunamadı" }, { status: 404 });
  if (!sinav.isActive) return NextResponse.json({ error: "Sınav pasif" }, { status: 400 });
  if (!ATANABILIR_STATUS.has(basvuru.status)) {
    return NextResponse.json(
      { error: "Bu başvuru durumuna sınav atanamaz (yalnız aktif pipeline: PENDING/REVIEWING/SHORTLISTED/INTERVIEW)" },
      { status: 400 },
    );
  }

  const expiresAt = new Date(Date.now() + GECERLILIK_MS);

  // Idempotent atama: varsa dokunma, yoksa token'lı oluştur (token @default(cuid())).
  const oturum = await prisma.assessmentSession.upsert({
    where: { publicJobApplicationId_assessmentId: { publicJobApplicationId, assessmentId } },
    create: { publicJobApplicationId, assessmentId, expiresAt },
    update: {},
    select: OTURUM_SELECT,
  });
  return NextResponse.json(oturum, { status: 201 });
}
