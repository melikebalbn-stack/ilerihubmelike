/**
 * Hub → IFS personel senkronu — kod türetme ve sabitler (faz 1).
 *
 * Kilitli kararlar (16.09.2026):
 *  - EmpNo = Personnel.sicilNo aynen; senkron YALNIZ 'ILR-' önekli kayıtlara dokunur.
 *  - OrgCode / PosCode = OrgUnit.code'dan 'ORG-TF-' öneki atılarak (IFS sınırı 10 kar.).
 *  - LaborClassNo = üretim bölümünün kodu TİRESİZ (9 kar.); Kaynakhane görevden
 *    ikiye ayrılır: R (robot) / M (manuel). IFS sınırı 10 kar.
 *  - Üretim bölümü = MAVI/GRI personeli olan bölüm, SHOP_FLOOR_DISI hariç.
 *  - Beyaz yaka ASLA shop-floor değil.
 *  - Org hiyerarşisi EVET (SupOrgCode), pozisyon hiyerarşisi HAYIR ('*') — faz 2.
 *  - KVKK minimum set: sicil, ad-soyad, giriş/çıkış, org/pos, cinsiyet, yaka, bölüm adı.
 *
 * Bu dosya SAF: DB/IFS erişimi yok — vitest ile birebir test edilir.
 */

export const IFS_COMPANY = 'ILERI2'
export const IFS_STRUCTURE = 'ILERI2'
export const IFS_CONTRACT = 'ILER2'
export const IFS_STRUCT_BU_ID = 61
/** LaborClass zorunlu alanı (pilot 16.09: NULLVALUE CalendarId). Mevcut 9 sınıfın tamamı MAINT takvimi kullanıyor. */
export const IFS_LABOR_CLASS_CALENDAR = 'MAINT'
/** LaborClass sabitleri — mevcut WMM kaydıyla aynı (SchedCapacity zorunlu: NULLVALUE). */
export const IFS_LABOR_CLASS_SABITLERI = { CalendarId: IFS_LABOR_CLASS_CALENDAR, SchedCapacity: 'InfiniteCapacity', CapacityCalcBase: 'Individuals' } as const

/** Senkronun dokunduğu EmpNo öneki — dışındakiler (IG002, TEST-005, 3, 4) yok sayılır. */
export const SICIL_ONEKI = 'ILR-'
export const HUB_KOD_ONEKI = 'ORG-TF-'
/** Kurul/komite kutuları koltuk sayılmaz (anaKoltuklar kuralıyla aynı). */
export const KURUL_KOD_ONEKI = 'ORG-KR-'

export const IFS_ACIK_UCLU_TARIH = '2099-12-31'
export const IFS_ORG_VALID_FROM = '2000-01-01'
export const IFS_ORG_VALID_TO = '9999-12-31'

/** Karar 4 — çalışan sabitleri. */
export const EMPLOYEE_SABITLERI = {
  EmploymentType: 'DAIMI',
  DegreeOfOccupation: 1,
  EntitledToOvertime: true,
  MasterEmployment: true,
} as const

/**
 * IFS OrgTermId (CompanyOrgAll zorunlu alanı — pilot 16.09: ORA-20124 NULLVALUE OrgTermId).
 * OrganizationTermLov2s: 1=* 3=Yönetim Kurulu 4=Genel Müdürlük 5=Genel Müdür Yardımcılığı
 * 6=Müdürlük 7=Müdür Yardımcılığı 8=Yöneticilik. Üst birim (SupOrgCode='*') → Müdürlük,
 * alt birim → Yöneticilik. Terim IFS'te yalnız org şeması etiketidir; iş kuralı taşımaz.
 */
export const IFS_ORG_TERM = { UST: 6, ALT: 8 } as const

/**
 * Çalışan GÜNCELLEME yolu (pilot 16.09, iki tur):
 *  - EmployeesHandling.CompanyPersons: yalnız CREATE; her PATCH 500 ODP_ILLEGAL_STATE.
 *  - PersonnelFileHandling.CompanyPersonSet (ILERIHUB_SHOPFLOOR'a ekli): PATCH kabul ediyor
 *    ama alan bazında: EmploymentDate, MasterEmployment, EmpRemark ✓; Fname/Lname/
 *    InternalDisplayName/Gender/FreeField1-10/EmployeeStatus/OrgCode/PosCode → 400 "not updatable".
 *    PeriodEndDate 200 döner ama ETKİSİZ (çalışma tarihi penceresi, istihdam bitişi değil).
 *  Sonuç: org/pozisyon ATAMASI ve ad/cinsiyet güncellemesi bu istemciye açık projeksiyonlarla
 *  YAPILAMIYOR (atama LU'su CompanyPersAssign; 70+ aday projeksiyon adı 404). Pasifleştirme
 *  EmploymentPeriodsHandling.EmpEmployedTimes ile olmalı → 403 (grant yok).
 *  Planlayıcı yalnız aşağıdaki alanlar için UPDATE üretir; diğer farklar ATLA(sebep).
 */
export const EMPLOYEE_PATCH_ALANLARI: readonly string[] = ['EmploymentDate', 'MasterEmployment']
/** Atama alanları — SingleEmployeeAssignmentsHandling sihirbazıyla değişir (bkz. ifs-api atamaDegistir). */
export const EMPLOYEE_ATAMA_ALANLARI: readonly string[] = ['OrgCode', 'PosCode']
/** Pasifleştirme (istihdam bitişi) için çalışan bir yol yok — bkz. yukarı. true olunca PASIF kalemi üretilir. */
export const EMPLOYEE_PASIF_DESTEKLI = false

/**
 * IFS Çalışan Statüsü temel verisi (EmployeeStatusHandling.EmployeeStatuses, key CompanyId+SeqNo).
 * Sistemde `*` (aktif, SeqNo 1) ve `**` (ön kayıt, SeqNo 2) var; Hub'da pasife alınan kişi için
 * ISTEN AYRILMIS statüsü eklenir. Entity'de açıklama alanı YOK — kod (≤20) etiketin kendisidir.
 */
export const IFS_CALISAN_STATULERI = [
  { EmployeeStatus: 'ISTEN AYRILMIS', Active: false, Preliminary: false, StatusObsolete: false, BusPlanInclude: false },
] as const

/** Karar 2 — MAVI/GRI personeli olsa da shop-floor'a alınmayan bölümler. */
export const SHOP_FLOOR_DISI: readonly string[] = ['İdari İşler']

/** Shop-floor'a giden yakalar. */
export const SHOP_FLOOR_YAKALAR: readonly string[] = ['MAVI', 'GRI']

/** IFS kod sınırları — türetilen kod bunları aşarsa senkron o kaydı ATLAR ve raporlar. */
export const IFS_KOD_SINIRI = { OrgCode: 10, PosCode: 10, LaborClassNo: 10, OrgName: 40, PositionTitle: 60, LaborClassDescription: 35 } as const

export class KodTuretmeHatasi extends Error {
  constructor(public readonly alan: keyof typeof IFS_KOD_SINIRI, public readonly deger: string) {
    super(`${alan} sınırı aşıldı (${IFS_KOD_SINIRI[alan]}): "${deger}"`)
    this.name = 'KodTuretmeHatasi'
  }
}

function sinirla(alan: keyof typeof IFS_KOD_SINIRI, deger: string): string {
  if (deger.length === 0 || deger.length > IFS_KOD_SINIRI[alan]) throw new KodTuretmeHatasi(alan, deger)
  return deger
}

/** `ORG-TF-P0021-N001` → `P0021-N001`. Kurul kodları (ORG-KR-*) hata. */
export function hubKodundanIfsKodu(hubCode: string): string {
  if (hubCode.startsWith(KURUL_KOD_ONEKI)) throw new KodTuretmeHatasi('OrgCode', hubCode)
  return hubCode.startsWith(HUB_KOD_ONEKI) ? hubCode.slice(HUB_KOD_ONEKI.length) : hubCode
}

export function orgKodu(hubCode: string): string {
  return sinirla('OrgCode', hubKodundanIfsKodu(hubCode))
}

export function posKodu(hubCode: string): string {
  return sinirla('PosCode', hubKodundanIfsKodu(hubCode))
}

export type KaynakTuru = 'R' | 'M'

/** Kaynakhane bölümünün Hub adı (DepartmentDefinition.name). */
export const KAYNAKHANE_BOLUM = 'Kaynakhane'

/**
 * Kaynakhane'de görevden sınıf: "ROBOT KAYNAK …" → R; diğer tüm kaynak görevleri
 * (MANUEL, PUNTA, TAŞLAMA & KUMLAMA, genel KAYNAK OPERATÖRÜ, bölüm sorumlusu) → M.
 */
export function kaynakTuru(gorev: string | null | undefined): KaynakTuru {
  return /ROBOT/i.test(gorev ?? '') ? 'R' : 'M'
}

/**
 * Labor class kodu: bölüm kodu tiresiz. `P0021-N001` → `P0021N001`; Kaynakhane → `P0021N001R|M`.
 */
export function laborClassKodu(bolumHubCode: string, opts?: { kaynakTuru?: KaynakTuru }): string {
  const govde = hubKodundanIfsKodu(bolumHubCode).replace(/-/g, '')
  return sinirla('LaborClassNo', opts?.kaynakTuru ? `${govde}${opts.kaynakTuru}` : govde)
}

export function laborClassAciklamasi(bolumAdi: string, tur?: KaynakTuru): string {
  const ek = tur === 'R' ? ' – Robot' : tur === 'M' ? ' – Manuel' : ''
  return (bolumAdi + ek).slice(0, IFS_KOD_SINIRI.LaborClassDescription)
}

/** Bölüm shop-floor'a girer mi? (Karar 2) */
export function bolumShopFloorMu(bolumAdi: string, maviGriPersonelVar: boolean): boolean {
  return maviGriPersonelVar && !SHOP_FLOOR_DISI.includes(bolumAdi)
}

/** Kişi shop-floor'a girer mi? Beyaz asla; MAVI/GRI yalnız bölümü shop-floor ise. */
export function kisiShopFloorMu(yakaRengi: string, bolumShopFloor: boolean): boolean {
  return SHOP_FLOOR_YAKALAR.includes(yakaRengi) && bolumShopFloor
}

/** Türkçe Başlık Hâli: "ABDULLAH MAKSUTOĞLU" → "Abdullah Maksutoğlu". */
export function baslikHali(metin: string): string {
  return metin
    .trim()
    .toLocaleLowerCase('tr-TR')
    .split(/\s+/)
    .map((k) => k.charAt(0).toLocaleUpperCase('tr-TR') + k.slice(1))
    .join(' ')
}

/**
 * adSoyad → { Fname, Lname }: son kelime soyad, kalanı ad. Tek kelimeyse Lname = ad
 * (IFS Lname boş kabul etmiyor). Çok soyadlı istisnalar kabul edilen kayıp (karar 1).
 */
export function adSoyadAyir(adSoyad: string): { Fname: string; Lname: string } {
  const parcalar = baslikHali(adSoyad).split(' ').filter(Boolean)
  if (parcalar.length <= 1) return { Fname: parcalar[0] ?? '', Lname: parcalar[0] ?? '' }
  return { Fname: parcalar.slice(0, -1).join(' '), Lname: parcalar[parcalar.length - 1] }
}

/** Hub cinsiyet → IFS Genders LOV ('Male' | 'Female'); bilinmeyen → undefined (gönderilmez). */
export function ifsCinsiyet(cinsiyet: string | null | undefined): 'Male' | 'Female' | undefined {
  if (cinsiyet === 'MALE') return 'Male'
  if (cinsiyet === 'FEMALE') return 'Female'
  return undefined
}

/** Date → 'YYYY-MM-DD' (UTC takvim günü; Hub @db.Date alanları UTC gece yarısı). */
export function ifsTarih(d: Date | string | null | undefined): string | null {
  if (!d) return null
  const t = typeof d === 'string' ? new Date(d) : d
  return Number.isNaN(t.getTime()) ? null : t.toISOString().slice(0, 10)
}

export function sicilSenkronKapsamindaMi(sicilNo: string | null | undefined): sicilNo is string {
  return typeof sicilNo === 'string' && sicilNo.startsWith(SICIL_ONEKI)
}

/**
 * Denetim aktörü — permission_audit_log.actor_id User FK'sıdır; 'cron:…' gibi
 * sahte id'ler FK'ya takılıp satırı sessizce düşürüyordu (16.09: 548+38 kayıt kayboldu).
 * Sistem hesabı (User.id = 'sistem', isActive=false, rolsüz, ldap-sync 'ad_' dışını
 * ellemez) oluşturulana kadar aktör yoksa denetim satırı ATLANIR, tek uyarı basılır.
 */
export const IFS_SYNC_AKTOR_ID = process.env.IFS_SYNC_AKTOR_ID ?? 'sistem'
/** HATA>0 in-app bildiriminin alıcısı (User.id). */
export const IFS_SYNC_BILDIRIM_USER_ID = process.env.IFS_SYNC_BILDIRIM_USER_ID ?? 'ad_melih.dilben'
