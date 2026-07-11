import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public sınav yüzeyi ortak güvenlik yardımcıları (Faz 2).

// Güvenlik başlıkları: token URL'de → Referer sızıntısı engellenir, indexlenmez, cache'lenmez.
export const PUBLIC_SINAV_HEADERS = {
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "no-store, no-cache, must-revalidate",
} as const;

export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

// UNIFORM hata: "token yok" / "süresi dolmuş" / "tamamlanmış" AYIRT EDİLMEZ.
// Hepsi aynı mesaj + aynı status → geçerli token varlığı sızmaz.
export function invalidSinavResponse() {
  return NextResponse.json(
    { error: "Bu sınav bağlantısı geçersiz veya artık kullanılamıyor." },
    { status: 404, headers: PUBLIC_SINAV_HEADERS },
  );
}

// Attempt log — public akış (accessedBy YOK). Ham token SAKLANMAZ.
// Hata olsa bile ana akışı bozmaz (best-effort).
export async function logAttempt(
  action: "OPEN" | "SUBMIT" | "INVALID_TOKEN" | "EXPIRED" | "ALREADY_DONE" | "TIMEOUT",
  ipAddress: string,
  sessionId: string | null,
) {
  try {
    await prisma.assessmentAttemptLog.create({ data: { action, ipAddress, sessionId } });
  } catch {
    // audit log yazımı ana akışı engellemez
  }
}
