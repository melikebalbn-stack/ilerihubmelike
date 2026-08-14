// Teknik mülakat 2. kademe — ENV BAYRAĞI. TEK KAYNAK.
//
// adaya-geri-gonder.ts'teki Faz 1 bayrak deseninin BİREBİR izdüşümü:
//   geriGondermeAcikMi / bayragaGoreSuz / geriGondermeEngeli
//     ↓
//   ikiKademeAcikMi   / bayragaGoreSuz  / ikiKademeEngeli
//
// NEDEN BAYRAK: TEKNIK_MULAKAT_UST_ONAY yeni bir enum değeri. Blue-green'de deploy
// sonrası PASİF slot hâlâ eski Prisma client ile çalışır ve bu değeri TANIMAZ; rollback
// penceresinde bu statüye kayıt düşmüşse eski slot o kaydı okurken bozulur.
// Bayrak kapalıyken enum DB'ye gider ama hiçbir kayıt o statüye geçemez → rollback güvenli.
// Pencere kapandıktan sonra env 'true' yapılır (uygulama restart'ı yeter, migration YOK).
//
// SUNUCU-TARAFI: bu modülü CLIENT bileşenden import ETME — bundle'da bayrak `undefined`
// görünür. Client, butonlarını sunucudan gelen allowedTargets'tan türetir.

import type { JobApplicationStatus } from "@/generated/prisma";

/** Bayrak adı — ops dokümanı ve route'lar aynı sabiti kullansın. */
export const IKI_KADEME_ENV = "RECRUITMENT_TEKNIK_MULAKAT_2KADEME_ENABLED";

/** Özellik açık mı? VARSAYILAN KAPALI. */
export function ikiKademeAcikMi(): boolean {
  return process.env[IKI_KADEME_ENV] === "true";
}

/**
 * İzinli hedefleri bayrağa göre süz. Kapalıyken TEKNIK_MULAKAT_UST_ONAY listede
 * GÖRÜNMEZ → UI butonu çizmez, stage-log ucu hedefi dönmez.
 */
export function ikiKademeSuz(hedefler: JobApplicationStatus[]): JobApplicationStatus[] {
  if (ikiKademeAcikMi()) return hedefler;
  return hedefler.filter((t) => t !== "TEKNIK_MULAKAT_UST_ONAY");
}

/**
 * Geçiş anındaki kapı. Hedef TEKNIK_MULAKAT_UST_ONAY ve bayrak kapalıysa engel metni
 * döner; aksi halde null. Route bunu 403'e çevirir (UI disabled tek başına yetmez).
 */
export function ikiKademeEngeli(to: JobApplicationStatus): string | null {
  if (to !== "TEKNIK_MULAKAT_UST_ONAY") return null;
  if (ikiKademeAcikMi()) return null;
  return "Teknik mülakat 2. kademe şu an kapalı (sunucu ayarı).";
}
