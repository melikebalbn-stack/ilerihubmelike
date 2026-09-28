/**
 * PDKS IzinKaynagi uygulaması (plan §4.3): onaylı talebin DONDURULMUŞ günleri (IzinTalepGun × ONAYLANDI).
 * pay = 0 (hafta sonu / tatil) günler verilmez. Etiket her türde "İzinli" — puantaja TÜR ADI GİTMEZ
 * (Melih 27.09: rapor dahil; tür adını yalnız İV izin ekranlarında görür).
 * '@/lib/prisma' İMPORT ETMEZ; DB istemcisi parametre.
 */
import type { PrismaClient } from '../../generated/prisma'
import type { IzinGunuGirdi, IzinKaynagi } from '../pdks/puantaj-motor'

type Db = Pick<PrismaClient, 'izinTalepGun'>

export function prismaIzinKaynagi(db: Db): IzinKaynagi {
  return {
    async izinDurumlari(personnelIdleri, gun) {
      const m = new Map<string, IzinGunuGirdi>()
      if (!personnelIdleri.length) return m
      const rs = await db.izinTalepGun.findMany({
        where: { personnelId: { in: personnelIdleri }, tarih: new Date(`${gun}T00:00:00Z`), pay: { gt: 0 }, talep: { durum: 'ONAYLANDI' } },
        select: { personnelId: true, talepId: true, pay: true, yarim: true },
      })
      for (const r of rs) m.set(r.personnelId, { izinli: true, yarim: r.yarim, talepId: r.talepId, pay: Number(r.pay), etiket: 'İzinli' })
      return m
    },
  }
}
