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
import { ALLOWED_TRANSITIONS, TUM_ROLLER, roluKademedeMi } from "./transitions";

export const IK_ETIKET = "İnsan Varlıkları";
export const IK_KISA = "İV";

// "Atanan kişi" rolleri = yetkisi İK iznine değil, başvurunun ATANDIĞI kişiye bağlı olanlar.
// TUM_ROLLER'dan türetilir — yeni rol eklenince burası kendiliğinden kapsar (sabit liste yok).
const ATANAN_ROLLER = TUM_ROLLER.filter((r) => r !== "IK");

// Atanan kişinin geçiş yapabildiği statüler = topun o kişide olduğu statüler.
// (MUDUR'a ek olarak mavi yaka zinciri rolleri de sayılır; aksi halde yeni statülerde
//  "kimde bekliyor" yanlışlıkla İK gösterirdi.)
export function mudurKademesiMi(status: JobApplicationStatus): boolean {
  return ATANAN_ROLLER.some((r) => roluKademedeMi(status, r));
}

// Faz 5 — "top ŞU AN bu kullanıcıda mı?" Kullanıcının İK DIŞI rollerinden biri bu statüde
// geçiş yapabiliyorsa karar ondadır (müdür, teknik mülakatçı, üst amir... hepsi kapsanır).
// İK rolü SAYILMAZ: İK her statüde bir şeyler yapabilir, o yüzden "sıra sende" anlamı taşımaz.
// Sabit statü/rol listesi YOK — matristen türer.
export function kararSizdeMi(
  status: JobApplicationStatus,
  roller: readonly string[],
): boolean {
  return ATANAN_ROLLER.some((r) => roller.includes(r) && roluKademedeMi(status, r));
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
  | { tip: "ADAY"; ad: string; kisa: string }
  | null; // terminal — bekleme satırı gösterilmez

// ADAYA_GERI_GONDERILDI'da top ADAYDA. Matristen türetilemez: matriste yalnız İK satırı var
// (İK vazgeçip geri alabilir), adayın kendi gönderimi matris DIŞI bir public geçiş
// (api/job-application/route.ts). Bu yüzden tek istisna olarak statü adıyla kontrol edilir.
const ADAY_ETIKET = "Aday";
const ADAY_KISA = "Aday";

// mudurAdi: assignedManagerId çözülmüş ad. Müdür kademesindeyiz ama atama yoksa
// (bayat kayıt) İK'ya düşer — "atanmamış" göstermek yerine sahibi belli olsun.
export function bekleyenTaraf(
  status: JobApplicationStatus,
  mudurAdi: string | null,
): BekleyenTaraf {
  if (terminalMi(status)) return null;
  if (status === "ADAYA_GERI_GONDERILDI") {
    return { tip: "ADAY", ad: ADAY_ETIKET, kisa: ADAY_KISA };
  }
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
