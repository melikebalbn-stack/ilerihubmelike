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

// Terminal (kapanmış) oturum statüleri — aktif sayılmaz.
export const TERMINAL_OTURUM_STATUS = ["TAMAMLANDI", "SURESI_DOLDU", "IPTAL"] as const;

// "Aktif oturum" TANIMI — TEK KAYNAK. Kural: terminal DEĞİL + expiresAt gelecekte + createdAt en yeni.
// 3 çağıran (basvuru-durum, detay GET, transition/sınav değiştirme) bunu kullanır; kopya mantık YOK.
// client: prisma veya tx (aynı transaction içinde de çağrılabilir).
export async function aktifOturumBul<S extends Prisma.AssessmentSessionSelect>(
  client: Prisma.TransactionClient,
  publicJobApplicationId: string,
  select: S,
): Promise<Prisma.AssessmentSessionGetPayload<{ select: S }> | null> {
  const now = new Date();
  const oturum = await client.assessmentSession.findFirst({
    where: {
      publicJobApplicationId,
      status: { notIn: [...TERMINAL_OTURUM_STATUS] },
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
    select,
  });
  return oturum ?? null;
}

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

// Detay sayfası / müdür sonuç kartı için oturum özeti. sinavLink YALNIZ İK + aktif oturumda;
// ham token ASLA dışa verilmez (yalnız link üretiminde kullanılır). Süresi dolmuş oturum
// gizlenmez (durum: 'SURESI_DOLDU' — lazy expiry). aktif/geçmiş ayrımı: aktifOturumBul (tek kaynak).
export type OturumOzeti = {
  id: string;
  assessmentId: string;
  assessmentTitle: string;
  durum: string;
  puan: number | null;
  gecmeNotu: number;
  gecti: boolean | null;
  atanmaTarihi: Date;
  baslamaTarihi: Date | null;
  tamamlanmaTarihi: Date | null;
  sonGecerlilik: Date;
  sinavLink?: string;
};

const OZET_SELECT = {
  id: true,
  assessmentId: true,
  status: true,
  score: true,
  result: true,
  assignedAt: true,
  startedAt: true,
  finishedAt: true,
  expiresAt: true,
  createdAt: true,
  token: true,
  assessment: { select: { name: true, passingScore: true } },
} satisfies Prisma.AssessmentSessionSelect;

export async function oturumOzetiGetir(
  client: Prisma.TransactionClient,
  publicJobApplicationId: string,
  opts: { ik: boolean },
): Promise<{ aktif: OturumOzeti | null; gecmis: OturumOzeti[] }> {
  const aktifRow = await aktifOturumBul(client, publicJobApplicationId, OZET_SELECT);
  const hepsi = await client.assessmentSession.findMany({
    where: { publicJobApplicationId },
    orderBy: { createdAt: "desc" },
    select: OZET_SELECT,
  });
  const now = Date.now();

  const toOzet = (o: (typeof hepsi)[number], aktifMi: boolean): OturumOzeti => {
    // Lazy expiry: DB'de hâlâ ATANDI/BASLADI ama süresi geçmişse görünen durum SURESI_DOLDU.
    const durum =
      (o.status === "ATANDI" || o.status === "BASLADI") && o.expiresAt.getTime() < now
        ? "SURESI_DOLDU"
        : o.status;
    return {
      id: o.id,
      assessmentId: o.assessmentId,
      assessmentTitle: o.assessment.name,
      durum,
      puan: o.score,
      gecmeNotu: o.assessment.passingScore,
      gecti: o.result === null ? null : o.result === "GECTI",
      atanmaTarihi: o.assignedAt,
      baslamaTarihi: o.startedAt,
      tamamlanmaTarihi: o.finishedAt,
      sonGecerlilik: o.expiresAt,
      // sinavLink YALNIZ İK + aktif oturum. Ham token yanıta HİÇ konmaz.
      ...(opts.ik && aktifMi ? { sinavLink: sinavUrl(o.token) } : {}),
    };
  };

  const aktif = aktifRow ? toOzet(aktifRow, true) : null;
  const gecmis = hepsi.filter((s) => s.id !== aktifRow?.id).map((s) => toOzet(s, false));
  return { aktif, gecmis };
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
