import { normalizeTr } from "@/lib/normalize-tr";

/**
 * Proje Takip fiyat görünürlüğü — Melih Bey'in iş kuralı (2026-09-28).
 * Sadece ADMIN/SUPER_ADMIN ve aşağıdaki bölümler fiyat alanlarını görür/yazar.
 * Kural sunucu tarafında uygulanır (sayfa verisi + create/PATCH data'sı);
 * UI'da gizlemek tek başına yeterli değil.
 *
 * İleride eklenecek rapor fiyat özetleri ve Excel/PDF export da bu kurala tabidir.
 *
 * Bu dosya SAF ve client-safe (Prisma/DB import'u YOK) — client component'ler
 * (ProjeDetayForm) buradan import ediyor. DB'den Personnel çeken
 * resolveCanSeeProjeFiyat() → can-see-fiyat.server.ts.
 */

const FIYAT_GORUNUR_BOLUMLER = [
  "Mühendislik Müdürlüğü",
  "Satış & Pazarlama Müdürlüğü",
  "GENEL MÜDÜRLÜK", // "Yönetim" - DB'de bu isimle yok, daha önce canlı sorguyla doğrulanmış en yakın karşılık
] as const;

// Kısıta tabi alanlar — tek kaynak (sayfa, form ve create/PATCH map'i bunu kullanır).
export const PROJE_FIYAT_ALANLARI = [
  "prototipFiyati",
  "prototipParaBirimi",
  "nre",
  "nreParaBirimi",
  "birimFiyat",
  "birimFiyatParaBirimi",
  "hedefYillik",
  "kalipTutar",
] as const;

export type ProjeFiyatAlani = (typeof PROJE_FIYAT_ALANLARI)[number];

export type ProjeFiyatKullanici = {
  role: string;
  personnel: { bolum: string | null } | null;
};

export function canSeeProjeFiyat(user: ProjeFiyatKullanici): boolean {
  if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return true;
  const bolum = normalizeTr(user.personnel?.bolum ?? "");
  return FIYAT_GORUNUR_BOLUMLER.some((b) => normalizeTr(b) === bolum);
}

// Fiyat alanlarını objeden tamamen çıkarır (null değil, key'in kendisi gitmez).
export function fiyatAlanlariniCikar<T extends Record<string, unknown>>(
  obj: T
): Omit<T, ProjeFiyatAlani> {
  const kopya: Record<string, unknown> = { ...obj };
  for (const alan of PROJE_FIYAT_ALANLARI) delete kopya[alan];
  return kopya as Omit<T, ProjeFiyatAlani>;
}
