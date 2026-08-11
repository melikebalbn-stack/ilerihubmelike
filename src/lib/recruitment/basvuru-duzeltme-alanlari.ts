// Başvuru İK DÜZELTMESİ — düzenlenebilir alan BEYAZ LİSTESİ + doğrulama. TEK KAYNAK.
//
// NEDEN VAR: `PublicJobApplication` oluşturulduktan sonra HİÇBİR alanı değiştirilemiyordu
// (PATCH yalnız `notes` kabul ediyordu, adayın kendi düzenleme yolu ise gönderimden sonra
// bilerek kapalı — bkz. consent-guard.ts DRAFT_STATUSES). Aday yanlış telefon yazdığında
// tek çare kaydı silip baştan doldurtmaktı; bu da KVKK onayını, sağlık beyanını, aşama
// geçmişini ve sınav oturumunu birlikte götürüyordu. Bu modül o boşluğu DAR bir yüzeyle
// kapatır: yalnız buradaki alanlar, yalnız İK, ve her değişiklik denetim kaydına yazılır.
//
// BEYAZ LİSTE (blocklist DEĞİL): listede olmayan alan sessizce yok sayılır. Modele yeni
// bir alan eklendiğinde otomatik olarak DÜZENLENEMEZ olur — güvenli varsayılan.
// consent-guard.ts'teki DRAFT_STATUSES ile aynı gerekçe.
//
// LİSTEYE ALINMAYANLAR ve nedeni (bilinçli — buraya eklemeden önce oku):
//   · KVKK onayı/zaman damgası, sağlık beyanı → imzalı beyan; ayrı tablolarda, dokunulmaz
//   · declarationAccepted / declarationDate / digitalSignature / signatureDate → imza zinciri
//   · applicationNumber / status / assignedManagerId / assignedAt / rejectionReasonId
//     → kimlik ve iş akışı; statü yalnız transition ucundan değişir
//   · createdAt / updatedAt / ipAddress / userAgent → oluşturma izleri
//   · tcKimlikNo → JobApplicationConsent.tcKimlikNo ile eşleşir; burada değişirse imzalı
//     KVKK kaydıyla tutarsız kalır (iki tabloyu birlikte değiştirmek AYRI bir karar)
//   · bloodType / height / weight / beden alanları → sağlık ve fiziksel veri
//   · adli sicil alanları, memberships (dernek/vakıf/sendika) → KVKK özel nitelikli veri
//   · militaryStatus / militaryPostponeDate → resmi durum beyanı
//   · referralSource* → işe alım kaynak metriklerini besler (source-breakdown), ayrıca
//     eski enum + yeni FK ikili yapısı var; hangisine yazılacağı ayrı karar
//   · photoUrl → dosya; yeniden yükleme yolu yok, ham URL yazmak tehlikeli
//   · gender → kimlik alanı, düzeltme politikası belirsiz
//   · notes → İK notu; ZATEN düzenlenebilir, bu akışın dışında kalır (denetime de girmez)

import { z } from 'zod'
import { EducationLevel, MaritalStatus } from '@/generated/prisma'
import { maasBeklentisiGecerliMi } from '@/lib/recruitment/salary'

// ── Ortak yapı taşları ────────────────────────────────────────────────────────
// Boş string → null. İK bir alanı temizlemek istediğinde form '' gönderir; DB'de
// '' değil null durmalı (mevcut kayıtların tamamı null/dolu, '' yok).
const bosaNull = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional()

// Telefon: rakam/boşluk/+/-/parantez. Biçim ZORLANMAZ (0532..., +90..., dahili numara
// hepsi geçerli) — yalnız harf/serbest metin engellenir.
const telefon = z
  .string()
  .trim()
  .max(30)
  .regex(/^[0-9+()\-\s]*$/, 'Telefon yalnız rakam, boşluk ve + ( ) - içerebilir')
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional()

// JSON dizi alanları (eğitim/deneyim/dil/bilgisayar/referans). İçerik şekli bu modülde
// DOĞRULANMAZ: aday formu ile birebir aynı yapıyı burada ikinci kez tanımlamak kopya
// mantık olurdu. Yalnız "dizi mi" kontrolü yapılır; İK ekranı alanları satır satır düzenler.
const jsonDizi = z.array(z.unknown()).nullable().optional()

// educationHistory diğerlerinden FARKLI: dizi değil, anahtarlı nesne
// (aday formunda `{ ilkokul: {...}, lise: {...} }` deseni).
const jsonNesne = z.record(z.string(), z.unknown()).nullable().optional()

const tarih = z.coerce.date().nullable().optional()

/**
 * DÜZENLENEBİLİR ALANLAR — beyaz listenin kendisi.
 * Anahtar kümesi = izin verilen alanlar. Zod nesnesi varsayılan olarak tanımsız
 * anahtarları SESSİZCE DÜŞÜRÜR (`.strict()` KULLANILMADI) — istenen davranış bu:
 * beyaz liste dışı alan gövdede gelse bile hata dönmez, YAZILMAZ da.
 */
const alanlar = z
  .object({
    // ── Kimlik yazım alanları ──
    fullName: z.string().trim().min(1, 'Ad Soyad boş olamaz').max(120).optional(),
    birthPlace: bosaNull(100),
    birthDate: tarih,
    nationality: bosaNull(60),

    // ── İletişim ──
    homeAddress: bosaNull(1000),
    mobilePhone: telefon,
    workPhone: telefon,
    homePhone: telefon,
    email: z
      .union([z.literal(''), z.email('Geçerli bir e-posta adresi girin')])
      .transform((v) => (v === '' ? null : v))
      .nullable()
      .optional(),
    preferredContactGsm: z.boolean().nullable().optional(),
    preferredContactEmail: z.boolean().nullable().optional(),
    preferredContactOther: bosaNull(200),

    // ── Aile / bakmakla yükümlü ──
    maritalStatus: z.enum(MaritalStatus).nullable().optional(),
    numberOfChildren: z.number().int().min(0).max(20).nullable().optional(),
    spouseWorking: z.boolean().nullable().optional(),
    spouseOccupation: bosaNull(120),
    dependents: bosaNull(1000),

    // ── İş tercihleri ──
    requestedPosition: bosaNull(150),
    expectedSalary: z.number().int().nullable().optional(),
    availableStartDate: tarih,
    previouslyWorkedHere: z.boolean().nullable().optional(),
    canContactLastEmployer: z.boolean().nullable().optional(),

    // ── Çalışma koşulları ──
    hasTravelRestriction: z.boolean().nullable().optional(),
    canWorkShifts: z.boolean().nullable().optional(),

    // ── Sürücü belgesi ──
    hasDriverLicense: z.boolean().nullable().optional(),
    driverLicenseClass: bosaNull(20),
    driverLicenseDate: tarih,

    // ── Başvuru içeriği (öğrenim / deneyim) ──
    educationLevel: z.enum(EducationLevel).nullable().optional(),
    educationHistory: jsonNesne,
    coursesAndSeminars: jsonDizi,
    foreignLanguages: jsonDizi,
    computerSkills: jsonDizi,
    workExperience: jsonDizi,
    references: jsonDizi,

    // ── Diğer ──
    hobbies: bosaNull(1000),
    hasRelativesInCompany: z.boolean().nullable().optional(),
    relativeName: bosaNull(120),
  })

export const basvuruDuzeltmeSchema = alanlar
  .superRefine((val, ctx) => {
    // Maaş sınırı TEK KAYNAK: salary.ts (aday formu da onu kullanıyor). Burada
    // eşik sayısı TEKRARLANMAZ — asgari ücret her yıl değişiyor, tek yerden.
    if (val.expectedSalary !== undefined && val.expectedSalary !== null) {
      const sonuc = maasBeklentisiGecerliMi(val.expectedSalary)
      if (!sonuc.ok) {
        ctx.addIssue({ code: 'custom', path: ['expectedSalary'], message: sonuc.hata! })
      }
    }
  })

export type BasvuruDuzeltmeGirdi = z.infer<typeof basvuruDuzeltmeSchema>

/**
 * Beyaz listedeki alan adları — şemanın KENDİSİNDEN türetilir, elle ikinci bir dizi
 * tutulmaz. Şemaya alan eklenince API select'i ve ekran kendiliğinden kapsar.
 */
export const DUZENLENEBILIR_ALANLAR = Object.keys(
  alanlar.shape,
) as (keyof BasvuruDuzeltmeGirdi)[]

/** Alan → Türkçe etiket. Denetim geçmişi ve düzenleme formu AYNI etiketi gösterir. */
export const ALAN_ETIKETLERI: Record<keyof BasvuruDuzeltmeGirdi, string> = {
  fullName: 'Ad Soyad',
  birthPlace: 'Doğum Yeri',
  birthDate: 'Doğum Tarihi',
  nationality: 'Uyruk',
  homeAddress: 'Ev Adresi',
  mobilePhone: 'Cep Telefonu',
  workPhone: 'İş Telefonu',
  homePhone: 'Ev Telefonu',
  email: 'E-posta',
  preferredContactGsm: 'GSM ile ulaşılabilir',
  preferredContactEmail: 'E-posta ile ulaşılabilir',
  preferredContactOther: 'Diğer iletişim yöntemi',
  maritalStatus: 'Medeni Durum',
  numberOfChildren: 'Çocuk Sayısı',
  spouseWorking: 'Eşi Çalışıyor',
  spouseOccupation: 'Eşin Mesleği',
  dependents: 'Bakmakla Yükümlü Olduğu Kişiler',
  requestedPosition: 'Talep Edilen Pozisyon',
  expectedSalary: 'Maaş Beklentisi',
  availableStartDate: 'Başlayabileceği Tarih',
  previouslyWorkedHere: 'Daha Önce Çalıştı',
  canContactLastEmployer: 'Son İşverenle Temas',
  hasTravelRestriction: 'Seyahat Engeli',
  canWorkShifts: 'Vardiyalı Çalışabilir',
  hasDriverLicense: 'Sürücü Belgesi Var',
  driverLicenseClass: 'Sürücü Belgesi Sınıfı',
  driverLicenseDate: 'Sürücü Belgesi Tarihi',
  educationLevel: 'Öğrenim Durumu',
  educationHistory: 'Eğitim Geçmişi',
  coursesAndSeminars: 'Kurs ve Seminerler',
  foreignLanguages: 'Yabancı Diller',
  computerSkills: 'Bilgisayar Bilgisi',
  workExperience: 'İş Tecrübeleri',
  references: 'Referanslar',
  hobbies: 'Hobiler',
  hasRelativesInCompany: 'Firmada Akraba/Tanıdık',
  relativeName: 'Akraba/Tanıdık Adı',
}

/** Denetim kaydında tutulan tek bir alan değişikliği. */
export type AlanDegisikligi = {
  alan: string
  etiket: string
  eski: unknown
  yeni: unknown
}

/**
 * Eski kayıt ile gelen değişiklikleri karşılaştırıp GERÇEKTEN değişen alanları çıkarır.
 * Aynı değer tekrar gönderilirse denetim kaydı üretilmez (gürültü olmasın).
 * Karşılaştırma JSON.stringify ile — tarih/dizi/nesne alanları için de çalışır.
 */
export function degisiklikleriCikar(
  onceki: Record<string, unknown>,
  gelen: Partial<BasvuruDuzeltmeGirdi>,
): AlanDegisikligi[] {
  const liste: AlanDegisikligi[] = []
  for (const alan of Object.keys(gelen) as (keyof BasvuruDuzeltmeGirdi)[]) {
    const yeni = gelen[alan]
    if (yeni === undefined) continue // gönderilmemiş alan — dokunma
    const eski = onceki[alan] ?? null
    const yeniNorm = yeni ?? null
    if (JSON.stringify(eski) === JSON.stringify(yeniNorm)) continue
    liste.push({ alan, etiket: ALAN_ETIKETLERI[alan] ?? alan, eski, yeni: yeniNorm })
  }
  return liste
}
