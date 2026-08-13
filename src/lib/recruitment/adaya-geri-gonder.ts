// "Adaya Geri Gönder" — sunucu tarafı kurallar. TEK KAYNAK.
//
// İK, başvuru formunda eksik/hatalı alan görünce kaydı adaya geri gönderir; aday TÜM formu
// yeniden doldurup gönderince statü PENDING'e döner. Önceki form hâli SAKLANMAZ.
//
// Bu modül üç şeyi tek yerde tutar:
//   1) ENV BAYRAĞI  — enum değeri deploy edilir ama ilk gün kayıt düşmez (rollback güvenliği)
//   2) NOT FORMATI  — StageLog.note'a yazılan "Eksik alanlar: ... | <İK notu>" biçimi
//   3) AYRIŞTIRMA   — adaya YALNIZ etiketler döner; İK'nın serbest metni ASLA dışa çıkmaz
//
// Neden ayrı dosya: taslak-statuler.ts ile aynı gerekçe — üç çağıran (transition route,
// stage-log route, public basvuru-durum) aynı kuralı kopyalamasın.
//
// SUNUCU-TARAFI: bayrak okuması `process.env` üzerinden yapılır (mevcut kill-switch deseni:
// api/overtime/[id]/test-approve-all/route.ts:20, api/backups/restore/[id]/route.ts:44).
// Bu modülü CLIENT bileşenden import ETME — bundle'da bayrak `undefined` görünür.

import type { JobApplicationStatus } from "@/generated/prisma";
import { ALAN_ETIKETLERI, DUZENLENEBILIR_ALANLAR } from "@/lib/recruitment/basvuru-duzeltme-alanlari";

/** Bayrak adı — ops dokümanı ve route'lar aynı sabiti kullansın. */
export const GERI_GONDER_ENV = "RECRUITMENT_ADAYA_GERI_GONDER_ENABLED";

/**
 * Özellik açık mı? VARSAYILAN KAPALI.
 *
 * NEDEN BAYRAK: ADAYA_GERI_GONDERILDI yeni bir enum değeri. Blue-green'de deploy sonrası
 * pasif slot hâlâ ESKİ Prisma client ile çalışıyor ve bu değeri tanımıyor; rollback
 * penceresinde bu statüye kayıt düşmüşse eski slot o kaydı okurken patlar.
 * Bayrak kapalıyken enum DB'ye gider ama hiçbir kayıt o statüye geçemez → rollback güvenli.
 * Pencere kapandıktan sonra env 'true' yapılır (uygulama restart'ı yeter, migration YOK).
 */
export function geriGondermeAcikMi(): boolean {
  return process.env[GERI_GONDER_ENV] === "true";
}

/**
 * İzinli hedefleri bayrağa göre süz. Bayrak kapalıyken ADAYA_GERI_GONDERILDI listede
 * GÖRÜNMEZ → UI butonu çizmez, stage-log ucu hedefi dönmez.
 * (Gerçek engelleme geçiş anında ayrıca yapılır — bkz. geriGondermeEngeli.)
 */
export function bayragaGoreSuz(hedefler: JobApplicationStatus[]): JobApplicationStatus[] {
  if (geriGondermeAcikMi()) return hedefler;
  return hedefler.filter((t) => t !== "ADAYA_GERI_GONDERILDI");
}

/**
 * Geçiş anındaki kapı. Hedef ADAYA_GERI_GONDERILDI ve bayrak kapalıysa engel metni döner;
 * aksi halde null. Route bunu 403'e çevirir (UI disabled tek başına yeterli değil).
 */
export function geriGondermeEngeli(to: JobApplicationStatus): string | null {
  if (to !== "ADAYA_GERI_GONDERILDI") return null;
  if (geriGondermeAcikMi()) return null;
  return "Adaya geri gönderme şu an kapalı (sunucu ayarı).";
}

// ── Not formatı ───────────────────────────────────────────────────────────────
// "Eksik alanlar: Cep Telefonu, Doğum Yeri | Telefonu okunmuyor, teyit edin"
//   · SOL taraf  → adaya gider (yalnız etiketler)
//   · SAĞ taraf  → İK iç notu, adaya ASLA gitmez
// Ayraç olarak mevcut zenginleştirme deseninin ayracı kullanılır (stage-log.ts: " | ").

const ONEK = "Eksik alanlar: ";
const AYRAC = " | ";

/** Beyaz listede olmayan alan adını sessizce düşür (güvenli varsayılan). */
function beyazListedeMi(alan: string): alan is keyof typeof ALAN_ETIKETLERI {
  return (DUZENLENEBILIR_ALANLAR as string[]).includes(alan);
}

/** Alan adlarını TR etiketlere çevir — beyaz liste dışı olanlar düşer, sıra korunur. */
export function alanEtiketleri(alanlar: string[]): string[] {
  const gorulen = new Set<string>();
  const out: string[] = [];
  for (const a of alanlar) {
    if (!beyazListedeMi(a) || gorulen.has(a)) continue;
    gorulen.add(a);
    out.push(ALAN_ETIKETLERI[a]);
  }
  return out;
}

/**
 * StageLog.note metnini kur. Alan seçimi YOKSA yalnız serbest metin yazılır.
 * Etiketler beyaz listeden geldiği için not'a keyfi bir alan adı sızamaz.
 */
export function geriGondermeNotu(args: { alanlar: string[]; ikNotu?: string | null }): string {
  const etiketler = alanEtiketleri(args.alanlar);
  const sol = etiketler.length ? `${ONEK}${etiketler.join(", ")}` : "";
  const sag = (args.ikNotu ?? "").trim();
  if (sol && sag) return `${sol}${AYRAC}${sag}`;
  return sol || sag;
}

/**
 * Adaya gösterilecek etiketleri not'tan geri çıkar.
 *
 * GÜVENLİK: yalnız "Eksik alanlar: " önekiyle başlayan İLK parçayı okur ve her parçayı
 * ALAN_ETIKETLERI değerlerine karşı DOĞRULAR. Yani not elle bozulsa/başka metin girse bile
 * dışarı yalnız bilinen etiketler çıkar; İK'nın serbest metni (ayracın sağı) HİÇ okunmaz.
 */
export function notundanAdayEtiketleri(note: string | null | undefined): string[] {
  if (!note) return [];
  const ilkParca = note.split(AYRAC)[0] ?? "";
  if (!ilkParca.startsWith(ONEK)) return [];
  const gecerli = new Set<string>(Object.values(ALAN_ETIKETLERI));
  return ilkParca
    .slice(ONEK.length)
    .split(",")
    .map((s) => s.trim())
    .filter((s) => gecerli.has(s));
}
