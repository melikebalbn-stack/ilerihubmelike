// Başvuru TASLAK statüleri — TEK KAYNAK.
//
// Taslak = aday akışı başlattı ama tam başvuru formunu GÖNDERMEDİ:
//   CONSENT_PENDING → KVKK onayı verildi, sağlık beyanı bekliyor
//   HEALTH_PENDING  → sağlık beyanı verildi, başvuru formu bekliyor
// Tam submit'te statü PENDING olur (bkz. api/job-application/route.ts).
//
// NEDEN TEK DOSYA: bu küme eskiden iki yerde AYRI tanımlıydı — metrics/dashboard
// taslakları hariç tutuyordu, liste ucu tutmuyordu. Sonuç: İK listesinde görünen
// başvuru sayısı ile dashboard'daki sayı taslak kadar ayrışıyordu ve İK yarım kalmış
// bir kaydı tamamlanmış başvuru sanabiliyordu. Dizi KOPYALANMAZ; iki taraf da buradan alır.
//
// Statü adlarının okunabilir TR karşılıkları transitions.ts → STATUS_LABELS_TR'de
// (burada etiket TUTULMAZ, tek kaynak orası).

import type { JobApplicationStatus } from "@/generated/prisma";

/** Sıralı dizi — Prisma `notIn` / `in` filtreleri ve UI seçenek üretimi için. */
export const TASLAK_STATULER: JobApplicationStatus[] = [
  "CONSENT_PENDING",
  "HEALTH_PENDING",
];

/** Hızlı üyelik testi (metrik hesaplarında satır satır kullanılır). */
export const TASLAK = new Set<string>(TASLAK_STATULER);

/** Statü taslak mı (form gönderilmemiş)? */
export function taslakMi(status: string | null | undefined): boolean {
  return !!status && TASLAK.has(status);
}
