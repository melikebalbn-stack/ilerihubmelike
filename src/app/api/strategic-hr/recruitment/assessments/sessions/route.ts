import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assessmentGuard } from "@/lib/assessment/guard";
import { generateAssessmentToken } from "@/lib/assessment/token";

// Token geçerlilik süresi: 72 saat.
const GECERLILIK_MS = 72 * 60 * 60 * 1000;

// Sınav ATANABİLİR başvuru statüleri: aktif pipeline. ACCEPTED/REJECTED (terminal) ve
// taslak (CONSENT_PENDING/HEALTH_PENDING) hariç.
const ATANABILIR_STATUS = new Set(["PENDING", "REVIEWING", "SHORTLISTED", "INTERVIEW"]);

// Aktif (adayın hâlâ çözebileceği) oturum statüleri — link YALNIZ bunlarda gösterilir.
// Terminal (TAMAMLANDI/SURESI_DOLDU/IPTAL) → link işe yaramaz, dönülmez.
const AKTIF_STATUS = new Set(["ATANDI", "BASLADI"]);

// İK görünümü için oturum select'i. token DAHİL EDİLİR ama dışa HAM olarak açılmaz —
// yalnız aktif oturumda tam sinavLink'e çevrilir, terminal oturumda null.
// (Public endpoint'ler ayrı ve token'ı asla döndürmez; burası recruitAccess guard'ı arkasında.)
const OTURUM_SELECT = {
  id: true,
  publicJobApplicationId: true,
  assessmentId: true,
  status: true,
  token: true,
  assignedAt: true,
  expiresAt: true,
  startedAt: true,
  finishedAt: true,
  score: true,
  result: true,
  assessment: { select: { id: true, name: true, type: true, passingScore: true } },
} as const;

// Base URL ortamdan (staging→staging, prod→prod). Hardcode YOK. env yoksa relative path.
function sinavUrl(token: string): string {
  const base = process.env.ILERIHUB_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  return base ? `${base}/sinav/${token}` : `/sinav/${token}`;
}

// Oturum → İK DTO: aktifse sinavLink, terminalde null. Ham token asla çıktıda değil.
function toOturumDto(o: { token: string; status: string } & Record<string, unknown>) {
  const { token, ...rest } = o;
  return { ...rest, sinavLink: AKTIF_STATUS.has(o.status) ? sinavUrl(token) : null };
}

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
  return NextResponse.json(oturumlar.map(toOturumDto));
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

  // Idempotent atama: varsa dokunma, yoksa crypto-random token ile oluştur.
  // Token koddan üretilir (cuid DEĞİL) — public bearer token için tahmin-dirençli.
  const oturum = await prisma.assessmentSession.upsert({
    where: { publicJobApplicationId_assessmentId: { publicJobApplicationId, assessmentId } },
    create: { publicJobApplicationId, assessmentId, expiresAt, token: generateAssessmentToken() },
    update: {},
    select: OTURUM_SELECT,
  });
  // Atama hemen ATANDI (aktif) → sinavLink döner; İK linki kopyalayıp adaya iletir.
  return NextResponse.json(toOturumDto(oturum), { status: 201 });
}
