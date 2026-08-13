import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { imzaDogrula } from "@/lib/recruitment/basvuru-takip";
import { aktifOturumBul, sinavUrl } from "@/lib/recruitment/assessment-session";
import { notundanAdayEtiketleri } from "@/lib/recruitment/adaya-geri-gonder";

export const dynamic = "force-dynamic";

const DK_MS = 60 * 1000;

// noindex + no-store: arama motoru indexlemesin, ara katman/tarayıcı cache'lemesin.
const HEADERS = {
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Referrer-Policy": "no-referrer",
} as const;

// Jenerik ret: hangi alanın (numara mı imza mı) yanlış olduğunu SÖYLEMEZ (enumerasyon önlemi).
function reddet(status: number) {
  return NextResponse.json({ error: "Başvuru doğrulanamadı" }, { status, headers: HEADERS });
}

// POST /api/public/basvuru-durum — tablet teşekkür ekranı yoklaması (PUBLIC, auth yok).
// Yetki applicationNumber + takipImzasi'ndan türetilir. YALNIZ durum + (varsa) aktif sınav
// linki döner — ad/telefon/statü/not gibi HİÇBİR başvuru alanı dönmez. Ham token dışa verilmez.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const applicationNumber =
    typeof body?.applicationNumber === "string" ? body.applicationNumber.trim() : "";
  const takipImzasi = typeof body?.takipImzasi === "string" ? body.takipImzasi.trim() : "";
  if (!applicationNumber || !takipImzasi) return reddet(400);

  // Rate limit: IP DEĞİL (paylaşımlı NAT'ta 3 tablet tek IP görünür → IP limiti hepsini boğar),
  // applicationNumber+imza bazlı 30/dk. (Legit tablet 10 sn'de bir yoklar = 6/dk, sınır altında.)
  const rl = checkRateLimit(`basvuru-durum:${applicationNumber}:${takipImzasi}`, {
    windowMs: DK_MS,
    maxAttempts: 30,
  });
  if (!rl.success) {
    return NextResponse.json(
      { error: `Çok fazla istek. ${rl.resetIn} sn sonra tekrar deneyin.` },
      { status: 429, headers: HEADERS },
    );
  }

  // Başvuruyu bul — yalnız id + status (başka alan çekilmez). Yoksa jenerik 404.
  // status EKLENDİ: aday düzeltmesi bekleniyorsa sınav akışına HİÇ girilmez (aşağıya bkz.).
  const basvuru = await prisma.publicJobApplication.findUnique({
    where: { applicationNumber },
    select: { id: true, status: true },
  });
  if (!basvuru) return reddet(404);

  // İmza doğrula (sabit-zaman). Yanlışsa aynı jenerik 403.
  if (!imzaDogrula(basvuru.id, takipImzasi)) return reddet(403);

  // ── DÜZELTME BEKLENİYOR — SIRA KRİTİK: sınav kontrolünden ÖNCE ────────────────
  // Aday düzeltme göndermeden sınava girmemeli; aksi halde aktif bir oturum varsa
  // (ör. daha önce sınav atanmışsa) burada sınav linki dönerdi ve düzeltme gölgede kalırdı.
  //
  // duzeltilecekAlanlar: YALNIZ etiket dizisi. Son geri gönderme geçişinin StageLog
  // note'undan türetilir; ayrıştırma ALAN_ETIKETLERI'ne karşı doğrulanır, İK'nın serbest
  // metni (ayracın sağı) HİÇ okunmaz — bkz. adaya-geri-gonder.ts.
  if (basvuru.status === "ADAYA_GERI_GONDERILDI") {
    const sonGecis = await prisma.publicJobApplicationStageLog.findFirst({
      where: { applicationId: basvuru.id, toStatus: "ADAYA_GERI_GONDERILDI" },
      orderBy: { createdAt: "desc" },
      select: { note: true },
    });
    return NextResponse.json(
      {
        durum: "DUZELTME_BEKLENIYOR",
        duzeltilecekAlanlar: notundanAdayEtiketleri(sonGecis?.note),
      },
      { headers: HEADERS },
    );
  }

  // Aktif oturum TEK KAYNAK (aktifOturumBul) — link yalnız aktif+süresi geçmemişte.
  const aktif = await aktifOturumBul(prisma, basvuru.id, {
    status: true,
    token: true,
    assessment: { select: { name: true } },
  });
  if (aktif) {
    return NextResponse.json(
      {
        durum: aktif.status === "BASLADI" ? "SINAV_BASLADI" : "SINAV_HAZIR",
        sinavAdi: aktif.assessment.name,
        sinavLink: sinavUrl(aktif.token),
      },
      { headers: HEADERS },
    );
  }

  // Aktif yoksa en son tamamlanmış oturum var mı?
  const tamamlanan = await prisma.assessmentSession.findFirst({
    where: { publicJobApplicationId: basvuru.id, status: "TAMAMLANDI" },
    orderBy: { finishedAt: "desc" },
    select: { assessment: { select: { name: true } } },
  });
  if (tamamlanan) {
    return NextResponse.json(
      { durum: "TAMAMLANDI", sinavAdi: tamamlanan.assessment.name },
      { headers: HEADERS },
    );
  }

  // Hiç aktif/tamamlanmış sınav yok → beklemede. Başka HİÇBİR alan dönmez.
  return NextResponse.json({ durum: "BEKLIYOR" }, { headers: HEADERS });
}
