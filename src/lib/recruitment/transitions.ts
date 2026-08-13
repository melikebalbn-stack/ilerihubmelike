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
  // PENDING = "İV Ön İnceleme". ADAYA_GERI_GONDERILDI: formda eksik/hata varsa İK adaya
  // geri gönderir (bkz. adaya-geri-gonder.ts — env bayrağı kapalıyken hedef listelenmez).
  PENDING: {
    IK: ["REVIEWING", "ADAYA_GERI_GONDERILDI", "MUDUR_DEGERLENDIRME", "SINAV", "REJECTED"],
    MUDUR: [],
  },
  REVIEWING: {
    IK: ["SHORTLISTED", "ADAYA_GERI_GONDERILDI", "MUDUR_DEGERLENDIRME", "SINAV", "REJECTED"],
    MUDUR: [],
  },
  // Aday düzeltme bekliyor. İK vazgeçip geri alabilir ya da reddedebilir; adayın kendi
  // gönderimi bu matristen GEÇMEZ (public geçiş — api/job-application/route.ts).
  ADAYA_GERI_GONDERILDI: {
    IK: ["PENDING", "REJECTED"],
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
  // ——— Mavi yaka değerlendirme zinciri — EMEKLİ (Faz 1) ———
  // Zincirin giriş koşulu YAKA AYRIMI idi; işe alım akışında yaka ayrımı kaldırıldı
  // (yaka artık yalnız işbaşında Personnel.yakaRengi olarak girilir). Zincire giren yol
  // kalmadığı için üç statü de ULAŞILAMAZ. Aynı işi Teknik Mülakat iki kademe GENEL olarak
  // yapacak (kişi seçimi + otomatik üst amir).
  //
  // ENUM'DAN SİLİNMEDİ: FABRIKA_MUDURU'nun PublicJobApplicationStageLog'da 2 satırı var
  // (REVIEWING→FABRIKA_MUDURU ve FABRIKA_MUDURU→REVIEWING); enum daraltma bu tarihsel
  // satırları cast edemez → veri kaybı. Ayrıca blue-green'de pasif slotun Prisma client'ı
  // DB ile uyumsuz kalır ve rollback yolu kapanır.
  //
  // DİKKAT — boş satırın sonucu: terminalMi() bu statüler için true döner (bekleyen.ts:34-38),
  // yani bu statülere kayıt düşerse DONAR (çıkış yolu yok). Bugün etkisiz: DEGERLENDIRICI 0,
  // URETIM_MUDUR_YRD 0, FABRIKA_MUDURU 0 kayıt (StageLog'daki 2 satır geçmiş, açık kayıt değil).
  // Zincir yeniden açılacaksa satırlar geri doldurulmalı.
  DEGERLENDIRICI: {
    IK: [],
    MUDUR: [],
  },
  URETIM_MUDUR_YRD: {
    IK: [],
    MUDUR: [],
  },
  FABRIKA_MUDURU: {
    IK: [],
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
  // ——— Eski enum artıkları — EMEKLİ (Faz 1) ———
  // Matriste hiçbir geçişin hedefi değiller ve prod'da 0 kayıt taşıyorlar; StageLog'un
  // 143 satırında da hiç geçmiyorlar. Kaçış yolları da kaldırıldı → tamamen ulaşılamaz.
  // ENUM'DAN SİLİNMEDİ (yukarıdaki gerekçenin aynısı: blue-green rollback + cast riski).
  //
  // DİKKAT: boş satır → terminalMi() true (bekleyen.ts:34-38). Bu statülere kayıt düşerse
  // DONAR. Bugün etkisiz — üçünde de 0 kayıt var.
  REVIEWED: {
    IK: [],
    MUDUR: [],
  },
  INTERVIEW: {
    IK: [],
    MUDUR: [],
  },
  ACCEPTED: {
    IK: [],
    MUDUR: [],
  },
};

// UI ve bildirim metinleri için TR etiketler (ham enum yerine).
// Yalnız bu workflow'da geçen durumlar; tam enum listesi UI'da ayrıca olabilir.
export const STATUS_LABELS_TR: Record<JobApplicationStatus, string> = {
  CONSENT_PENDING: "KVKK Onayı Bekliyor",
  HEALTH_PENDING: "Sağlık Beyanı Bekliyor",
  PENDING: "İV Ön İnceleme",
  REVIEWING: "İV Havuzu",
  ADAYA_GERI_GONDERILDI: "Aday Düzeltmesi Bekleniyor",
  SHORTLISTED: "Ön Eleme",
  SINAV: "Sınav",
  TELEFON_MULAKATI: "Telefon Mülakatı",
  IK_MULAKATI: "İK Mülakatı",
  TEKNIK_MULAKAT: "Teknik Mülakat (1. Kademe)",
  TEKLIF: "Teklif",
  TEKLIF_KABUL: "Teklif Kabul Edildi",
  ISE_BASLADI: "İşe Başladı",
  REJECTED: "Reddedildi",
  MUDUR_DEGERLENDIRME: "Müdür Değerlendirmesi",
  MUDUR_MULAKATI: "Müdür Mülakatı",
  // ——— EMEKLİ statüler (Faz 1) — matris satırları boş, ulaşılamaz. Etiketler yalnız
  // geçmiş StageLog satırları okunabilsin diye duruyor.
  REVIEWED: "İncelendi (kullanımdan kaldırıldı)",
  INTERVIEW: "Mülakata Çağrıldı (kullanımdan kaldırıldı)",
  ACCEPTED: "Kabul Edildi (kullanımdan kaldırıldı)",
  DEGERLENDIRICI: "Değerlendirici İncelemesi (kullanımdan kaldırıldı)",
  URETIM_MUDUR_YRD: "Üretim Müdür Yrd. Onayı (kullanımdan kaldırıldı)",
  FABRIKA_MUDURU: "Fabrika Müdürü Onayı (kullanımdan kaldırıldı)",
};

/**
 * EMEKLİ statüler — TEK KAYNAK. Matris satırları boş, hiçbir geçişin hedefi değiller.
 * UI statü filtresi bu kümeyi hariç tutar (sabit liste kopyalanmaz).
 * Enum'dan SİLİNMEDİLER — gerekçe ALLOWED_TRANSITIONS içindeki yorumlarda.
 */
export const EMEKLI_STATULER: JobApplicationStatus[] = [
  "REVIEWED",
  "INTERVIEW",
  "ACCEPTED",
  "DEGERLENDIRICI",
  "URETIM_MUDUR_YRD",
  "FABRIKA_MUDURU",
];

/** Statü emekli mi (UI seçeneklerinden çıkarılır). */
export function emekliMi(status: string | null | undefined): boolean {
  return !!status && (EMEKLI_STATULER as string[]).includes(status);
}

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
