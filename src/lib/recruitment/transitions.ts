// Başvuru Değerlendirme Workflow — durum geçiş izin matrisi + yetki tanımı.
//
// İki rol: İK (recruitment.admin / hr.admin) ve MÜDÜR (başvuruya atanan bölüm müdürü).
// Kaynak: GÖREV tanımı. Geçiş yalnız bu matriste açıkça izin verilen (from → role → to)
// üçlüleri için geçerlidir; matriste olmayan her geçiş reddedilir (deny-by-default).

import type { JobApplicationStatus } from "@/generated/prisma";

export type TransitionRole = "IK" | "MUDUR";

// from durum → { IK: izinli hedefler, MUDUR: izinli hedefler }
//
// EXHAUSTIVENESS GUARD: `satisfies Record<JobApplicationStatus, ...>` — her statü için anahtar
// ZORUNLU (eksik statü = derleme hatası) ve hedefler JobApplicationStatus[] (geçersiz enum =
// derleme hatası). Böylece enum'a statü eklendiğinde matris güncellenmesi unutulamaz.
// Terminal durumlar boş dizi ({IK:[], MUDUR:[]}) ile açıkça işaretlenir — donmuş kayıt kalmaz.
// Rol belirtilmeyen hedefler İK'ya aittir; MUDUR satırları workflow tasarımıyla korunur.
export const ALLOWED_TRANSITIONS: Record<
  JobApplicationStatus,
  { IK: JobApplicationStatus[]; MUDUR: JobApplicationStatus[] }
> = {
  // Intake (matris-öncesi) durumlar — İK bayat/askıda kayıtları ileri taşıyabilir.
  CONSENT_PENDING: {
    IK: ["PENDING", "REJECTED"],
    MUDUR: [],
  },
  HEALTH_PENDING: {
    IK: ["PENDING", "REVIEWING", "REJECTED"],
    MUDUR: [],
  },
  PENDING: {
    IK: ["REVIEWING", "MUDUR_DEGERLENDIRME", "SINAV", "REJECTED"],
    MUDUR: [],
  },
  REVIEWING: {
    IK: ["SHORTLISTED", "MUDUR_DEGERLENDIRME", "SINAV", "REJECTED"],
    MUDUR: [],
  },
  SHORTLISTED: {
    IK: ["MUDUR_DEGERLENDIRME", "TELEFON_MULAKATI", "SINAV", "REJECTED"],
    MUDUR: [],
  },
  TELEFON_MULAKATI: {
    // İK geri alma: REVIEWING (süreci baştan yönetsin).
    IK: ["IK_MULAKATI", "SINAV", "MUDUR_DEGERLENDIRME", "REVIEWING", "REJECTED"],
    MUDUR: [],
  },
  MUDUR_DEGERLENDIRME: {
    // Müdür değerlendirir; İK her zaman geri alabilir/reddedebilir/yeniden atayabilir.
    // D4: İK aynı duruma geçebilir → müdür yanlış atandıysa yeniden atama (assignedManagerId zorunlu).
    // İK geri alma: REVIEWING, SINAV.
    MUDUR: ["MUDUR_MULAKATI", "SINAV", "REJECTED"],
    IK: ["REJECTED", "MUDUR_DEGERLENDIRME", "REVIEWING", "SINAV"],
  },
  MUDUR_MULAKATI: {
    MUDUR: ["SINAV", "REJECTED"],
    // İK geri alma: REVIEWING, MUDUR_DEGERLENDIRME.
    IK: ["SINAV", "REJECTED", "REVIEWING", "MUDUR_DEGERLENDIRME"],
  },
  SINAV: {
    // 'SINAV' → 'SINAV': İK sınavı DEĞİŞTİREBİLİR (assessmentId zorunlu). Müdür değiştiremez.
    // İK geri alma: REVIEWING, MUDUR_DEGERLENDIRME.
    IK: ["SINAV", "TEKNIK_MULAKAT", "IK_MULAKATI", "TEKLIF", "REVIEWING", "MUDUR_DEGERLENDIRME", "REJECTED"],
    MUDUR: [],
  },
  IK_MULAKATI: {
    // İK geri alma: REVIEWING.
    IK: ["TEKNIK_MULAKAT", "MUDUR_MULAKATI", "TEKLIF", "REVIEWING", "REJECTED"],
    MUDUR: [],
  },
  TEKNIK_MULAKAT: {
    // İK geri alma: REVIEWING.
    IK: ["TEKLIF", "MUDUR_MULAKATI", "REVIEWING", "REJECTED"],
    MUDUR: [],
  },
  TEKLIF: {
    // İK geri alma: IK_MULAKATI, REVIEWING (teklif geri çekilip sürece dönebilir).
    IK: ["TEKLIF_KABUL", "IK_MULAKATI", "REVIEWING", "REJECTED"],
    MUDUR: [],
  },
  TEKLIF_KABUL: {
    IK: ["ISE_BASLADI", "REJECTED"],
    MUDUR: [],
  },
  ISE_BASLADI: {
    // Terminal.
    IK: [],
    MUDUR: [],
  },
  REJECTED: {
    // Terminal — geçiş yok.
    IK: [],
    MUDUR: [],
  },
  // Eski enum kaçış yolları — yalnız bayat kayıtlar sıkışmasın diye (İK).
  REVIEWED: {
    IK: ["REVIEWING", "REJECTED"],
    MUDUR: [],
  },
  INTERVIEW: {
    IK: ["IK_MULAKATI", "REJECTED"],
    MUDUR: [],
  },
  ACCEPTED: {
    IK: ["TEKLIF_KABUL", "REJECTED"],
    MUDUR: [],
  },
};

// UI ve bildirim metinleri için TR etiketler (ham enum yerine).
// Yalnız bu workflow'da geçen durumlar; tam enum listesi UI'da ayrıca olabilir.
export const STATUS_LABELS_TR: Record<JobApplicationStatus, string> = {
  CONSENT_PENDING: "KVKK Onayı Bekliyor",
  HEALTH_PENDING: "Sağlık Beyanı Bekliyor",
  PENDING: "İK İncelemesi Bekliyor",
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

/**
 * SINAV hedefine geçiş için sınav seçimi (assessmentId) ZORUNLUDUR — geçişle aynı anda
 * aday sınav oturumu açılır. requiresAssignedManager / requiresRejectionReason ile aynı
 * desende yapısal kural (matris-bağımsız, TEK KAYNAK).
 */
export function requiresAssessment(to: JobApplicationStatus): boolean {
  return to === "SINAV";
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
