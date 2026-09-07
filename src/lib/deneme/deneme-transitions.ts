// IV-FR-27 · Deneme Süresi Değerlendirme — durum geçiş izin matrisi + yetki tanımı.
//
// recruitment/transitions.ts deseninin aynısı: geçiş YALNIZ bu matriste açıkça
// izin verilen (from → rol → to) üçlüsü için geçerli; matriste olmayan her geçiş
// reddedilir (deny-by-default). Terminal durumlar boş dizi ile İŞARETLENİR.
//
// Faz 1: dosya YAZILDI, henüz ÇAĞRILMIYOR. API ucu ve ekran sonraki turlarda.
//
// AKIŞ (Melih kararı) — kural GENEL, kişiye sabitlenmez, DepartmentDefinition'dan çözülür:
//
//   MAVİ YAKA (iki puan):
//     1) Personnel.sorumlu1Id doldurur (takım lideri)
//     2) Bölümün mudurYardimcisiId VARSA ona düşer:
//          a) kendisi doldurur → bölüm MÜDÜRÜ onayına → İK
//          b) müdüre AKTARIR → müdür doldurur → onay YOK → İK
//     3) mudurYardimcisiId YOKSA doğrudan bölüm müdürüne düşer,
//        müdür doldurur → onay YOK → İK
//
//   GRİ YAKA (tek puan):
//     mudurYardimcisiId varsa o, yoksa müdür doldurur → İK  (onay adımı YOK)
//
//   BEYAZ YAKA (tek puan):
//     1) Bölüm müdürü doldurur
//     2) GMY'ye bağlıysa GMY ONAYLAR (puan VERMEZ) → İK
//     3) Doğrudan GM'e bağlıysa onay yok → İK
//
//   İK aşaması: İV kapatır. 60 altıysa fesihGerekce ZORUNLU (uygulama seviyesinde).

import type { DenemeDurum } from "@/generated/prisma";

/**
 * Geçişi yapan kişinin O FORMDAKİ rolü. Kişiye değil, formun o anki adımına göre
 * çözülür (bkz. sonraki turda gelecek resolve-roles benzeri çözücü):
 *   TAKIM_LIDERI     → degerlendirici1Id === aktör
 *   MUDUR_YARDIMCISI → bölümün mudurYardimcisiId === aktör
 *   MUDUR            → bölümün mudurId === aktör
 *   ONAYLAYAN        → mavi: bölüm müdürü · beyaz: GMY (puan VERMEZ)
 *   IK               → insan varlıkları (hr.admin)
 */
export type DenemeRol =
  | "TAKIM_LIDERI"
  | "MUDUR_YARDIMCISI"
  | "MUDUR"
  | "ONAYLAYAN"
  | "IK";

/** Tüm roller — türetim yapan modüller sabit liste gömmesin diye TEK KAYNAK. */
export const TUM_DENEME_ROLLERI: readonly DenemeRol[] = [
  "TAKIM_LIDERI",
  "MUDUR_YARDIMCISI",
  "MUDUR",
  "ONAYLAYAN",
  "IK",
] as const;

// Matris satırı: IK ZORUNLU (İV her aşamada iptal edebilir), diğer roller opsiyonel —
// yalnız ilgili satırlarda yazılır, okunmayan rol için `?? []` devrede.
type GecisSatiri = { IK: DenemeDurum[] } & Partial<
  Record<Exclude<DenemeRol, "IK">, DenemeDurum[]>
>;

// EXHAUSTIVENESS GUARD: Record<DenemeDurum, ...> — her durum için anahtar ZORUNLU
// (eksik durum = derleme hatası), hedefler DenemeDurum[] (geçersiz enum = derleme
// hatası). Enum'a durum eklendiğinde matris güncellemesi unutulamaz.
export const DENEME_GECISLERI: Record<DenemeDurum, GecisSatiri> = {
  // Cron formu TASLAK açar, bildirim çıkınca DEGERLENDIRICI1_BEKLIYOR'a geçer.
  // Bu geçişi sistem yapar; matriste İK'nın elle ilerletmesine de izin verilir.
  TASLAK: {
    IK: ["DEGERLENDIRICI1_BEKLIYOR", "IPTAL"],
  },

  // 1. puan. Hedef, yaka rengine göre ÇALIŞMA ZAMANINDA seçilir — matris üç
  // olasılığı da açar, hangisinin geçerli olduğunu akış çözücüsü belirler:
  //   MAVİ  + müdür yrd. VAR  → MUDUR_YRD_BEKLIYOR
  //   MAVİ  + müdür yrd. YOK  → MUDUR_BEKLIYOR
  //   GRİ / BEYAZ (tek puan)  → ONAY_BEKLIYOR (beyaz+GMY) veya IK_BEKLIYOR
  DEGERLENDIRICI1_BEKLIYOR: {
    TAKIM_LIDERI: ["MUDUR_YRD_BEKLIYOR", "MUDUR_BEKLIYOR"],
    MUDUR_YARDIMCISI: ["IK_BEKLIYOR"], // gri yaka: müdür yrd. doldurdu, onay yok
    MUDUR: ["ONAY_BEKLIYOR", "IK_BEKLIYOR"], // beyaz: GMY'ye bağlıysa onaya, değilse İK'ya
    IK: ["IPTAL"],
  },

  // Mavi yaka 2. puan müdür yardımcısında: DOLDUR ya da AKTAR.
  MUDUR_YRD_BEKLIYOR: {
    MUDUR_YARDIMCISI: [
      "ONAY_BEKLIYOR", // (a) kendisi doldurdu → bölüm müdürü onayına
      "MUDUR_BEKLIYOR", // (b) müdüre AKTARDI (puan vermeden)
    ],
    IK: ["IPTAL"],
  },

  // Müdür doldurur → onay YOK, doğrudan İK (müdür zaten en üst halka).
  MUDUR_BEKLIYOR: {
    MUDUR: ["IK_BEKLIYOR"],
    IK: ["IPTAL"],
  },

  // Onaylayan PUAN VERMEZ. Reddederse form bir adım geri döner; geri dönüş hedefi
  // formun geldiği yola göre çözülür (mavi: müdür yrd. · beyaz: 1. değerlendirici).
  ONAY_BEKLIYOR: {
    ONAYLAYAN: ["IK_BEKLIYOR", "MUDUR_YRD_BEKLIYOR", "DEGERLENDIRICI1_BEKLIYOR"],
    IK: ["IPTAL"],
  },

  // İV kapanışı. 60 altı kapanışta fesihGerekce ZORUNLU (matris değil, uç kontrol eder).
  // Otomatik fesih/offboarding TETİKLENMEZ — yalnız kayıt tutulur.
  IK_BEKLIYOR: {
    IK: ["TAMAMLANDI", "IPTAL", "DEGERLENDIRICI1_BEKLIYOR"], // eksik doldurulmuşsa başa döndürebilir
  },

  // ── TERMİNAL ──
  TAMAMLANDI: { IK: [] },
  IPTAL: { IK: [] },
};

/** Bir durumdan hiçbir rolün çıkışı yoksa terminaldir. */
export function terminalMi(durum: DenemeDurum): boolean {
  const satir = DENEME_GECISLERI[durum];
  return TUM_DENEME_ROLLERI.every((rol) => (satir[rol] ?? []).length === 0);
}

/** (from, rol, to) üçlüsü matriste açıkça izinli mi. Deny-by-default. */
export function gecisIzinli(from: DenemeDurum, rol: DenemeRol, to: DenemeDurum): boolean {
  return (DENEME_GECISLERI[from][rol] ?? []).includes(to);
}

/** Bir rolün o durumdan gidebileceği hedefler (UI'da buton listesi için). */
export function izinliHedefler(from: DenemeDurum, rol: DenemeRol): DenemeDurum[] {
  return [...(DENEME_GECISLERI[from][rol] ?? [])];
}

/** Puan geçerlilik sınırı — 20 kriter × 1-5 = 20..100, geçme 60. */
export const DENEME_GECME_PUANI = 60;
export const DENEME_PUAN_MIN = 20;
export const DENEME_PUAN_MAX = 100;

/**
 * Ham toplamdan sonuç. İki puan varsa ORTALAMA, tek puan varsa puan1.
 * Ekstra ölçek dönüşümü YOK — 20 kriter × 1-5 zaten 20..100 aralığında.
 */
export function denemeOrtalama(puan1: number | null, puan2: number | null): number | null {
  if (puan1 === null && puan2 === null) return null;
  if (puan1 === null) return puan2;
  if (puan2 === null) return puan1;
  return (puan1 + puan2) / 2;
}

/** 60 ve üzeri başarılı. Ekranda 60 altı KIRMIZI gösterilir (bu fonksiyon karar verir). */
export function denemeBasariliMi(ortalama: number | null): boolean | null {
  if (ortalama === null) return null;
  return ortalama >= DENEME_GECME_PUANI;
}
