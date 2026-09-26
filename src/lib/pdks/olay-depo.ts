import 'server-only'
import { randomUUID } from 'node:crypto'
import type { Prisma, PrismaClient } from '@/generated/prisma'
import type { BoslukUyarisi, CihazGuncelleme, GecisKaydi, OlayDeposu } from './olay-alim'
import { OLAY_ESLEME_ANAHTARI, olayEslemeBirlestir, type OlayEsleme } from './olay-esleme'

/** Kaybedilen (24 saatte doldurulamayan) boşluk uyarıları — sağlık kartı okur. Son 50 tutulur. */
export const BOSLUK_UYARI_ANAHTARI = 'pdks_bosluk_uyarilari'
const BOSLUK_UYARI_TUT = 50

export function prismaOlayDeposu(db: PrismaClient): OlayDeposu {
  return {
    async kartBul(cardNo) {
      const k = await db.pdksKart.findFirst({
        where: { kartNo: cardNo },
        orderBy: [{ durum: 'asc' }, { createdAt: 'desc' }], // enum sırası AKTIF < PASIF → AKTİF önce
        select: { personnelId: true, durum: true, personnel: { select: { aktif: true } } },
      })
      return k ? { personnelId: k.personnelId, durum: k.durum, personelAktif: k.personnel.aktif } : null
    },

    async okuyucuBul(cihazId, doorNo, readerNo) {
      const kapi = await db.pdksKapi.findUnique({
        where: { cihazId_kapiNo: { cihazId, kapiNo: doorNo } },
        select: { okuyucular: { where: { aktif: true }, select: { id: true, okuyucuNo: true, yon: true } } },
      })
      if (!kapi) return null
      const tam = readerNo !== null ? kapi.okuyucular.find((o) => o.okuyucuNo === readerNo) : undefined
      // Okuyucu no gelmediyse ya da eşleşmediyse: kapının TEK aktif okuyucusu varsa o (DS-K2604T: kapı başına 1).
      const o = tam ?? (kapi.okuyucular.length === 1 ? kapi.okuyucular[0] : undefined)
      return o ? { id: o.id, yon: o.yon } : null
    },

    async ekle(k: GecisKaydi) {
      const id = randomUUID()
      const r = await db.pdksGecis.createMany({
        data: [{ ...k, id, ham: k.ham as Prisma.InputJsonValue }],
        skipDuplicates: true, // INSERT … ON CONFLICT DO NOTHING (dedupAnahtar unique)
      })
      return r.count === 1 ? id : null
    },

    async sonKartOlayi(cihazId, kapiNo, once, pencereSn) {
      const g = await db.pdksGecis.findFirst({
        where: {
          cihazId,
          kapiNo,
          olayTipi: 'GECERLI_KART',
          olayZamani: { lte: once, gte: new Date(once.getTime() - pencereSn * 1000) },
        },
        orderBy: { olayZamani: 'desc' },
        select: { id: true, personnelId: true, yon: true },
      })
      return g
    },

    async donemMaks(cihazId, donem) {
      const g = await db.pdksGecis.findFirst({
        where: { cihazId, seriDonem: donem, seriNo: { not: null } },
        orderBy: { seriNo: 'desc' },
        select: { seriNo: true, olayZamani: true },
      })
      return g && g.seriNo !== null ? { seriNo: g.seriNo, olayZamani: g.olayZamani } : null
    },

    async donemSerileri(cihazId, donem, sonrasi, limit) {
      const gs = await db.pdksGecis.findMany({
        where: { cihazId, seriDonem: donem, seriNo: sonrasi === null ? { not: null } : { gt: sonrasi } },
        orderBy: { seriNo: 'asc' },
        take: limit,
        select: { seriNo: true, olayZamani: true },
      })
      return gs.map((g) => ({ seriNo: g.seriNo!, olayZamani: g.olayZamani }))
    },

    async seriZamani(cihazId, donem, seriNo) {
      const g = await db.pdksGecis.findFirst({ where: { cihazId, seriDonem: donem, seriNo }, select: { olayZamani: true } })
      return g?.olayZamani ?? null
    },

    async cihazGuncelle(cihazId, d: CihazGuncelleme) {
      await db.pdksCihaz.update({ where: { id: cihazId }, data: d })
    },

    async boslukUyarisiEkle(u: BoslukUyarisi) {
      const mevcut = await boslukUyarilariOku(db)
      const yeni = [u, ...mevcut].slice(0, BOSLUK_UYARI_TUT)
      await db.systemSetting.upsert({
        where: { key: BOSLUK_UYARI_ANAHTARI },
        create: { key: BOSLUK_UYARI_ANAHTARI, value: JSON.stringify(yeni), category: 'pdks' },
        update: { value: JSON.stringify(yeni) },
      })
    },
  }
}

export async function boslukUyarilariOku(db: PrismaClient): Promise<BoslukUyarisi[]> {
  const a = await db.systemSetting.findUnique({ where: { key: BOSLUK_UYARI_ANAHTARI }, select: { value: true } })
  if (!a) return []
  try {
    const v = JSON.parse(a.value)
    return Array.isArray(v) ? (v as BoslukUyarisi[]) : []
  } catch {
    return []
  }
}

/** Varsayılan + SystemSetting olay eşlemesi. Ayar uyarıları log'a düşer (istek düşmez). */
export async function olayEslemesiOku(db: PrismaClient): Promise<OlayEsleme> {
  const a = await db.systemSetting.findUnique({ where: { key: OLAY_ESLEME_ANAHTARI }, select: { value: true } })
  const { esleme, uyarilar } = olayEslemeBirlestir(a?.value)
  for (const u of uyarilar) console.warn(`[pdks-olay] ${u}`)
  return esleme
}
