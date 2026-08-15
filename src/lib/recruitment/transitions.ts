// Başvuru Değerlendirme Workflow — durum geçiş izin matrisi + yetki tanımı.
//
// İki rol: İK (recruitment.admin / hr.admin) ve MÜDÜR (başvuruya atanan bölüm müdürü).
// Kaynak: GÖREV tanımı. Geçiş yalnız bu matriste açıkça izin verilen (from → role → to)
// üçlüleri için geçerlidir; matriste olmayan her geçiş reddedilir (deny-by-default).

import type { JobApplicationStatus } from "@/generated/prisma";

export type TransitionRole =
  | "IK"
  | "MUDUR"
  // Mavi yaka zinciri rolleri — EMEKLİ (Faz 1). Kod'da kalır, matriste hedefi yok.
  | "DEGERLENDIRICI"
  | "URETIM_MUDUR_YRD"
  | "FABRIKA_MUDURU"
  // Faz 4 — teknik mülakat iki kademe. Rol, BEKLEYEN approval satırından çözülür
  // (step + decision IS NULL + approverId === session.user.id) — bkz. resolve-roles.ts.
  | "TEKNIK_MULAKATCI"
  | "TEKNIK_UST_AMIR";

/** Tüm roller — bekleyen.ts gibi türetim yapan modüller sabit liste gömmesin diye TEK KAYNAK. */
export const TUM_ROLLER: readonly TransitionRole[] = [
  "IK",
  "MUDUR",
  "DEGERLENDIRICI",
  "URETIM_MUDUR_YRD",
  "FABRIKA_MUDURU",
  "TEKNIK_MULAKATCI",
  "TEKNIK_UST_AMIR",
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
  // ——— Müdür kademesi (Faz 5) ———
  // MÜDÜR REJECTED VEREMEZ: nihai ret yalnız İV'nin (rejectionReasonId + kök-neden sözlüğü
  // İV'de). Atanan müdür olumsuz görüşünü REVIEWING'e dönerek bildirir; dönüşte YORUM
  // ZORUNLU (transition route'daki olumsuz-görüş guard'ı — teknik mülakat kademeleriyle
  // AYNI kural). İK satırları DEĞİŞMEDİ: İV her iki statüden de reddedebilir.
  MUDUR_DEGERLENDIRME: {
    // Müdür değerlendirir; İK her zaman geri alabilir/reddedebilir/yeniden atayabilir.
    // D4: İK aynı duruma geçebilir → müdür yanlış atandıysa yeniden atama (assignedManagerId zorunlu).
    // İK geri alma: REVIEWING, SINAV.
    MUDUR: ["MUDUR_MULAKATI", "SINAV", "REVIEWING"],
    IK: ["REJECTED", "MUDUR_DEGERLENDIRME", "REVIEWING", "SINAV"],
  },
  MUDUR_MULAKATI: {
    // Mülakat olumlu → TEKLIF (müdür kendi kademesini sonuçlandırabilsin), olumsuz → REVIEWING.
    MUDUR: ["TEKLIF", "SINAV", "REVIEWING"],
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
  // ——— Teknik mülakat iki kademe (Faz 4) ———
  // 1. kademe: İV'nin seçtiği mülakatçı. Olumlu → 2. kademe (üst amir OTOMATİK atanır),
  // olumsuz → REVIEWING (İV'ye döner). MÜLAKATÇI REJECTED VEREMEZ: nihai ret yalnız İV'nin
  // (rejectionReasonId zorunlu, kök-neden sözlüğü İV'nin). Olumsuz görüş approval satırında
  // decision=REJECTED + comment olarak KALIR, silinmez.
  TEKNIK_MULAKAT: {
    TEKNIK_MULAKATCI: ["TEKNIK_MULAKAT_UST_ONAY", "REVIEWING"],
    // İK: yeniden atama (aynı statü), üst onaya elle çıkarma, geri alma, ilerletme, ret.
    IK: ["TEKNIK_MULAKAT", "TEKNIK_MULAKAT_UST_ONAY", "TEKLIF", "MUDUR_MULAKATI", "REVIEWING", "REJECTED"],
    MUDUR: [],
  },
  // 2. kademe: üst amir. Onaylarsa teklife, olumsuzsa İV'ye döner. REJECTED YOK.
  TEKNIK_MULAKAT_UST_ONAY: {
    TEKNIK_UST_AMIR: ["TEKLIF", "REVIEWING"],
    IK: ["REVIEWING", "TEKLIF", "TEKNIK_MULAKAT", "REJECTED"],
    MUDUR: [],
  },
  TEKLIF: {
    // İK geri alma: IK_MULAKATI, REVIEWING (teklif geri çekilip sürece dönebilir).
    IK: ["TEKLIF_KABUL", "IK_MULAKATI", "REVIEWING", "REJECTED"],
    MUDUR: [],
  },
  // ——— İşbaşı öncesi evrak aşaması (Faz 6) ———
  // ISE_BASLADI artık BURADAN çıkarıldı: işbaşı, personel kaydı oluşturulmadan
  // işaretlenemez. Yol: TEKLIF_KABUL → EVRAK_HAZIRLIK → (Personele Dönüştür formu) → ISE_BASLADI.
  TEKLIF_KABUL: {
    IK: ["EVRAK_HAZIRLIK", "REJECTED"],
    MUDUR: [],
  },
  EVRAK_HAZIRLIK: {
    // ISE_BASLADI matriste DURUR (yetkiyi bu matris tanımlar) ama /transition ucundan
    // GEÇİLEMEZ — dönüşüm ucu bu satırı canTransition ile doğrular ve statüyü personel
    // kaydıyla AYNI transaction'da yazar (personele-donustur.ts).
    IK: ["ISE_BASLADI", "TEKLIF_KABUL", "REJECTED"],
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
  TEKNIK_MULAKAT_UST_ONAY: "Teknik Mülakat (2. Kademe)",
  TEKLIF: "Teklif",
  TEKLIF_KABUL: "Teklif Kabul Edildi",
  EVRAK_HAZIRLIK: "Evrak Hazırlık",
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
  // TEKNIK_MULAKAT: İV mülakatçıyı SEÇER (2. kademenin üst amiri ise sistemce çözülür —
  // otomatikAtamaliMi). DEGERLENDIRICI emekli olsa da satır korunur (ulaşılamaz).
  return (
    to === "MUDUR_DEGERLENDIRME" || to === "DEGERLENDIRICI" || to === "TEKNIK_MULAKAT"
  );
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

/**
 * Faz 6 — genel /transition ucundan GEÇİLEMEYEN hedefler: kendi FORMU olan statüler.
 * Matriste satırları vardır (yetkiyi matris tanımlar) ama geçiş, formun açtığı
 * transaction içinde yapılır. Hem UI süzmesi hem sunucu guard'ı BURAYI okur — liste
 * iki yerde ayrı ayrı yazılmaz.
 *   ISE_BASLADI → Personele Dönüştür formu (personele-donustur.ts)
 */
export const SADECE_FORMLA: JobApplicationStatus[] = ["ISE_BASLADI"];

export function sadeceFormlaMi(to: JobApplicationStatus): boolean {
  return SADECE_FORMLA.includes(to);
}

/** Genel geçiş butonları için hedef listesini süzer (form gerektirenler düşer). */
export function formGerektirenleriSuz(
  hedefler: JobApplicationStatus[],
): JobApplicationStatus[] {
  return hedefler.filter((h) => !SADECE_FORMLA.includes(h));
}

/**
 * Bu rol, bu statüde geçiş yapabiliyor mu? = "karar bu roldedir".
 *
 * "Kimin kademesindeyiz" sorusunu soran her yer (transition guard'ı, detay ekranı,
 * bekleyen.ts) AYNI kaynağı kullansın diye export edilir — sabit statü listesi
 * (`["MUDUR_DEGERLENDIRME","MUDUR_MULAKATI"]` gibi) hiçbir yere gömülmez, matrise
 * satır eklenince çağıranlar kendiliğinden doğru davranır.
 */
export function roluKademedeMi(
  status: JobApplicationStatus,
  role: TransitionRole,
): boolean {
  return (ALLOWED_TRANSITIONS[status]?.[role]?.length ?? 0) > 0;
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
