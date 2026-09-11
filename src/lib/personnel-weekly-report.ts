/**
 * Haftalık personel raporu verisi.
 *
 * Kadro sayıları /api/personnel/reports ile AYNI çekirdekten gelir
 * (@/lib/personnel-report-core). Bu dosya üzerine haftaya özgü iki bloğu ekler:
 * rapor haftasında işe giren ve işten çıkan personel. Rapor haftası = bir
 * ÖNCEKİ hafta, Europe/Istanbul (bkz. oncekiHaftaAraligi).
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
  /** Hafta başı — Pazartesi 00:00 Europe/Istanbul (gerçek an, UTC). */
  haftaBasi: Date
  /** Hafta sonu — Pazar 23:59:59.999 Europe/Istanbul (gerçek an, UTC). */
  haftaSonu: Date
  /** Hafta başının TR takvim günü, YYYY-MM-DD — audit/idempotency anahtarı. */
  haftaAnahtari: string
  tarihMetni: string
  girenler: HareketSatiri[]
  cikanlar: HareketSatiri[]
}

/**
 * Europe/Istanbul 2016'dan beri yaz saati uygulamıyor: sabit UTC+3.
 * Intl yerine sabit ofset — sunucunun TZ veri tabanına bağımlılık yok.
 */
const TR_OFSET_MS = 3 * 60 * 60 * 1000

/** Verilen anın TR takvim gününü (UTC gece yarısı olarak) döndürür. */
function trTakvimGunu(an: Date): Date {
  const kaydirilmis = new Date(an.getTime() + TR_OFSET_MS)
  return new Date(Date.UTC(kaydirilmis.getUTCFullYear(), kaydirilmis.getUTCMonth(), kaydirilmis.getUTCDate()))
}

export interface HaftaAraligi {
  /** Önceki haftanın Pazartesi'si, takvim günü (UTC gece yarısı) — @db.Date karşılaştırmaları için. */
  gunBasi: Date
  /** Önceki haftanın Pazar'ı, takvim günü. */
  gunSonu: Date
  /** Pazartesi 00:00 TR gerçek anı. */
  haftaBasi: Date
  /** Pazar 23:59:59.999 TR gerçek anı. */
  haftaSonu: Date
  haftaAnahtari: string
}

/**
 * Rapor haftası: referans anının bulunduğu haftanın bir ÖNCEKİ haftası,
 * Pazartesi 00:00 – Pazar 23:59 Europe/Istanbul.
 * Pazartesi 08:00 TR'de koşan cron böylece yeni biten haftayı raporlar.
 */
export function oncekiHaftaAraligi(referans: Date): HaftaAraligi {
  const bugunTR = trTakvimGunu(referans)
  const dow = bugunTR.getUTCDay() // 0=Paz..6=Cmt
  const buHaftaPzt = new Date(bugunTR.getTime() - ((dow + 6) % 7) * 86400000)
  const gunBasi = new Date(buHaftaPzt.getTime() - 7 * 86400000)
  const gunSonu = new Date(gunBasi.getTime() + 6 * 86400000)
  return {
    gunBasi,
    gunSonu,
    haftaBasi: new Date(gunBasi.getTime() - TR_OFSET_MS),
    haftaSonu: new Date(gunSonu.getTime() + 86400000 - TR_OFSET_MS - 1),
    haftaAnahtari: gunBasi.toISOString().slice(0, 10),
  }
}

const trTarih = (d: Date) =>
  d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })

export async function getHaftalikPersonelRaporu(referans = new Date()): Promise<HaftalikPersonelRaporu> {
  const { haftaBasi, haftaSonu, haftaAnahtari, gunBasi, gunSonu } = oncekiHaftaAraligi(referans)
  // girisTarihi/cikisTarihi @db.Date → takvim günü karşılaştırması (saat yok).
  const aralik = { gte: gunBasi, lte: gunSonu }

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
    haftaAnahtari,
    tarihMetni: `${trTarih(gunBasi)} – ${trTarih(gunSonu)}`,
    girenler: girisDonemleri.map(d => satir(d.personnel, d.girisTarihi)),
    cikanlar: cikisDonemleri.map(d => satir(d.personnel, d.cikisTarihi!)),
  }
}
