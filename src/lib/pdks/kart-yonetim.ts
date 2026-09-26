import 'server-only'
import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit-log'
import type { Prisma } from '@/generated/prisma'
import { PdksGirdiHatasi } from './cihaz-yonetim'
import { KartNoHatasi, kartHamCoz, kartNoBicimiOku, kartNoDonustur, kartNoGoster } from './kart-no'
import { kartiPasifYap, sonMutabakatOku } from './senkron'

/**
 * /pdks/kartlar servis katmanı. Okuma pdks.view, yazma pdks.manage (route'ta).
 * Panele DOĞRUDAN yazılmaz — tanımla/pasifle yalnız istenen durumu ve senkron defterini
 * günceller; senkron işçisi (senkron.ts) panele yakınsatır.
 */

export const PASIF_NEDENLERI = ['KAYIP', 'BOZUK', 'DEGISTI', 'IPTAL'] as const
export type PasifNedeni = (typeof PASIF_NEDENLERI)[number]

/** Kartın panel senkron durumu (tüm aktif cihazlar birleşik). */
export type SenkronDurumu = 'YUKLENDI' | 'BEKLIYOR' | 'HATA' | 'SILINDI' | 'YOK'

function senkronDurumu(kartAktif: boolean, satirlar: { durum: string }[]): SenkronDurumu {
  const d = satirlar.map((s) => s.durum)
  if (d.includes('HATA')) return 'HATA'
  if (kartAktif) {
    if (d.length === 0 || d.some((x) => x === 'BEKLIYOR' || x === 'SILINECEK')) return 'BEKLIYOR'
    return d.every((x) => x === 'YUKLENDI') ? 'YUKLENDI' : 'BEKLIYOR'
  }
  if (d.some((x) => x === 'SILINECEK' || x === 'BEKLIYOR' || x === 'YUKLENDI')) return 'BEKLIYOR'
  return d.length ? 'SILINDI' : 'YOK'
}

const departman = (p: { bolum: string; department: { name: string } | null }) => p.department?.name ?? p.bolum ?? null

// ── Liste + özet ─────────────────────────────────────────────────────────────

export interface KartListeSatiri {
  id: string
  kartNo: string // "118-63577"
  durum: 'AKTIF' | 'PASIF'
  pasifNedeni: string | null
  sicil: string | null
  adSoyad: string
  departman: string | null
  personelAktif: boolean
  senkron: SenkronDurumu
  senkronHata: string | null
  kaynak: string
  tanimlanma: string // ISO
}

export async function kartListesi(filtre: { durum?: 'AKTIF' | 'PASIF' | 'TUMU'; q?: string }) {
  const q = (filtre.q ?? '').trim()
  const qKart = q.replace(/[\s-]/g, '')
  const where: Prisma.PdksKartWhereInput = {
    ...(filtre.durum && filtre.durum !== 'TUMU' ? { durum: filtre.durum } : {}),
    ...(q
      ? {
          OR: [
            { personnel: { sicilNo: { contains: q, mode: 'insensitive' } } },
            { personnel: { adSoyad: { contains: q, mode: 'insensitive' } } },
            ...(qKart ? [{ kartNoHam: { contains: qKart } }] : []),
          ],
        }
      : {}),
  }
  const [kartlar, aktifCihaz, ozetHam, kartsizAktif, mutabakat] = await Promise.all([
    prisma.pdksKart.findMany({
      where,
      orderBy: [{ durum: 'asc' }, { createdAt: 'desc' }],
      take: 2000,
      select: {
        id: true, kartNoHam: true, kartNo: true, durum: true, pasifNedeni: true, kaynak: true, createdAt: true,
        personnel: { select: { sicilNo: true, adSoyad: true, aktif: true, bolum: true, department: { select: { name: true } } } },
        cihazDurumlari: { where: { cihaz: { aktif: true } }, select: { durum: true, sonHata: true } },
      },
    }),
    prisma.pdksCihaz.count({ where: { aktif: true, marka: 'HIKVISION' } }),
    prisma.pdksKart.findMany({
      select: { durum: true, cihazDurumlari: { where: { cihaz: { aktif: true } }, select: { durum: true } } },
    }),
    prisma.personnel.count({ where: { aktif: true, pdksKartlar: { none: { durum: 'AKTIF' } } } }),
    sonMutabakatOku(prisma),
  ])

  const satirlar: KartListeSatiri[] = kartlar.map((k) => ({
    id: k.id,
    kartNo: kartNoGoster(k.kartNoHam ?? k.kartNo),
    durum: k.durum,
    pasifNedeni: k.pasifNedeni,
    sicil: k.personnel.sicilNo,
    adSoyad: k.personnel.adSoyad,
    departman: departman(k.personnel),
    personelAktif: k.personnel.aktif,
    senkron: senkronDurumu(k.durum === 'AKTIF', k.cihazDurumlari),
    senkronHata: k.cihazDurumlari.find((d) => d.sonHata)?.sonHata ?? null,
    kaynak: k.kaynak,
    tanimlanma: k.createdAt.toISOString(),
  }))

  let aktifKart = 0
  let paneleYuklu = 0
  let senkronBekliyor = 0
  let senkronHata = 0
  for (const k of ozetHam) {
    const s = senkronDurumu(k.durum === 'AKTIF', k.cihazDurumlari)
    if (k.durum === 'AKTIF') {
      aktifKart++
      if (s === 'YUKLENDI') paneleYuklu++
    }
    if (s === 'BEKLIYOR') senkronBekliyor++
    if (s === 'HATA') senkronHata++
  }

  const tanimsiz = mutabakat?.cihazlar.reduce((t, c) => t + c.hubdaTanimsiz.length, 0) ?? 0
  const eksik = mutabakat?.cihazlar.reduce((t, c) => t + c.paneldeEksik.length, 0) ?? 0
  return {
    satirlar,
    ozet: { aktifKart, paneleYuklu, senkronBekliyor, senkronHata, kartsizAktifPersonel: kartsizAktif, aktifCihaz },
    mutabakat: mutabakat
      ? { zaman: mutabakat.zaman, hubdaTanimsiz: tanimsiz, paneldeEksik: eksik, cihazlar: mutabakat.cihazlar }
      : null,
  }
}

// ── Personel adayları (Kart tanımla) ─────────────────────────────────────────

export async function personelAdaylari(q: string) {
  const t = q.trim()
  const ps = await prisma.personnel.findMany({
    where: {
      aktif: true,
      sicilNo: { not: null },
      ...(t
        ? { OR: [{ sicilNo: { contains: t, mode: 'insensitive' } }, { adSoyad: { contains: t, mode: 'insensitive' } }] }
        : {}),
    },
    select: {
      id: true, sicilNo: true, adSoyad: true, bolum: true, department: { select: { name: true } },
      pdksKartlar: { where: { durum: 'AKTIF' }, select: { kartNoHam: true } },
    },
    orderBy: { adSoyad: 'asc' },
    take: 500,
  })
  return ps
    .map((p) => ({
      id: p.id,
      sicil: p.sicilNo,
      adSoyad: p.adSoyad,
      departman: departman(p),
      aktifKart: p.pdksKartlar[0]?.kartNoHam ? kartNoGoster(p.pdksKartlar[0].kartNoHam) : null,
    }))
    .sort((a, b) => Number(!!a.aktifKart) - Number(!!b.aktifKart)) // kartsızlar üstte (sıralama kararlı)
    .slice(0, 40)
}

// ── Tanımla / pasifle ────────────────────────────────────────────────────────

export async function kartTanimla(b: Record<string, unknown>, aktorId: string) {
  const personnelId = typeof b.personnelId === 'string' ? b.personnelId : ''
  if (!personnelId) throw new PdksGirdiHatasi('Personel seçilmeli')
  let ham: string
  try {
    ham = kartHamCoz(b.kartNo).ham
  } catch (e) {
    throw new PdksGirdiHatasi(e instanceof KartNoHatasi ? e.message : 'Kart no geçersiz')
  }
  const personel = await prisma.personnel.findUnique({
    where: { id: personnelId },
    select: { id: true, aktif: true, sicilNo: true, adSoyad: true, pdksKartlar: { where: { durum: 'AKTIF' }, select: { kartNoHam: true } } },
  })
  if (!personel) throw new PdksGirdiHatasi('Personel bulunamadı')
  if (!personel.aktif) throw new PdksGirdiHatasi('Pasif personele kart tanımlanamaz (aktif/pasif kaynağı Hub Personel kaydı)')
  if (!personel.sicilNo) throw new PdksGirdiHatasi('Personelin sicil no\'su yok — panelde kullanıcı kimliği sicildir')
  if (personel.pdksKartlar.length) {
    throw new PdksGirdiHatasi(`Bu personelin aktif kartı var (${kartNoGoster(personel.pdksKartlar[0].kartNoHam)}) — önce pasifleyin (neden: DEGISTI)`)
  }
  const baskasi = await prisma.pdksKart.findFirst({
    where: { kartNoHam: ham, durum: 'AKTIF' },
    select: { personnel: { select: { sicilNo: true } } },
  })
  if (baskasi) throw new PdksGirdiHatasi(`${kartNoGoster(ham)} kartı ${baskasi.personnel.sicilNo ?? 'başka bir kişide'} aktif`)
  let bicim
  try {
    bicim = await kartNoBicimiOku(prisma)
  } catch (e) {
    throw new PdksGirdiHatasi(e instanceof KartNoHatasi ? e.message : 'Kart no biçimi okunamadı')
  }

  return prisma.$transaction(async (tx) => {
    const cihazlar = await tx.pdksCihaz.findMany({ where: { aktif: true, marka: 'HIKVISION' }, select: { id: true } })
    const kart = await tx.pdksKart.create({
      data: {
        kartNoHam: ham,
        kartNo: kartNoDonustur(ham, bicim),
        personnelId: personel.id,
        durum: 'AKTIF',
        gecerliBaslangic: new Date(),
        kaynak: 'MANUEL',
        createdById: aktorId,
      },
      select: { id: true },
    })
    if (cihazlar.length) {
      await tx.pdksKartCihaz.createMany({ data: cihazlar.map((c) => ({ kartId: kart.id, cihazId: c.id, durum: 'BEKLIYOR' })) })
    }
    await logAuditEvent({
      tx,
      action: 'PDKS_KART_CREATED',
      actorId: aktorId,
      targetType: 'PDKS_KART',
      targetId: kart.id,
      details: { sicil: personel.sicilNo, kart: kartNoGoster(ham), bicim, kaynak: 'MANUEL' },
    })
    return kart
  })
}

export async function kartPasifle(id: string, b: Record<string, unknown>, aktorId: string) {
  const neden = b.neden as PasifNedeni
  if (!PASIF_NEDENLERI.includes(neden)) throw new PdksGirdiHatasi(`Neden ${PASIF_NEDENLERI.join(' / ')} olmalı`)
  const kart = await prisma.pdksKart.findUnique({
    where: { id },
    select: { id: true, durum: true, kartNoHam: true, personnel: { select: { sicilNo: true } } },
  })
  if (!kart) throw new PdksGirdiHatasi('Kart bulunamadı')
  if (kart.durum !== 'AKTIF') throw new PdksGirdiHatasi('Kart zaten pasif')
  await prisma.$transaction(async (tx) => {
    await kartiPasifYap(tx, id, neden, aktorId)
    await logAuditEvent({
      tx,
      action: 'PDKS_KART_PASIFLENDI',
      actorId: aktorId,
      targetType: 'PDKS_KART',
      targetId: id,
      details: { neden, sicil: kart.personnel.sicilNo, kart: kartNoGoster(kart.kartNoHam) },
    })
  })
}

// ── Geçmiş ───────────────────────────────────────────────────────────────────

export async function kartGecmisi(id: string) {
  const kart = await prisma.pdksKart.findUnique({
    where: { id },
    select: {
      id: true, kartNoHam: true, kaynak: true, createdAt: true, createdById: true, durum: true, pasifNedeni: true, pasifAt: true,
      personnel: { select: { sicilNo: true, adSoyad: true } },
      cihazDurumlari: {
        select: { durum: true, deneme: true, sonHata: true, sonDenemeAt: true, yuklendiAt: true, cihaz: { select: { kod: true, ad: true } } },
      },
    },
  })
  if (!kart) throw new PdksGirdiHatasi('Kart bulunamadı')
  const olaylar = await prisma.permissionAuditLog.findMany({
    where: { targetType: 'PDKS_KART', targetId: id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, action: true, actorId: true, details: true, createdAt: true },
  })
  const aktorIdleri = [...new Set([kart.createdById, ...olaylar.map((o) => o.actorId)])]
  const kullanicilar = await prisma.user.findMany({ where: { id: { in: aktorIdleri } }, select: { id: true, name: true, email: true } })
  const ad = (uid: string) => {
    if (uid === 'sistem') return 'Sistem'
    const u = kullanicilar.find((x) => x.id === uid)
    return u?.name ?? u?.email ?? uid
  }
  return {
    kart: {
      kartNo: kartNoGoster(kart.kartNoHam),
      sicil: kart.personnel.sicilNo,
      adSoyad: kart.personnel.adSoyad,
      durum: kart.durum,
      pasifNedeni: kart.pasifNedeni,
      kaynak: kart.kaynak,
      olusturma: kart.createdAt.toISOString(),
      olusturan: ad(kart.createdById),
    },
    panel: kart.cihazDurumlari.map((d) => ({
      cihaz: d.cihaz.kod,
      durum: d.durum,
      deneme: d.deneme,
      sonHata: d.sonHata,
      sonDeneme: d.sonDenemeAt?.toISOString() ?? null,
      yuklendi: d.yuklendiAt?.toISOString() ?? null,
    })),
    olaylar: olaylar.map((o) => ({ id: o.id, action: o.action, aktor: ad(o.actorId), zaman: o.createdAt.toISOString(), details: o.details })),
  }
}
