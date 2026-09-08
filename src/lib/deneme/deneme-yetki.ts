// IV-FR-27 · Deneme Değerlendirme — yetki ve görünürlük.
//
// GİZLİLİK (form üzerinde "GİZLİ" ibaresi): formu YALNIZ o formun zincirindekiler
// (dolduran + onaylayan) ve İnsan Varlıkları görür. Bölüm müdürü zincirde değilse
// astının formunu GÖREMEZ — bölüm bazlı geniş erişim YOK.

import type { DenemeDurum } from "@/generated/prisma";
import type { DenemeRol } from "./deneme-transitions";

/** Formun yetki çözümü için gereken asgari alanları. */
export type FormYetkiOzet = {
  durum: DenemeDurum;
  personnelId: string;
  degerlendirici1Id: string | null;
  degerlendirici2Id: string | null;
  onaylayanId: string | null;
};

export type Aktor = {
  userId: string;
  /** Aktörün Personnel kaydı — zincir Personnel id'leriyle kurulu. */
  personnelId: string | null;
  permissions: string[];
  email?: string | null;
};

export function ikMi(aktor: Aktor): boolean {
  return aktor.permissions.includes("hr.admin") || aktor.permissions.includes("recruitment.admin");
}

/**
 * Aktörün BU FORMDAKİ rolü. Kişiye değil, formun alanlarına bakar.
 * İK her formda IK rolündedir. Aynı kişi hem değerlendirici hem İK olabilir —
 * o durumda adım sahipliği önce gelir (çağıran hangi rolü istediğini bilir).
 */
export function formRolleri(form: FormYetkiOzet, aktor: Aktor): DenemeRol[] {
  const roller: DenemeRol[] = [];
  const pid = aktor.personnelId;
  if (pid) {
    if (form.degerlendirici1Id === pid) roller.push("TAKIM_LIDERI");
    if (form.degerlendirici2Id === pid) {
      // 2. değerlendirici müdür yrd. VEYA müdür olabilir; durum hangisi olduğunu söyler.
      roller.push(form.durum === "MUDUR_BEKLIYOR" ? "MUDUR" : "MUDUR_YARDIMCISI");
    }
    if (form.onaylayanId === pid) roller.push("ONAYLAYAN");
  }
  if (ikMi(aktor)) roller.push("IK");
  return roller;
}

/** Formu görebilir mi — zincirdekiler + İV. Değerlendirilen kişinin KENDİSİ göremez. */
export function gorebilirMi(form: FormYetkiOzet, aktor: Aktor): boolean {
  return formRolleri(form, aktor).length > 0;
}

/** O anki adımın sahibi olan rol — puanlama/onay yetkisi bununla kontrol edilir. */
export function adimSahibiRol(durum: DenemeDurum): DenemeRol | null {
  switch (durum) {
    case "DEGERLENDIRICI1_BEKLIYOR":
      return "TAKIM_LIDERI";
    case "MUDUR_YRD_BEKLIYOR":
      return "MUDUR_YARDIMCISI";
    case "MUDUR_BEKLIYOR":
      return "MUDUR";
    case "ONAY_BEKLIYOR":
      return "ONAYLAYAN";
    case "IK_BEKLIYOR":
      return "IK";
    default:
      return null; // TASLAK / TAMAMLANDI / IPTAL
  }
}

/**
 * Aktör o anki adımın sahibi mi. Adım sahipliği FORM ALANINDAN çözülür —
 * "bölüm müdürüyüm" demek yetmez, o formun degerlendirici2Id'si olmak gerekir.
 */
export function adimSahibiMi(form: FormYetkiOzet, aktor: Aktor): boolean {
  // İK aşaması Personnel bağı GEREKTİRMEZ — yetki izinden gelir. Bu kontrol
  // pid kontrolünden ÖNCE olmalı: Personnel kaydı olmayan İV kullanıcısı da
  // formu kapatabilmeli (aksi hâlde form İK aşamasında kilitlenirdi).
  if (form.durum === "IK_BEKLIYOR") return ikMi(aktor);

  const pid = aktor.personnelId;
  if (!pid) return false;
  switch (form.durum) {
    case "DEGERLENDIRICI1_BEKLIYOR":
      return form.degerlendirici1Id === pid;
    case "MUDUR_YRD_BEKLIYOR":
    case "MUDUR_BEKLIYOR":
      return form.degerlendirici2Id === pid;
    case "ONAY_BEKLIYOR":
      return form.onaylayanId === pid;
    default:
      return false;
  }
}

/** Reddedilen istek logu — transition ucundaki redLog deseninin aynısı. */
export function denemeRedLog(args: {
  uc: string;
  formId: string;
  from: string;
  to: string;
  reason: string;
  user?: string | null;
}): void {
  console.warn(`[deneme/${args.uc}] reddedildi:`, {
    formId: args.formId,
    from: args.from,
    to: args.to,
    reason: args.reason,
    user: args.user ?? "(?)",
  });
}
