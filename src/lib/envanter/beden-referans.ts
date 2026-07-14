// Envanter — Beden referans tabloları (PPE/kıyafet zimmeti).
//
// Amaç: Üst beden (XS..5XL) seçildiğinde cinsiyete göre ÖNERİ alt beden üretmek ve
// ayakkabı numarasının ayak uzunluğunu (cm) göstermek. Alt beden ÖNERİDİR; kullanıcı
// serbest metinle ezebilir (ör. L üst giyen biri 48 alt kullanabilir). Bu yüzden
// oneriAltBeden yalnız placeholder/ipucu için kullanılır, zorunlu kural değildir.

import type { Gender } from "@/generated/prisma";

// Üst beden ölçekleri (sıralı — Select seçenekleri bu sırayla üretilir).
export const UST_BEDENLER = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "2XL",
  "3XL",
  "4XL",
  "5XL",
] as const;

// Ayakkabı numaraları (35..48).
export const AYAKKABI_NOLARI = [
  "35",
  "36",
  "37",
  "38",
  "39",
  "40",
  "41",
  "42",
  "43",
  "44",
  "45",
  "46",
  "47",
  "48",
] as const;

// Üst beden → cinsiyete göre alt beden ÖNERİSİ (MALE=Erkek, FEMALE=Kadın).
// Aralıklar ("38-40") kaynak tablosundaki gibi korunur.
export const ALT_BEDEN_REFERANS: Record<string, { MALE: string; FEMALE: string }> = {
  XS: { FEMALE: "34", MALE: "44" },
  S: { FEMALE: "36", MALE: "46" },
  M: { FEMALE: "38-40", MALE: "48" },
  L: { FEMALE: "42", MALE: "50" },
  XL: { FEMALE: "44", MALE: "52" },
  "2XL": { FEMALE: "46", MALE: "54" },
  "3XL": { FEMALE: "48", MALE: "56" },
  "4XL": { FEMALE: "50-52", MALE: "58" },
  "5XL": { FEMALE: "54-56", MALE: "60" },
};

// Ayakkabı no → ayak uzunluğu (cm, Türkçe ondalık virgülle).
export const AYAK_UZUNLUK_CM: Record<string, string> = {
  "35": "22,5",
  "36": "23,0",
  "37": "23,5",
  "38": "24,0",
  "39": "24,5",
  "40": "25,0",
  "41": "25,5",
  "42": "26,0",
  "43": "27,0",
  "44": "27,5",
  "45": "28,0",
  "46": "29,0",
  "47": "29,5",
  "48": "30,0",
};

/**
 * Üst beden + cinsiyet → önerilen alt beden (string) veya null.
 * ÖNERİDİR — kullanıcı serbest metin alanında ezebilir.
 */
export function oneriAltBeden(ustBeden: string, cinsiyet: Gender): string | null {
  const ref = ALT_BEDEN_REFERANS[ustBeden];
  if (!ref) return null;
  return ref[cinsiyet] ?? null;
}
