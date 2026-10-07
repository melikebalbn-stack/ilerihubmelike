import 'server-only'
import type { PrismaClient } from '@/generated/prisma'
import { bugunStr, dbGun, gunEkle, gunuHesapla } from './puantaj-servis'

type Db = PrismaClient

/**
 * PDKS yönetim dashboard verisi (Adım 4). Bugün CANLI hesaplanır (DB'ye yazılmaz); ay özeti ve 14 günlük
 * trend kayıtlı pdks_puantaj_gun'dan. Veri aktıkça zenginleşir; kayıt yoksa alanlar 0 döner (boş ekran değil).
 */
export interface PdksDashboard {
  bugun: string
  aktifSayi: number
  bugunOzet: { gelen: number; gelmedi: number; gec: number; eksik: number; izinli: number }
  ay: { toplamGecDk: number; gelmediGunu: number; mesaiDk: number; toleransIciGec: number }
  trend: { gun: string; gec: number; gelmedi: number }[]
}

const GELEN = ['TAM', 'TAM_FORMLA', 'MESAI', 'EKSIK_CIKIS', 'EKSIK_GIRIS']

export async function pdksDashboard(db: Db): Promise<PdksDashboard> {
  const bugun = bugunStr()
  const ayBasi = `${bugun.slice(0, 8)}01`
  const trendBas = gunEkle(bugun, -13)
  const ayAralik = { gte: dbGun(ayBasi), lte: dbGun(bugun) }
  const trendAralik = { gte: dbGun(trendBas), lte: dbGun(bugun) }

  const [canli, aySum, ayGelmedi, ayTolGec, gecTrend, gelmediTrend, aktifSayi] = await Promise.all([
    gunuHesapla(db, bugun, { kaydet: false }),
    db.pdksPuantajGun.aggregate({ where: { gun: ayAralik }, _sum: { gecDakika: true, onayliMesaiDakika: true } }),
    db.pdksPuantajGun.count({ where: { gun: ayAralik, durum: 'GELMEDI' } }),
    db.pdksPuantajGun.count({ where: { gun: ayAralik, uyarilar: { has: 'TOLERANS_ICI_GEC' } } }),
    db.pdksPuantajGun.groupBy({ by: ['gun'], where: { gun: trendAralik, gecDakika: { gt: 0 } }, _count: { _all: true } }),
    db.pdksPuantajGun.groupBy({ by: ['gun'], where: { gun: trendAralik, durum: 'GELMEDI' }, _count: { _all: true } }),
    db.personnel.count({ where: { aktif: true } }),
  ])

  const say = (p: (d: string) => boolean) => canli.sonuclar.filter((s) => p(s.sonuc.durum)).length
  const bugunOzet = {
    gelen: say((d) => GELEN.includes(d)),
    gelmedi: say((d) => d === 'GELMEDI'),
    gec: canli.sonuclar.filter((s) => s.sonuc.gecDakika > 0).length,
    eksik: say((d) => d === 'EKSIK_GIRIS' || d === 'EKSIK_CIKIS'),
    izinli: say((d) => d === 'IZINLI'),
  }

  const gecByGun = new Map(gecTrend.map((r) => [r.gun.toISOString().slice(0, 10), r._count._all]))
  const gelmediByGun = new Map(gelmediTrend.map((r) => [r.gun.toISOString().slice(0, 10), r._count._all]))
  const trend: PdksDashboard['trend'] = []
  for (let i = 13; i >= 0; i--) {
    const g = gunEkle(bugun, -i)
    trend.push({ gun: g, gec: gecByGun.get(g) ?? 0, gelmedi: gelmediByGun.get(g) ?? 0 })
  }

  return {
    bugun,
    aktifSayi,
    bugunOzet,
    ay: {
      toplamGecDk: aySum._sum.gecDakika ?? 0,
      gelmediGunu: ayGelmedi,
      mesaiDk: aySum._sum.onayliMesaiDakika ?? 0,
      toleransIciGec: ayTolGec,
    },
    trend,
  }
}
