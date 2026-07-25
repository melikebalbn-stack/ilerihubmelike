import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { imzaDogrula } from "@/lib/recruitment/basvuru-takip";
import { AKTIF_OTURUM_STATUS, sinavUrl } from "@/lib/recruitment/assessment-session";

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

  // Başvuruyu bul — yalnız id (başka alan çekilmez). Yoksa jenerik 404.
  const basvuru = await prisma.publicJobApplication.findUnique({
    where: { applicationNumber },
    select: { id: true },
  });
  if (!basvuru) return reddet(404);

  // İmza doğrula (sabit-zaman). Yanlışsa aynı jenerik 403.
  if (!imzaDogrula(basvuru.id, takipImzasi)) return reddet(403);

  // Oturumlar — en yeni önce. Aktif (ATANDI/BASLADI) + süresi geçmemiş varsa link ver.
  const oturumlar = await prisma.assessmentSession.findMany({
    where: { publicJobApplicationId: basvuru.id },
    orderBy: { assignedAt: "desc" },
    select: {
      status: true,
      token: true,
      expiresAt: true,
      assessment: { select: { name: true } },
    },
  });

  const now = new Date();
  const aktif = oturumlar.find((o) => AKTIF_OTURUM_STATUS.has(o.status) && o.expiresAt > now);
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

  const tamamlanan = oturumlar.find((o) => o.status === "TAMAMLANDI");
  if (tamamlanan) {
    return NextResponse.json(
      { durum: "TAMAMLANDI", sinavAdi: tamamlanan.assessment.name },
      { headers: HEADERS },
    );
  }

  // Hiç aktif/tamamlanmış sınav yok → beklemede. Başka HİÇBİR alan dönmez.
  return NextResponse.json({ durum: "BEKLIYOR" }, { headers: HEADERS });
}
