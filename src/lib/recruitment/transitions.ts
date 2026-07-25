// Başvuru Değerlendirme Workflow — durum geçiş izin matrisi + yetki tanımı.
//
// İki rol: İK (recruitment.admin / hr.admin) ve MÜDÜR (başvuruya atanan bölüm müdürü).
// Kaynak: GÖREV tanımı. Geçiş yalnız bu matriste açıkça izin verilen (from → role → to)
// üçlüleri için geçerlidir; matriste olmayan her geçiş reddedilir (deny-by-default).

import type { JobApplicationStatus } from "@/generated/prisma";

export type TransitionRole = "IK" | "MUDUR";

// from durum → { IK: izinli hedefler, MUDUR: izinli hedefler }
// Listede olmayan `from` durumları (ör. ACCEPTED, ISE_BASLADI) hiçbir geçişe izin vermez.
export const ALLOWED_TRANSITIONS: Partial<
  Record<JobApplicationStatus, { IK: JobApplicationStatus[]; MUDUR: JobApplicationStatus[] }>
> = {
  PENDING: {
    IK: ["REVIEWING", "MUDUR_DEGERLENDIRME", "SINAV", "REJECTED"],
    MUDUR: [],
  },
  REVIEWING: {
    IK: ["MUDUR_DEGERLENDIRME", "SINAV", "REJECTED"],
    MUDUR: [],
  },
  MUDUR_DEGERLENDIRME: {
    // Müdür değerlendirir; İK her zaman geri alabilir/reddedebilir.
    // D4: İK aynı duruma geçebilir → müdür yanlış atandıysa yeniden atama (assignedManagerId zorunlu).
    MUDUR: ["MUDUR_MULAKATI", "SINAV", "REJECTED"],
    IK: ["REJECTED", "MUDUR_DEGERLENDIRME"],
  },
  MUDUR_MULAKATI: {
    MUDUR: ["SINAV", "REJECTED"],
    IK: ["SINAV", "REJECTED"],
  },
  SINAV: {
    IK: ["TEKNIK_MULAKAT", "IK_MULAKATI", "TEKLIF", "REJECTED"],
    MUDUR: [],
  },
  REJECTED: {
    // Terminal — geçiş yok.
    IK: [],
    MUDUR: [],
  },
};

// UI ve bildirim metinleri için TR etiketler (ham enum yerine).
// Yalnız bu workflow'da geçen durumlar; tam enum listesi UI'da ayrıca olabilir.
export const STATUS_LABELS_TR: Record<JobApplicationStatus, string> = {
  CONSENT_PENDING: "KVKK Onayı Bekliyor",
  HEALTH_PENDING: "Sağlık Beyanı Bekliyor",
  PENDING: "Beklemede",
  REVIEWED: "İncelendi",
  REVIEWING: "İnceleniyor",
  SHORTLISTED: "Ön Eleme",
  INTERVIEW: "Mülakata Çağrıldı",
  SINAV: "Sınav",
  TELEFON_MULAKATI: "Telefon Mülakatı",
  IK_MULAKATI: "İK Mülakatı",
  TEKNIK_MULAKAT: "Teknik Mülakat",
  TEKLIF: "Teklif",
  TEKLIF_KABUL: "Teklif Kabul Edildi",
  ISE_BASLADI: "İşe Başladı",
  ACCEPTED: "Kabul Edildi",
  REJECTED: "Reddedildi",
  MUDUR_DEGERLENDIRME: "Müdür Değerlendirmesi",
  MUDUR_MULAKATI: "Müdür Mülakatı",
};

/**
 * MUDUR_DEGERLENDIRME hedefine geçiş için atanan müdür (assignedManagerId) ZORUNLUDUR.
 * Bu, matris-bağımsız yapısal bir kuraldır (kime atandığı belli olmadan müdür kademesi başlayamaz).
 */
export function requiresAssignedManager(to: JobApplicationStatus): boolean {
  return to === "MUDUR_DEGERLENDIRME";
}

/**
 * REJECTED hedefine geçiş için ret nedeni (rejectionReasonId) ZORUNLUDUR.
 * Kök-neden/analitik için: her ret bir nedene bağlanmalı. requiresAssignedManager
 * ile aynı desende yapısal kural (matris-bağımsız, TEK KAYNAK).
 */
export function requiresRejectionReason(to: JobApplicationStatus): boolean {
  return to === "REJECTED";
}

/** (from, to, role) üçlüsü izin matrisinde var mı. */
export function canTransition(
  from: JobApplicationStatus,
  to: JobApplicationStatus,
  role: TransitionRole,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.[role]?.includes(to) ?? false;
}

/** Bir durumdan, verilen rolün geçebileceği hedeflerin listesi (boş olabilir). */
export function allowedTargets(
  from: JobApplicationStatus,
  role: TransitionRole,
): JobApplicationStatus[] {
  return ALLOWED_TRANSITIONS[from]?.[role] ?? [];
}

// D1: Bir kullanıcı birden çok role sahip olabilir (hem İK hem atanan müdür).
// Bu iki fonksiyon UNION otoritesidir — route kendi içinde union hesaplamaz.

/** Verilen rollerin herhangi birinin izin verdiği hedeflerin DISTINCT birleşimi. */
export function allowedTargetsForRoles(
  from: JobApplicationStatus,
  roles: TransitionRole[],
): JobApplicationStatus[] {
  const set = new Set<JobApplicationStatus>();
  for (const role of roles) {
    for (const t of allowedTargets(from, role)) set.add(t);
  }
  return [...set];
}

/** Rollerden EN AZ BİRİ (from → to) geçişine izin veriyor mu. */
export function canTransitionAny(
  from: JobApplicationStatus,
  to: JobApplicationStatus,
  roles: TransitionRole[],
): boolean {
  return roles.some((role) => canTransition(from, to, role));
}
