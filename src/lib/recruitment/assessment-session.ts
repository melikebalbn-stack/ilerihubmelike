import { Prisma } from "@/generated/prisma";
import { generateAssessmentToken } from "@/lib/assessment/token";

// Aday sınav oturumu oluşturma — TEK KAYNAK.
// Hem POST /transition (tx içinde, statü SINAV'a geçerken) hem standalone
// sessions route bu helper'ı çağırır; oluşturma mantığı KOPYALANMAZ.
//
// SORUMLULUK AYRIMI:
//   - Bu helper: sınav geçerliliği (var + aktif) + idempotent oturum upsert.
//   - Uygulama statü guard'ı ÇAĞIRANA aittir:
//       * standalone route → ATANABILIR_STATUS seti (matrissiz atama)
//       * /transition     → izin matrisi (ALLOWED_TRANSITIONS) zaten karar verdi
//     (Bu yüzden helper statüye BAKMAZ — matris-izinli from→SINAV geçişini yanlışlıkla
//      bloklamamak için; ör. TELEFON_MULAKATI ATANABILIR_STATUS'ta yok ama matriste SINAV'a gidebilir.)

// Token geçerlilik süresi: 72 saat. (Standalone route ile aynı değer, tek kaynak burada.)
export const ASSESSMENT_GECERLILIK_MS = 72 * 60 * 60 * 1000;

// Aktif (adayın çözebileceği) oturum statüleri — sinavLink YALNIZ bunlarda verilir.
export const AKTIF_OTURUM_STATUS = new Set(["ATANDI", "BASLADI"]);

// Public sınav sayfası URL'i. Base env'den (staging→staging, prod→prod); hardcode YOK.
// İK DTO'su + public başvuru-durum ucu ortak kullanır (kopya yok).
export function sinavUrl(token: string): string {
  const base = process.env.ILERIHUB_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  return base ? `${base}/sinav/${token}` : `/sinav/${token}`;
}

// Route'un HTTP koduna çevirebilmesi, transition'ın tx'i geri alabilmesi için tipli hata.
export class AssessmentSessionError extends Error {
  httpStatus: number;
  constructor(message: string, httpStatus: number) {
    super(message);
    this.name = "AssessmentSessionError";
    this.httpStatus = httpStatus;
  }
}

export async function ensureAssessmentSession<S extends Prisma.AssessmentSessionSelect>(
  client: Prisma.TransactionClient,
  args: { publicJobApplicationId: string; assessmentId: string; select: S },
): Promise<{ session: Prisma.AssessmentSessionGetPayload<{ select: S }>; assessmentName: string }> {
  const sinav = await client.candidateAssessment.findUnique({
    where: { id: args.assessmentId },
    select: { id: true, name: true, isActive: true },
  });
  if (!sinav) throw new AssessmentSessionError("Sınav bulunamadı", 404);
  if (!sinav.isActive) throw new AssessmentSessionError("Sınav pasif", 400);

  const expiresAt = new Date(Date.now() + ASSESSMENT_GECERLILIK_MS);

  // Idempotent: (publicJobApplicationId, assessmentId) tekil kısıtı → varsa dokunma,
  // yoksa crypto-random token ile oluştur (public bearer token, tahmin-dirençli).
  const session = await client.assessmentSession.upsert({
    where: {
      publicJobApplicationId_assessmentId: {
        publicJobApplicationId: args.publicJobApplicationId,
        assessmentId: args.assessmentId,
      },
    },
    create: {
      publicJobApplicationId: args.publicJobApplicationId,
      assessmentId: args.assessmentId,
      expiresAt,
      token: generateAssessmentToken(),
    },
    update: {},
    select: args.select,
  });

  return { session, assessmentName: sinav.name };
}
