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
import { ALLOWED_TRANSITIONS, TUM_ROLLER } from "./transitions";

export const IK_ETIKET = "İnsan Varlıkları";
export const IK_KISA = "İV";

// "Atanan kişi" rolleri = yetkisi İK iznine değil, başvurunun ATANDIĞI kişiye bağlı olanlar.
// TUM_ROLLER'dan türetilir — yeni rol eklenince burası kendiliğinden kapsar (sabit liste yok).
const ATANAN_ROLLER = TUM_ROLLER.filter((r) => r !== "IK");

// Atanan kişinin geçiş yapabildiği statüler = topun o kişide olduğu statüler.
// (MUDUR'a ek olarak mavi yaka zinciri rolleri de sayılır; aksi halde yeni statülerde
//  "kimde bekliyor" yanlışlıkla İK gösterirdi.)
export function mudurKademesiMi(status: JobApplicationStatus): boolean {
  const t = ALLOWED_TRANSITIONS[status];
  if (!t) return false;
  return ATANAN_ROLLER.some((r) => (t[r]?.length ?? 0) > 0);
}

// Hiçbir rolün geçiş yapamadığı statü = terminal (süreç bitti).
// TÜM roller taranır — yeni bir rol tek çıkış yolu olsa bile statü yanlışlıkla
// "terminal" sayılmaz.
export function terminalMi(status: JobApplicationStatus): boolean {
  const t = ALLOWED_TRANSITIONS[status];
  if (!t) return false;
  return TUM_ROLLER.every((r) => (t[r]?.length ?? 0) === 0);
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
