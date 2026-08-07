// Başvuru "kimde bekliyor" — TEK KAYNAK (detay sayfası + liste sütunu aynı kuralı kullanır).
//
// Kural:
//   - Müdür kademesindeki statüler → atanan müdürün adı
//   - Terminal statüler (ISE_BASLADI / REJECTED) → kimsede beklemiyor
//   - Diğer her statü → İnsan Varlıkları
//
// Hangi statünün "müdür kademesi" ve hangisinin "terminal" olduğu ALLOWED_TRANSITIONS'tan
// TÜRETİLİR — sabit statü listesi gömülmez. Matrise statü eklenince burası kendiliğinden
// doğru davranır.

import type { JobApplicationStatus } from "@/generated/prisma";
import { ALLOWED_TRANSITIONS } from "./transitions";

export const IK_ETIKET = "İnsan Varlıkları";
export const IK_KISA = "İV";

// Müdürün geçiş yapabildiği statüler = topun müdürde olduğu statüler.
export function mudurKademesiMi(status: JobApplicationStatus): boolean {
  return (ALLOWED_TRANSITIONS[status]?.MUDUR.length ?? 0) > 0;
}

// Hiçbir rolün geçiş yapamadığı statü = terminal (süreç bitti).
export function terminalMi(status: JobApplicationStatus): boolean {
  const t = ALLOWED_TRANSITIONS[status];
  if (!t) return false;
  return t.IK.length === 0 && t.MUDUR.length === 0;
}

export type BekleyenTaraf =
  | { tip: "MUDUR"; ad: string; kisa: string }
  | { tip: "IK"; ad: string; kisa: string }
  | null; // terminal — bekleme satırı gösterilmez

// mudurAdi: assignedManagerId çözülmüş ad. Müdür kademesindeyiz ama atama yoksa
// (bayat kayıt) İK'ya düşer — "atanmamış" göstermek yerine sahibi belli olsun.
export function bekleyenTaraf(
  status: JobApplicationStatus,
  mudurAdi: string | null,
): BekleyenTaraf {
  if (terminalMi(status)) return null;
  if (mudurKademesiMi(status) && mudurAdi) {
    return { tip: "MUDUR", ad: mudurAdi, kisa: mudurAdi };
  }
  return { tip: "IK", ad: IK_ETIKET, kisa: IK_KISA };
}

// User kaydından görünen ad — recruitment uçlarında tekrarlanan desen.
export function kullaniciAdi(
  u:
    | { name: string | null; firstName: string | null; lastName: string | null; email: string | null }
    | undefined
    | null,
): string | null {
  if (!u) return null;
  const birlesik = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  return birlesik || u.name || u.email || null;
}
