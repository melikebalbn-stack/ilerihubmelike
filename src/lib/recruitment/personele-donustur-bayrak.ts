// Faz 6 kill switch — "Personele Dönüştür" akışı.
//
// Faz 1 (adaya-geri-gonder.ts) ve Faz 4 (teknik-mulakat-bayrak.ts) ile BİREBİR aynı desen:
// bayrak KAPALIYKEN yeni enum değeri (EVRAK_HAZIRLIK) hedef listesinden düşer ve geçiş/dönüşüm
// uçları 403 verir. Gerekçe blue-green rollback penceresi: migration önce gider, kod sonra;
// swap geri alınırsa ESKİ kod yeni enum değerini tanımaz. Bayrak, veri o pencerede yeni
// değere HİÇ yazılmasın diye vardır. Enum değeri DB'den ASLA düşürülmez (cast/veri kaybı).

import type { JobApplicationStatus } from "@/generated/prisma";

export const DONUSTUR_ENV = "RECRUITMENT_PERSONELE_DONUSTUR_ENABLED";

/** Bayrak açık mı? Varsayılan KAPALI — değişken tanımsızsa false. */
export function donusturAcikMi(): boolean {
  return process.env[DONUSTUR_ENV] === "true";
}

/** Bayrak kapalıyken EVRAK_HAZIRLIK hedefini listeden düşürür (UI butonu çizilmez). */
export function donusturSuz(hedefler: JobApplicationStatus[]): JobApplicationStatus[] {
  if (donusturAcikMi()) return hedefler;
  return hedefler.filter((h) => h !== "EVRAK_HAZIRLIK");
}

/**
 * Geçiş/dönüşüm ucunda sunucu-taraflı kapı. Engel varsa mesaj, yoksa null döner.
 * `zorunlu: true` → hedeften bağımsız kapı (dönüşüm ucunun tamamı kapalı).
 */
export function donusturEngeli(
  to: JobApplicationStatus | null,
  zorunlu = false,
): string | null {
  if (donusturAcikMi()) return null;
  // ISE_BASLADI burada YOK: ona giden tek yol dönüşüm ucudur ve o uç `zorunlu: true`
  // ile zaten kapanır. Burada da engellemek, bayrak kapalıyken /transition'dan gelen
  // ISE_BASLADI denemesine "özellik kapalı" dedirtirdi — oysa doğru cevap her zaman
  // "bu geçiş yalnız Personele Dönüştür formuyla yapılır" (bayraktan bağımsız kural).
  if (zorunlu || to === "EVRAK_HAZIRLIK") {
    return "Personele dönüştürme şu an kapalı (sunucu ayarı).";
  }
  return null;
}
