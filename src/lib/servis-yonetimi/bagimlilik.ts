import type { Prisma } from '@/generated/prisma'

// A4 — Bağımlılık korumaları (proje kuralı: bağlı kayıt etkisi ÖLÇÜLÜR,
// kullanıcı uyarılmadan uygulanmaz).
//
// 1) Pasifleştirme: bağlı AKTİF kayıtlar sayılır. Varsa istek, açık onay
//    (onay: true) olmadan REDDEDİLİR (BagliKayitHatasi → API 409). Onaylı
//    pasifleştirmede bağlı kayıtlar OTOMATİK KAPATILMAZ; onay ve özet audit'e
//    (aciklama) yazılır.
// 2) Kod kimliktir: güzergâh/durak kodu, atama/şikâyet gibi kullanım kaydı
//    varsa DEĞİŞTİRİLEMEZ (ad serbest).
//
// KVKK (madde 23): kişiyle ilgili gruplarda (personel ataması, şoför atamaları)
// YALNIZ sayı döner; örnek satır (ad/sicil) HİÇ taşınmaz. Örnekler yalnız
// konum/operasyon bilgisi (güzergâh kodu, plaka, dilim kodu, durak) içerir.

export type BagimlilikGrubu = {
  /** Makine adı: GUZERGAH, ARAC, SOFOR, PERSONEL_ATAMA, ... */
  tur: string
  /** Kullanıcıya gösterilen ad: "Aktif güzergâh" */
  etiket: string
  sayi: number
  /** En fazla ORNEK_LIMITI adet; kişisel veri içermez. */
  ornekler: string[]
}

export const ORNEK_LIMITI = 5
/** Firma zinciri: atamalar güzergâh adlarıyla listelenir; biraz daha geniş. */
export const FIRMA_ORNEK_LIMITI = 10

export class BagliKayitHatasi extends Error {
  readonly bagimliliklar: BagimlilikGrubu[]
  /** true: onaylanırsa bağlı kayıtlar BİRLİKTE pasifleşir/kapanır (yalnız firma, A5). */
  readonly zincirleme: boolean
  readonly notlar: string[]
  constructor(
    mesaj: string,
    bagimliliklar: BagimlilikGrubu[],
    ek?: { zincirleme?: boolean; notlar?: string[] },
  ) {
    super(mesaj)
    this.name = 'BagliKayitHatasi'
    this.bagimliliklar = bagimliliklar
    this.zincirleme = ek?.zincirleme ?? false
    this.notlar = ek?.notlar ?? []
  }
}

type Db = Prisma.TransactionClient

function grup(
  tur: string,
  etiket: string,
  sayi: number,
  ornekler: string[] = [],
  limit: number = ORNEK_LIMITI,
): BagimlilikGrubu | null {
  return sayi > 0 ? { tur, etiket, sayi, ornekler: ornekler.slice(0, limit) } : null
}

const dolu = (gruplar: (BagimlilikGrubu | null)[]): BagimlilikGrubu[] =>
  gruplar.filter((g): g is BagimlilikGrubu => g !== null)

export function bagimlilikToplami(gruplar: BagimlilikGrubu[]): number {
  return gruplar.reduce((t, g) => t + g.sayi, 0)
}

/** "2 aktif güzergâh, 1 aktif araç" — mesaj ve audit için. */
export function bagimlilikOzeti(gruplar: BagimlilikGrubu[]): string {
  return gruplar.map((g) => `${g.sayi} ${g.etiket.toLocaleLowerCase('tr-TR')}`).join(', ')
}

// ----------------------------------------------------------------------------
// Pasifleştirme — bağlı AKTİF kayıtlar
// ----------------------------------------------------------------------------

export async function yerleskeBagimliliklari(db: Db, id: string): Promise<BagimlilikGrubu[]> {
  const where = { yerleskeId: id, aktif: true }
  const [sayi, ornek] = await Promise.all([
    db.servisGuzergah.count({ where }),
    db.servisGuzergah.findMany({ where, select: { kod: true, ad: true }, orderBy: { kod: 'asc' }, take: ORNEK_LIMITI }),
  ])
  return dolu([grup('GUZERGAH', 'Aktif güzergâh', sayi, ornek.map((g) => `${g.kod} — ${g.ad}`))])
}

/**
 * Firma (A5 — zincirleme): onaylanırsa PASİFLEŞECEK aktif araç/şoförler ve
 * KAPANACAK aktif varsayılan araç/şoför atamaları. Şoförlerde (kişi) yalnız sayı.
 * Atamalar firmanın TÜM araç/şoförleri üzerinden sayılır (pasif araca bağlı aktif
 * atama da kapanır).
 */
export async function firmaBagimliliklari(db: Db, id: string): Promise<BagimlilikGrubu[]> {
  const aktif = { firmaId: id, aktif: true }
  const [aracSayi, aracOrnek, soforSayi, tumAraclar, tumSoforler] = await Promise.all([
    db.servisArac.count({ where: aktif }),
    db.servisArac.findMany({ where: aktif, select: { plaka: true }, orderBy: { plaka: 'asc' }, take: FIRMA_ORNEK_LIMITI }),
    db.servisSofor.count({ where: aktif }),
    db.servisArac.findMany({ where: { firmaId: id }, select: { id: true } }),
    db.servisSofor.findMany({ where: { firmaId: id }, select: { id: true } }),
  ])
  const aracAtama = { aracId: { in: tumAraclar.map((a) => a.id) }, aktif: true }
  const soforAtama = { soforId: { in: tumSoforler.map((s) => s.id) }, aktif: true }
  const [aracAtamaSayi, aracAtamaOrnek, soforAtamaSayi] = await Promise.all([
    db.servisGuzergahAracVarsayilan.count({ where: aracAtama }),
    db.servisGuzergahAracVarsayilan.findMany({
      where: aracAtama,
      select: { guzergah: { select: { kod: true, ad: true } }, dilim: { select: { kod: true } } },
      take: FIRMA_ORNEK_LIMITI,
    }),
    db.servisGuzergahSoforVarsayilan.count({ where: soforAtama }),
  ])
  return dolu([
    grup('ARAC', 'Aktif araç', aracSayi, aracOrnek.map((a) => a.plaka), FIRMA_ORNEK_LIMITI),
    grup('SOFOR', 'Aktif şoför', soforSayi), // kişi: yalnız sayı
    grup(
      'ARAC_VARSAYILAN',
      'Aktif varsayılan araç ataması',
      aracAtamaSayi,
      aracAtamaOrnek.map((v) => `${v.guzergah.kod} — ${v.guzergah.ad} (${v.dilim.kod})`),
      FIRMA_ORNEK_LIMITI,
    ),
    grup('SOFOR_VARSAYILAN', 'Aktif varsayılan şoför ataması', soforAtamaSayi), // kişi: yalnız sayı
  ])
}

export async function aracBagimliliklari(db: Db, id: string): Promise<BagimlilikGrubu[]> {
  const where = { aracId: id, aktif: true }
  const [sayi, ornek] = await Promise.all([
    db.servisGuzergahAracVarsayilan.count({ where }),
    db.servisGuzergahAracVarsayilan.findMany({
      where,
      select: { guzergah: { select: { kod: true } }, dilim: { select: { kod: true } } },
      take: ORNEK_LIMITI,
    }),
  ])
  return dolu([
    grup('ARAC_VARSAYILAN', 'Aktif varsayılan araç ataması', sayi, ornek.map((v) => `${v.guzergah.kod} / ${v.dilim.kod}`)),
  ])
}

export async function soforBagimliliklari(db: Db, id: string): Promise<BagimlilikGrubu[]> {
  const where = { soforId: id, aktif: true }
  const [sayi, ornek] = await Promise.all([
    db.servisGuzergahSoforVarsayilan.count({ where }),
    db.servisGuzergahSoforVarsayilan.findMany({
      where,
      select: { guzergah: { select: { kod: true } }, dilim: { select: { kod: true } } },
      take: ORNEK_LIMITI,
    }),
  ])
  return dolu([
    grup('SOFOR_VARSAYILAN', 'Aktif varsayılan şoför ataması', sayi, ornek.map((v) => `${v.guzergah.kod} / ${v.dilim.kod}`)),
  ])
}

export async function guzergahBagimliliklari(db: Db, id: string): Promise<BagimlilikGrubu[]> {
  const where = { guzergahId: id, aktif: true }
  const [personelSayi, aracSayi, aracOrnek, soforSayi] = await Promise.all([
    db.servisPersonelAtama.count({ where }),
    db.servisGuzergahAracVarsayilan.count({ where }),
    db.servisGuzergahAracVarsayilan.findMany({
      where,
      select: { arac: { select: { plaka: true } }, dilim: { select: { kod: true } } },
      take: ORNEK_LIMITI,
    }),
    db.servisGuzergahSoforVarsayilan.count({ where }),
  ])
  return dolu([
    grup('PERSONEL_ATAMA', 'Aktif personel ataması', personelSayi), // kişi: yalnız sayı
    grup('ARAC_VARSAYILAN', 'Aktif varsayılan araç ataması', aracSayi, aracOrnek.map((v) => `${v.arac.plaka} / ${v.dilim.kod}`)),
    grup('SOFOR_VARSAYILAN', 'Aktif varsayılan şoför ataması', soforSayi), // kişi: yalnız sayı
  ])
}

export async function seferDilimiBagimliliklari(db: Db, id: string): Promise<BagimlilikGrubu[]> {
  const aktifDilim = { dilimId: id, aktif: true }
  const [aracSayi, aracOrnek, soforSayi, personelSayi, saatSayi] = await Promise.all([
    db.servisGuzergahAracVarsayilan.count({ where: aktifDilim }),
    db.servisGuzergahAracVarsayilan.findMany({
      where: aktifDilim,
      select: { guzergah: { select: { kod: true } }, arac: { select: { plaka: true } } },
      take: ORNEK_LIMITI,
    }),
    db.servisGuzergahSoforVarsayilan.count({ where: aktifDilim }),
    db.servisPersonelAtamaDilim.count({ where: { dilimId: id, atama: { aktif: true } } }),
    db.servisGuzergahDurakSaat.count({ where: aktifDilim }),
  ])
  return dolu([
    grup('ARAC_VARSAYILAN', 'Aktif varsayılan araç ataması', aracSayi, aracOrnek.map((v) => `${v.guzergah.kod} / ${v.arac.plaka}`)),
    grup('SOFOR_VARSAYILAN', 'Aktif varsayılan şoför ataması', soforSayi),
    grup('PERSONEL_ATAMA', 'Aktif personel ataması', personelSayi),
    grup('DURAK_SAAT', 'Aktif durak saati', saatSayi),
  ])
}

// ----------------------------------------------------------------------------
// Kod değişikliği — kullanım kaydı (aktif VE pasif; geçmiş de sayılır)
// ----------------------------------------------------------------------------

export async function guzergahKodKullanimi(db: Db, id: string): Promise<BagimlilikGrubu[]> {
  const where = { guzergahId: id }
  const [personel, arac, sofor, sorumlu, sikayet] = await Promise.all([
    db.servisPersonelAtama.count({ where }),
    db.servisGuzergahAracVarsayilan.count({ where }),
    db.servisGuzergahSoforVarsayilan.count({ where }),
    db.servisSorumlusu.count({ where }),
    db.servisSikayet.count({ where }),
  ])
  return dolu([
    grup('PERSONEL_ATAMA', 'personel ataması', personel),
    grup('ARAC_VARSAYILAN', 'varsayılan araç ataması', arac),
    grup('SOFOR_VARSAYILAN', 'varsayılan şoför ataması', sofor),
    grup('SORUMLU', 'servis sorumlusu ataması', sorumlu),
    grup('SIKAYET', 'şikâyet', sikayet),
  ])
}

export async function durakKodKullanimi(db: Db, id: string): Promise<BagimlilikGrubu[]> {
  const where = { durakId: id }
  const [personel, sikayet] = await Promise.all([
    db.servisPersonelAtama.count({ where }),
    db.servisSikayet.count({ where }),
  ])
  return dolu([
    grup('PERSONEL_ATAMA', 'personel ataması', personel),
    grup('SIKAYET', 'şikâyet', sikayet),
  ])
}

export function kodDegistirilemezMesaji(varlik: 'güzergâhın' | 'durağın', gruplar: BagimlilikGrubu[]): string {
  return `Bu ${varlik} kodu değiştirilemez: ${bagimlilikOzeti(gruplar)} bu kodla ilişkili. Ad serbestçe değiştirilebilir.`
}

export function bagliKayitMesaji(varlik: string, gruplar: BagimlilikGrubu[]): string {
  return `${varlik} pasifleştirilemez: bağlı aktif kayıtlar var (${bagimlilikOzeti(gruplar)}). Bağlı kayıtlar otomatik kapatılmaz; onaylarsanız yalnız bu kayıt pasifleştirilir.`
}

/** Onaylı pasifleştirmenin audit açıklaması (tarihçede görünür). */
export function onayAciklamasi(gruplar: BagimlilikGrubu[]): string {
  return `Bağlı aktif kayıtlar varken kullanıcı onayıyla pasifleştirildi: ${bagimlilikOzeti(gruplar)}. Bağlı kayıtlar otomatik kapatılmadı.`
}

// ----------------------------------------------------------------------------
// Firma zinciri (A5) — mesajlar
// ----------------------------------------------------------------------------

export const FIRMA_ZINCIR_NOTU = 'Araçlar yeni firmaya geçiyorsa önce araçların firmasını değiştirin.'

export function firmaZincirMesaji(gruplar: BagimlilikGrubu[]): string {
  return `Firma pasifleştirilirse bağlı aktif kayıtlar birlikte pasifleşir/kapanır (${bagimlilikOzeti(gruplar)}). ${FIRMA_ZINCIR_NOTU}`
}

/** Zincirleme pasifleştirmede firmanın audit açıklaması (özet). */
export function firmaZincirOzetAciklamasi(gruplar: BagimlilikGrubu[]): string {
  return `Firma kullanıcı onayıyla pasifleştirildi; bağlı kayıtlar birlikte pasifleşti/kapandı: ${bagimlilikOzeti(gruplar)}.`
}
