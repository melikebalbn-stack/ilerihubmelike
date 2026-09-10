/**
 * Haftalık personel raporu verisi.
 *
 * Kadro sayıları /api/personnel/reports ile AYNI çekirdekten gelir
 * (@/lib/personnel-report-core). Bu dosya üzerine haftaya özgü iki bloğu ekler:
 * o hafta işe giren ve o hafta işten çıkan personel.
 *
 * Çıkış/giriş verisinin tek kaynağı EmploymentPeriod'dur (Personnel.exit*
 * alanları PR-4b'de düşürüldü).
 */
import { prisma } from '@/lib/prisma'
import { topluPersonelVerisi, hesaplaPersonelRaporu, type PersonelRaporu } from '@/lib/personnel-report-core'

export interface HareketSatiri {
  sicilNo: string | null
  adSoyad: string
  bolum: string
  gorev: string
  tarih: string
}

export interface HaftalikPersonelRaporu {
  rapor: PersonelRaporu
  haftaBasi: Date
  haftaSonu: Date
  tarihMetni: string
  girenler: HareketSatiri[]
  cikanlar: HareketSatiri[]
}

/** Verilen günün içinde bulunduğu haftanın Pazartesi'si (UTC). */
export function haftaninBasi(gun: Date): Date {
  const dow = gun.getUTCDay() // 0=Paz..6=Cmt
  return new Date(Date.UTC(gun.getUTCFullYear(), gun.getUTCMonth(), gun.getUTCDate() - ((dow + 6) % 7)))
}

const trTarih = (d: Date) =>
  d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })

export async function getHaftalikPersonelRaporu(referans = new Date()): Promise<HaftalikPersonelRaporu> {
  const haftaBasi = haftaninBasi(referans)
  const haftaSonu = new Date(haftaBasi.getTime() + 6 * 86400000)
  // girisTarihi/cikisTarihi @db.Date → gün sınırları UTC gece yarısı.
  const aralik = { gte: haftaBasi, lte: haftaSonu }

  const [ham, girisDonemleri, cikisDonemleri] = await Promise.all([
    topluPersonelVerisi(),
    prisma.employmentPeriod.findMany({
      where: { girisTarihi: aralik },
      include: { personnel: { select: { sicilNo: true, adSoyad: true, bolum: true, gorev: true } } },
      orderBy: { girisTarihi: 'asc' },
    }),
    prisma.employmentPeriod.findMany({
      where: { cikisTarihi: aralik },
      include: { personnel: { select: { sicilNo: true, adSoyad: true, bolum: true, gorev: true } } },
      orderBy: { cikisTarihi: 'asc' },
    }),
  ])

  const satir = (p: { sicilNo: string | null; adSoyad: string; bolum: string; gorev: string }, tarih: Date): HareketSatiri => ({
    sicilNo: p.sicilNo,
    adSoyad: p.adSoyad,
    bolum: p.bolum,
    gorev: p.gorev,
    tarih: trTarih(tarih),
  })

  return {
    rapor: hesaplaPersonelRaporu(ham),
    haftaBasi,
    haftaSonu,
    tarihMetni: `${trTarih(haftaBasi)} – ${trTarih(haftaSonu)}`,
    girenler: girisDonemleri.map(d => satir(d.personnel, d.girisTarihi)),
    cikanlar: cikisDonemleri.map(d => satir(d.personnel, d.cikisTarihi!)),
  }
}
