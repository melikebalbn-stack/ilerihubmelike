import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { basvuruTakipImzasi } from "@/lib/recruitment/basvuru-takip";

export const dynamic = "force-dynamic";

// POST /api/public/basvuru-sorgula — Faz 2: adayın başvurusuna GERİ DÖNÜŞ yolu (PUBLIC).
//
// NEDEN VAR: takip imzası ilk gönderimde yalnız React state'te duruyor (paylaşımlı tablet
// gerekçesiyle storage YOK — JobApplicationRenderer.tsx). Aday sekmeyi kapatınca başvurusuna
// dönemiyordu. Bu uç, applicationNumber + tcKimlikNo doğrulaması karşılığında AYNI takip
// imzasını YENİDEN ÜRETİR; aday sonra mevcut /api/public/basvuru-durum akışına girer.
//
// YENİ İMZA MEKANİZMASI YOK: basvuruTakipImzasi (basvuru-takip.ts) yeniden kullanılır —
// HMAC-SHA256(applicationId, NEXTAUTH_SECRET). Sır dışa verilmez, yalnız türevi döner.
//
// ── GÜVENLİK (public/sinav/[token]/route.ts deseni) ──────────────────────────
//   · Rate limit: IP + applicationNumber bileşik anahtar, 5 deneme / 10 dk
//   · UNIFORM HATA: kayıt yok / TC yanlış / rate-limit → AYNI gövde, AYNI kod (403).
//     Hangi alanın yanlış olduğu ASLA söylenmez → başvuru numarası enumerasyonu kapalı.
//   · TC karşılaştırması crypto.timingSafeEqual (sabit zaman)
//   · Kayıt BULUNAMASA BİLE sahte karşılaştırma yapılır → "kayıt var mı" zamanlamadan sızmaz
//   · Yanıtta TC/ad/telefon/statü YOK — yalnız takipImzasi + applicationNumber
//   · noindex / no-store / no-referrer başlıkları

// basvuru-durum/route.ts:12-16 ve assessment/public.ts ile aynı üçlü. Üçüncü kopya
// bilinçli: her public yüzey kendi başlığını yanında taşısın (ortak sabit çıkarmak
// için üç dosyayı birbirine bağlamaya değmez).
const HEADERS = {
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Referrer-Policy": "no-referrer",
} as const;

// TEK ret yolu. Kayıt yok / TC yanlış / rate-limit / geçersiz gövde — HEPSİ buradan döner.
// Gövde ve HTTP kodu TEK; çağıran tarafın ayırt edebileceği hiçbir sinyal yok.
function reddet() {
  return NextResponse.json(
    { error: "Başvuru doğrulanamadı" },
    { status: 403, headers: HEADERS },
  );
}

// TC sabit-zaman karşılaştırma. basvuru-takip.ts:22-27 ile aynı desen:
// uzunluk farkıysa erken false (11 hane herkesçe bilinir, gizli değil).
function tcEsit(beklenenHam: string | null, gelenHam: string): boolean {
  const beklenen = Buffer.from((beklenenHam ?? "").trim());
  const gelen = Buffer.from(gelenHam.trim());
  if (beklenen.length === 0 || beklenen.length !== gelen.length) return false;
  return crypto.timingSafeEqual(beklenen, gelen);
}

// Kayıt bulunamadığında da bir karşılaştırma koştur — "numara var mı yok mu" farkı
// yanıt süresine yansımasın. Sonucu kullanılmaz (void).
function sahteKarsilastirma(gelen: string): void {
  tcEsit("00000000000", gelen);
}

/**
 * Erişim denetimi — mevcut JobApplicationAccessLog tablosu (yeni tablo YOK).
 *
 * KISIT: applicationId ZORUNLU bir FK. Bu yüzden "olmayan başvuru numarası" denemesi
 * bu tabloya YAZILAMAZ (bağlanacak kayıt yok) — şema değişikliği gerekirdi, bu fazın
 * kapsamı dışı. O durum sunucu loguna yazılır. Kaydı bulunan denemeler (doğru/yanlış TC)
 * tabloya düşer. accessedBy zorunlu String, public akışta kullanıcı yok → sabit sentinel.
 */
const PUBLIC_AKTOR = "PUBLIC_BASVURU_SORGULA";

async function erisimLogu(
  applicationId: string,
  accessType: "PUBLIC_SORGULA_OK" | "PUBLIC_SORGULA_RET",
  ipAddress: string | null,
) {
  try {
    await prisma.jobApplicationAccessLog.create({
      data: { applicationId, accessedBy: PUBLIC_AKTOR, accessType, ipAddress },
    });
  } catch {
    // denetim yazımı ana akışı ENGELLEMEZ (assessment logAttempt ile aynı ilke)
  }
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const body = await req.json().catch(() => null);
  const applicationNumber =
    typeof body?.applicationNumber === "string" ? body.applicationNumber.trim() : "";
  const tcKimlikNo = typeof body?.tcKimlikNo === "string" ? body.tcKimlikNo.trim() : "";
  if (!applicationNumber || !tcKimlikNo) return reddet();

  // Rate limit: IP + applicationNumber. Tek IP'den farklı numaraları taramak da,
  // aynı numarayı TC deneyerek zorlamak da bu anahtarla sınırlanır.
  // Eşik aşılınca 429 DEĞİL, aynı 403 döner — "bu numara var" sinyali vermemek için.
  const rl = checkRateLimit(`basvuru-sorgula:${ip}:${applicationNumber}`, {
    windowMs: 10 * 60 * 1000,
    maxAttempts: 5,
  });
  if (!rl.success) return reddet();

  // Yalnız id + tcKimlikNo çekilir; başka HİÇBİR alan okunmaz.
  const basvuru = await prisma.publicJobApplication.findUnique({
    where: { applicationNumber },
    select: { id: true, tcKimlikNo: true },
  });

  if (!basvuru) {
    sahteKarsilastirma(tcKimlikNo);
    // Bağlanacak applicationId olmadığı için tabloya yazılamaz (bkz. erisimLogu yorumu).
    console.warn(
      `[basvuru-sorgula] bilinmeyen basvuru numarasi denemesi · ip=${ip} · no=${applicationNumber}`,
    );
    return reddet();
  }

  if (!tcEsit(basvuru.tcKimlikNo, tcKimlikNo)) {
    await erisimLogu(basvuru.id, "PUBLIC_SORGULA_RET", ip);
    return reddet();
  }

  await erisimLogu(basvuru.id, "PUBLIC_SORGULA_OK", ip);

  // YALNIZ imza + numara döner. TC, ad, telefon, statü, sınav bilgisi BURADAN DÖNMEZ —
  // durum sorgusu ayrı uçtan (/api/public/basvuru-durum) ve o uç da yalnız durum döner.
  return NextResponse.json(
    { applicationNumber, takipImzasi: basvuruTakipImzasi(basvuru.id) },
    { headers: HEADERS },
  );
}
