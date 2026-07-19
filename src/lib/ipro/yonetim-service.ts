import 'server-only'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { hashPin } from '@/lib/pin-utils'

/**
 * IPRO yönetim modülü servis katmanı (FAZ 1 — tanımlar + kiosk cihaz yönetimi).
 *
 * Tüm prisma erişimi burada; route'lar yalnız yetki + zarf işi yapar.
 *
 * NOT (IPRO bloğu geneliyle tutarlı): IproOperatorTezgah.personnelId FK'sız
 * çıplak String. Personel bilgisi ilişki üzerinden ÇEKİLEMEZ, ikinci sorguyla
 * eşleştirilir.
 */

// ── Tezgah ───────────────────────────────────────────────────────────────

export type TezgahSatir = {
  id: string
  kod: string
  ad: string
  masGrupKodu: string | null
  masGrupAdi: string | null
  ifsWorkCenterNo: string | null
  ifsResourceId: string | null
  aktif: boolean
  /** PLC pini var mı — alan değil, türetilir. Sinyalli tezgahta sayaç okunur. */
  sinyalli: boolean
  operatorSayisi: number
}

export async function listTezgahlar(): Promise<TezgahSatir[]> {
  const rows = await prisma.iproTezgah.findMany({
    orderBy: { kod: 'asc' },
    select: {
      id: true,
      kod: true,
      ad: true,
      masGrupKodu: true,
      masGrupAdi: true,
      ifsWorkCenterNo: true,
      ifsResourceId: true,
      aktif: true,
      _count: { select: { plcPinler: true, operatorler: true } },
    },
  })
  return rows.map((t) => ({
    id: t.id,
    kod: t.kod,
    ad: t.ad,
    masGrupKodu: t.masGrupKodu,
    masGrupAdi: t.masGrupAdi,
    ifsWorkCenterNo: t.ifsWorkCenterNo,
    ifsResourceId: t.ifsResourceId,
    aktif: t.aktif,
    sinyalli: t._count.plcPinler > 0,
    operatorSayisi: t._count.operatorler,
  }))
}

/** Tezgah EKLEME/SİLME bilinçli olarak YOK — kaynak MAS import'u (bkz. import-tezgah.ts). */
export type TezgahGuncelle = {
  ad?: string
  ifsWorkCenterNo?: string | null
  ifsResourceId?: string | null
  aktif?: boolean
}

export async function updateTezgah(id: string, data: TezgahGuncelle) {
  return prisma.iproTezgah.update({ where: { id }, data, select: { id: true, kod: true } })
}

// ── Operatör eşlemeleri ──────────────────────────────────────────────────

export type OperatorEslemeSatir = {
  id: string
  personnelId: string
  adSoyad: string | null
  sicilNo: string | null
  bolum: string | null
  personelAktif: boolean | null
  kaynak: string
  aktif: boolean
}

export async function listOperatorEslemeleri(tezgahId: string): Promise<OperatorEslemeSatir[]> {
  const esl = await prisma.iproOperatorTezgah.findMany({
    where: { tezgahId },
    select: { id: true, personnelId: true, kaynak: true, aktif: true },
  })
  if (esl.length === 0) return []

  // personnelId FK'sız → ikinci sorgu ile eşle. Silinmiş personel null kalır.
  const personeller = await prisma.personnel.findMany({
    where: { id: { in: esl.map((e) => e.personnelId) } },
    select: { id: true, adSoyad: true, sicilNo: true, bolum: true, aktif: true },
  })
  const byId = new Map(personeller.map((p) => [p.id, p]))

  return esl
    .map((e) => {
      const p = byId.get(e.personnelId)
      return {
        id: e.id,
        personnelId: e.personnelId,
        adSoyad: p?.adSoyad ?? null,
        sicilNo: p?.sicilNo ?? null,
        bolum: p?.bolum ?? null,
        personelAktif: p?.aktif ?? null,
        kaynak: e.kaynak,
        aktif: e.aktif,
      }
    })
    .sort((a, b) => (a.adSoyad ?? '').localeCompare(b.adSoyad ?? '', 'tr'))
}

/**
 * Operatör eklerken kullanılan personel araması. Ad veya sicilde geçen AKTİF
 * personeli döner. Mevcut `PersonnelAutocomplete` bileşeni isim string'i
 * döndürdüğü için (id değil) kendi ucumuz gerekti.
 */
export async function personelAra(q: string, limit = 20) {
  const aranan = q.trim()
  if (aranan.length < 2) return []
  return prisma.personnel.findMany({
    where: {
      aktif: true,
      OR: [
        { adSoyad: { contains: aranan, mode: 'insensitive' } },
        { sicilNo: { contains: aranan, mode: 'insensitive' } },
      ],
    },
    select: { id: true, adSoyad: true, sicilNo: true, bolum: true, gorev: true },
    orderBy: { adSoyad: 'asc' },
    take: limit,
  })
}

export async function addOperatorEsleme(tezgahId: string, personnelId: string) {
  // (personnelId, tezgahId) unique — var olan pasifse yeniden aktifleştir.
  return prisma.iproOperatorTezgah.upsert({
    where: { personnelId_tezgahId: { personnelId, tezgahId } },
    update: { aktif: true },
    create: { personnelId, tezgahId, aktif: true, kaynak: 'MANUEL' },
    select: { id: true },
  })
}

export async function setOperatorEslemeAktif(id: string, aktif: boolean) {
  return prisma.iproOperatorTezgah.update({ where: { id }, data: { aktif }, select: { id: true } })
}

export async function deleteOperatorEsleme(id: string) {
  return prisma.iproOperatorTezgah.delete({ where: { id }, select: { id: true } })
}

// ── Hurda sebepleri ──────────────────────────────────────────────────────

const HURDA_ALANLAR = {
  kod: true,
  ad: true,
  erpKodu: true,
  grupKodu: true,
  grubu: true,
  uretimHurdaRework: true,
  rework: true,
  hurda: true,
  bilesenHurdaRework: true,
  oeeEtkiler: true,
  yorumZorunlu: true,
  sinyalsizGiris: true,
  aktif: true,
} as const

export type HurdaSebebiGirdi = {
  kod: string
  ad: string
  erpKodu?: string | null
  grupKodu?: string | null
  grubu?: string | null
  uretimHurdaRework?: boolean
  rework?: boolean
  hurda?: boolean
  bilesenHurdaRework?: boolean
  oeeEtkiler?: boolean
  yorumZorunlu?: boolean
  sinyalsizGiris?: boolean
  aktif?: boolean
}

export async function listHurdaSebepleri() {
  return prisma.iproHurdaSebebi.findMany({
    orderBy: { kod: 'asc' },
    select: { id: true, ...HURDA_ALANLAR },
  })
}

export async function createHurdaSebebi(data: HurdaSebebiGirdi) {
  return prisma.iproHurdaSebebi.create({ data, select: { id: true, kod: true } })
}

export async function updateHurdaSebebi(id: string, data: Partial<HurdaSebebiGirdi>) {
  return prisma.iproHurdaSebebi.update({ where: { id }, data, select: { id: true, kod: true } })
}

// ── Duruş tipleri ────────────────────────────────────────────────────────

export async function listDurusTipleri() {
  return prisma.iproDurusTipi.findMany({
    orderBy: [{ teepOrder: 'asc' }, { kod: 'asc' }],
    select: { id: true, kod: true, ad: true, teepOrder: true, aktif: true, _count: { select: { sebepler: true } } },
  })
}

export type DurusTipiGirdi = { kod: string; ad: string; teepOrder?: number | null; aktif?: boolean }

export async function createDurusTipi(data: DurusTipiGirdi) {
  return prisma.iproDurusTipi.create({ data, select: { id: true, kod: true } })
}

export async function updateDurusTipi(id: string, data: Partial<DurusTipiGirdi>) {
  return prisma.iproDurusTipi.update({ where: { id }, data, select: { id: true, kod: true } })
}

// ── Duruş sebepleri ──────────────────────────────────────────────────────

/** MAS "Bitiş Tipi" kolonundaki mevcut değerler (dev DB: Both 92, Manual 23). */
export const BITIS_TIPLERI = ['Both', 'Manual'] as const

export type DurusSebebiGirdi = {
  kod: string
  ad: string
  erpKodu?: string | null
  tipId?: string | null
  bitisTipi: string
  renkKodu?: string | null
  temelSebep?: string | null
  planli?: boolean
  uretimDisi?: boolean
  setupDurusu?: boolean
  plcKilitle?: boolean
  askiyaAl?: boolean
  makineKaynakli?: boolean
  operatorKaynakli?: boolean
  yetkiliOnayGerekli?: boolean
  durusAktifkenIsBitirilemez?: boolean
  uretimdeGosterilsin?: boolean
  aktif?: boolean
}

export async function listDurusSebepleri() {
  return prisma.iproDurusSebebi.findMany({
    orderBy: { kod: 'asc' },
    select: {
      id: true,
      kod: true,
      ad: true,
      erpKodu: true,
      tipId: true,
      tip: { select: { id: true, kod: true, ad: true } },
      bitisTipi: true,
      renkKodu: true,
      temelSebep: true,
      planli: true,
      uretimDisi: true,
      setupDurusu: true,
      plcKilitle: true,
      askiyaAl: true,
      makineKaynakli: true,
      operatorKaynakli: true,
      yetkiliOnayGerekli: true,
      durusAktifkenIsBitirilemez: true,
      uretimdeGosterilsin: true,
      aktif: true,
    },
  })
}

export async function createDurusSebebi(data: DurusSebebiGirdi) {
  return prisma.iproDurusSebebi.create({ data, select: { id: true, kod: true } })
}

export async function updateDurusSebebi(id: string, data: Partial<DurusSebebiGirdi>) {
  return prisma.iproDurusSebebi.update({ where: { id }, data, select: { id: true, kod: true } })
}

// ── IFS eşlemeleri ───────────────────────────────────────────────────────

export type IfsEslesmeGirdi = {
  tip: 'ORG' | 'POZISYON'
  ilerihubDeger: string
  ifsKod: string
  aciklama?: string | null
  aktif?: boolean
}

export async function listIfsEslemeleri() {
  return prisma.iproIfsEslesme.findMany({
    orderBy: [{ tip: 'asc' }, { ilerihubDeger: 'asc' }],
    select: {
      id: true,
      tip: true,
      ilerihubDeger: true,
      ifsKod: true,
      aciklama: true,
      aktif: true,
      updatedAt: true,
    },
  })
}

export async function createIfsEsleme(data: IfsEslesmeGirdi) {
  return prisma.iproIfsEslesme.create({ data, select: { id: true } })
}

export async function updateIfsEsleme(id: string, data: Partial<IfsEslesmeGirdi>) {
  return prisma.iproIfsEslesme.update({ where: { id }, data, select: { id: true } })
}

export async function deleteIfsEsleme(id: string) {
  return prisma.iproIfsEslesme.delete({ where: { id }, select: { id: true } })
}

// ── Kiosk cihazları ──────────────────────────────────────────────────────

export type KioskSatir = {
  id: string
  kod: string
  ad: string
  aktif: boolean
  sonGirisAt: Date | null
  userEmail: string
  userAktif: boolean
  tezgahlar: { id: string; kod: string; ad: string }[]
}

export async function listKiosklar(): Promise<KioskSatir[]> {
  const rows = await prisma.iproKiosk.findMany({
    orderBy: { kod: 'asc' },
    select: {
      id: true,
      kod: true,
      ad: true,
      aktif: true,
      sonGirisAt: true,
      user: { select: { email: true, isActive: true } },
      tezgahlar: { select: { tezgah: { select: { id: true, kod: true, ad: true } } } },
    },
  })
  return rows.map((k) => ({
    id: k.id,
    kod: k.kod,
    ad: k.ad,
    aktif: k.aktif,
    sonGirisAt: k.sonGirisAt,
    userEmail: k.user.email,
    userAktif: k.user.isActive,
    tezgahlar: k.tezgahlar.map((t) => t.tezgah),
  }))
}

/**
 * Cihaz şifresi üretir. PIN DEĞİL — `validatePinStrength` uygulanmaz (bkz.
 * IproKiosk.sifreHash yorumu). Karışma riski olan karakterler (0/O, 1/l/I)
 * alfabeden çıkarıldı: atölyede elle girilecek.
 */
function sifreUret(uzunluk = 10): string {
  const alfabe = 'abcdefghjkmnpqrstuvwxyz23456789'
  const b = randomBytes(uzunluk)
  return Array.from(b, (x) => alfabe[x % alfabe.length]).join('')
}

/** Kiosk kodundan sentetik e-posta — seed-test-kiosk.ts ile aynı alan adı. */
function kioskEmail(kod: string): string {
  return `${kod.toLowerCase()}@kiosk.ilerigroup.com`
}

export type KioskOlusturGirdi = { kod: string; ad: string; tezgahIds: string[] }

/**
 * Cihaz oluşturur: User(role=KIOSK) + IproKiosk + tezgah bağları, TEK transaction.
 * Üretilen şifre YALNIZCA burada döner — DB'de bcrypt hash tutulur, bir daha
 * gösterilemez (kaybolursa "şifre yenile" ile yenisi üretilir).
 *
 * employeeId bilinçli olarak verilmez → İK/bluecollar listelerine düşmez.
 */
export async function createKiosk(g: KioskOlusturGirdi): Promise<{ id: string; kod: string; sifre: string }> {
  const kod = g.kod.trim().toUpperCase()
  const sifre = sifreUret()
  const sifreHash = await hashPin(sifre)
  const email = kioskEmail(kod)

  const kiosk = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, name: g.ad, role: 'KIOSK', isActive: true },
      select: { id: true },
    })
    const k = await tx.iproKiosk.create({
      data: { kod, ad: g.ad, sifreHash, userId: user.id, aktif: true },
      select: { id: true, kod: true },
    })
    if (g.tezgahIds.length > 0) {
      await tx.iproKioskTezgah.createMany({
        data: g.tezgahIds.map((tezgahId) => ({ kioskId: k.id, tezgahId })),
        skipDuplicates: true,
      })
    }
    return k
  })

  return { ...kiosk, sifre }
}

export type KioskGuncelleGirdi = { ad?: string; aktif?: boolean; tezgahIds?: string[] }

/** Cihazı günceller. tezgahIds verilirse bağlar TAMAMEN o listeyle değiştirilir. */
export async function updateKiosk(id: string, g: KioskGuncelleGirdi) {
  return prisma.$transaction(async (tx) => {
    const k = await tx.iproKiosk.update({
      where: { id },
      data: { ...(g.ad !== undefined ? { ad: g.ad } : {}), ...(g.aktif !== undefined ? { aktif: g.aktif } : {}) },
      select: { id: true, kod: true, userId: true },
    })
    // Cihaz pasifleşince User da pasifleşmeli — yoksa hesap login açmaya devam eder.
    if (g.aktif !== undefined) {
      await tx.user.update({ where: { id: k.userId }, data: { isActive: g.aktif } })
    }
    if (g.tezgahIds) {
      await tx.iproKioskTezgah.deleteMany({ where: { kioskId: id, tezgahId: { notIn: g.tezgahIds } } })
      await tx.iproKioskTezgah.createMany({
        data: g.tezgahIds.map((tezgahId) => ({ kioskId: id, tezgahId })),
        skipDuplicates: true,
      })
    }
    return k
  })
}

/** Yeni şifre üretir ve DÖNER (bir kez gösterilir); eski şifre geçersizleşir. */
export async function yenileKioskSifre(id: string): Promise<{ id: string; kod: string; sifre: string }> {
  const sifre = sifreUret()
  const k = await prisma.iproKiosk.update({
    where: { id },
    data: { sifreHash: await hashPin(sifre) },
    select: { id: true, kod: true },
  })
  return { ...k, sifre }
}
