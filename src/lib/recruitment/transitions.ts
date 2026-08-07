// Başvuru Değerlendirme Workflow — durum geçiş izin matrisi + yetki tanımı.
//
// İki rol: İK (recruitment.admin / hr.admin) ve MÜDÜR (başvuruya atanan bölüm müdürü).
// Kaynak: GÖREV tanımı. Geçiş yalnız bu matriste açıkça izin verilen (from → role → to)
// üçlüleri için geçerlidir; matriste olmayan her geçiş reddedilir (deny-by-default).

import type { JobApplicationStatus } from "@/generated/prisma";

export type TransitionRole =
  | "IK"
  | "MUDUR"
  // Mavi yaka zinciri rolleri (additive — MUDUR akışı aynen korunur).
  | "DEGERLENDIRICI"
  | "URETIM_MUDUR_YRD"
  | "FABRIKA_MUDURU";

/** Tüm roller — bekleyen.ts gibi türetim yapan modüller sabit liste gömmesin diye TEK KAYNAK. */
export const TUM_ROLLER: readonly TransitionRole[] = [
  "IK",
  "MUDUR",
  "DEGERLENDIRICI",
  "URETIM_MUDUR_YRD",
  "FABRIKA_MUDURU",
] as const;

// Matris satırı: IK ve MUDUR ZORUNLU (mevcut 18 satır olduğu gibi kalır — hiçbiri
// dokunulmadan derlenir), mavi yaka rolleri OPSİYONEL (yalnız ilgili satırlarda yazılır).
// Böylece yeni rol eklemek 18 satırı şişirmez; okunmayan rol için `?? []` zaten devrede.
type GecisSatiri = { IK: JobApplicationStatus[]; MUDUR: JobApplicationStatus[] } & Partial<
  Record<Exclude<TransitionRole, "IK" | "MUDUR">, JobApplicationStatus[]>
>;

// from durum → { IK: izinli hedefler, MUDUR: izinli hedefler, (opsiyonel yeni roller) }
//
// EXHAUSTIVENESS GUARD: `Record<JobApplicationStatus, ...>` — her statü için anahtar
// ZORUNLU (eksik statü = derleme hatası) ve hedefler JobApplicationStatus[] (geçersiz enum =
// derleme hatası). Böylece enum'a statü eklendiğinde matris güncellenmesi unutulamaz.
// Terminal durumlar boş dizi ({IK:[], MUDUR:[]}) ile açıkça işaretlenir — donmuş kayıt kalmaz.
// Rol belirtilmeyen hedefler İK'ya aittir; MUDUR satırları workflow tasarımıyla korunur.
export const ALLOWED_TRANSITIONS: Record<JobApplicationStatus, GecisSatiri> = {
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
    IK: ["REVIEWING", "MUDUR_DEGERLENDIRME", "DEGERLENDIRICI", "SINAV", "REJECTED"],
    MUDUR: [],
  },
  REVIEWING: {
    // FABRIKA_MUDURU: İK'nın üst onaya gönderme yolu (müdür yrd. onayından dönen başvuruyu
    // gerekli görürse fabrika müdürüne çıkarır). Atama otomatiktir (otomatik-atama.ts).
    IK: ["SHORTLISTED", "MUDUR_DEGERLENDIRME", "DEGERLENDIRICI", "FABRIKA_MUDURU", "SINAV", "REJECTED"],
    MUDUR: [],
  },
  SHORTLISTED: {
    IK: ["MUDUR_DEGERLENDIRME", "DEGERLENDIRICI", "TELEFON_MULAKATI", "SINAV", "REJECTED"],
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
  // ——— Mavi yaka değerlendirme zinciri ———
  // İK → DEGERLENDIRICI → (otomatik) URETIM_MUDUR_YRD → üç yol → (gerekirse) FABRIKA_MUDURU → İK.
  // Her satırda İK'nın geri alma/ret yolu VAR — hiçbiri donmuş statü değil.
  DEGERLENDIRICI: {
    // Değerlendirici karar verir: onaylarsa üretim müdür yrd.'na düşer (atama OTOMATİK), ya da reddeder.
    DEGERLENDIRICI: ["URETIM_MUDUR_YRD", "REJECTED"],
    // İK geri alma / ret. Aynı-statü yeniden atama: değerlendirici yanlış seçildiyse değiştirilebilir.
    IK: ["REVIEWING", "DEGERLENDIRICI", "REJECTED"],
    MUDUR: [],
  },
  URETIM_MUDUR_YRD: {
    // Üç yol: İK'ya onay (REVIEWING) / fabrika müdürüne üst onay (atama OTOMATİK) / ret.
    URETIM_MUDUR_YRD: ["REVIEWING", "FABRIKA_MUDURU", "REJECTED"],
    IK: ["REVIEWING", "REJECTED"],
    MUDUR: [],
  },
  FABRIKA_MUDURU: {
    // Onaylarsa İK'ya döner, ya da reddeder.
    FABRIKA_MUDURU: ["REVIEWING", "REJECTED"],
    IK: ["REVIEWING", "REJECTED"],
    MUDUR: [],
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
  DEGERLENDIRICI: "Değerlendirici İncelemesi",
  URETIM_MUDUR_YRD: "Üretim Müdür Yrd. Onayı",
  FABRIKA_MUDURU: "Fabrika Müdürü Onayı",
};

/**
 * Hedefe geçiş için atanan kişi (assignedManagerId) ZORUNLUDUR — ve bu kişiyi İK SEÇER.
 * Matris-bağımsız yapısal kural (kime atandığı belli olmadan kademe başlayamaz).
 *
 * DİKKAT — bu, "atama gerekli mi" DEĞİL, "İK'nın kişi seçmesi gerekli mi" sorusudur:
 * URETIM_MUDUR_YRD / FABRIKA_MUDURU da atanır, ama atamayı İK değil sistem yapar
 * (bkz. otomatik-atama.ts). O yüzden burada YER ALMAZLAR — UI modalı da kişi sormaz.
 */
export function requiresAssignedManager(to: JobApplicationStatus): boolean {
  return to === "MUDUR_DEGERLENDIRME" || to === "DEGERLENDIRICI";
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
