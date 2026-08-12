import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assessmentGuard } from "@/lib/assessment/guard";
import {
  ensureAssessmentSession,
  AssessmentSessionError,
  AKTIF_OTURUM_STATUS,
  sinavUrl,
} from "@/lib/recruitment/assessment-session";

// Sınav ATANABİLİR başvuru statüleri: aktif pipeline. ACCEPTED/REJECTED (terminal) ve
// taslak (CONSENT_PENDING/HEALTH_PENDING) hariç. SINAV dahil → statüsü zaten SINAV olan
// başvuruya (yeniden) sınav atanabilsin (idempotent). /transition bu seti KULLANMAZ (matris karar verir).
const ATANABILIR_STATUS = new Set(["PENDING", "REVIEWING", "SHORTLISTED", "INTERVIEW", "SINAV"]);

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

// Oturum → İK DTO: aktifse sinavLink, terminalde null. Ham token asla çıktıda değil.
// (sinavUrl + AKTIF_OTURUM_STATUS ortak helper'dan — public başvuru-durum ucuyla tek kaynak.)
//
// SINAV LİNKİ YALNIZ ADMIN'E (`isAdmin`): link adayın sınav yüzeyinin TEK anahtarıdır
// (public uç yalnız token'a bakar), yani linki gören sınavı adayın yerine çözebilir.
// Sınav ATAMAK zaten admin işi; yalnız `recruitment.view` olan müdür oturumun DURUMUNU
// görsün diye diğer alanlar (statü, tarihler, skor, sonuç) aynen döner — sadece link null.
function toOturumDto(
  o: { token: string; status: string } & Record<string, unknown>,
  isAdmin: boolean,
) {
  const { token, ...rest } = o;
  const aktif = AKTIF_OTURUM_STATUS.has(o.status);
  return { ...rest, sinavLink: isAdmin && aktif ? sinavUrl(token) : null };
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
  return NextResponse.json(oturumlar.map((o) => toOturumDto(o, g.isAdmin)));
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

  // Başvuru var mı + statü atanabilir mi (route politikası: ATANABILIR_STATUS).
  const basvuru = await prisma.publicJobApplication.findUnique({
    where: { id: publicJobApplicationId },
    select: { id: true, status: true },
  });
  if (!basvuru) return NextResponse.json({ error: "Başvuru bulunamadı" }, { status: 404 });
  if (!ATANABILIR_STATUS.has(basvuru.status)) {
    return NextResponse.json(
      { error: "Bu başvuru durumuna sınav atanamaz (yalnız aktif pipeline)" },
      { status: 400 },
    );
  }

  // Oluşturma TEK KAYNAK: sınav geçerliliği + idempotent upsert helper'da (transition ile ortak).
  try {
    const { session } = await ensureAssessmentSession(prisma, {
      publicJobApplicationId,
      assessmentId,
      select: OTURUM_SELECT,
    });
    // Atama hemen ATANDI (aktif) → sinavLink döner; İK linki kopyalayıp adaya iletir.
    // POST zaten requireAdmin guard'inda — atayan kisi linki gorur (adaya iletecek olan o).
    return NextResponse.json(toOturumDto(session, true), { status: 201 });
  } catch (e) {
    if (e instanceof AssessmentSessionError) {
      return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    }
    throw e;
  }
}
