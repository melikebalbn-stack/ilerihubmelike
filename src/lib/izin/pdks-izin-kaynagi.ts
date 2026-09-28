/**
 * PDKS IzinKaynagi uygulaması (plan §4.3): onaylı talebin DONDURULMUŞ günleri (IzinTalepGun × ONAYLANDI).
 * pay = 0 (hafta sonu / tatil) günler verilmez. Etiket her türde "İzinli" — puantaja TÜR ADI GİTMEZ
 * (Melih 27.09: rapor dahil; tür adını yalnız İV izin ekranlarında görür).
 * '@/lib/prisma' İMPORT ETMEZ; DB istemcisi parametre.
 */
import type { PrismaClient } from '../../generated/prisma'
import type { IzinGunuGirdi, IzinKaynagi } from '../pdks/puantaj-motor'

type Db = Pick<PrismaClient, 'izinTalepGun' | 'izinTalep'>

export function prismaIzinKaynagi(db: Db): IzinKaynagi {
  return {
    async izinDurumlari(personnelIdleri, gun) {
      const m = new Map<string, IzinGunuGirdi>()
      if (!personnelIdleri.length) return m
      const tarih = new Date(`${gun}T00:00:00Z`)
      const [rs, saatlik] = await Promise.all([
        // Faz 4: iade edilen gün (rapor çakışması / erken dönüş) izinli SAYILMAZ
        db.izinTalepGun.findMany({
          where: { personnelId: { in: personnelIdleri }, tarih, pay: { gt: 0 }, iadeAt: null, talep: { durum: 'ONAYLANDI' } },
          select: { personnelId: true, talepId: true, pay: true, yarim: true },
        }),
        // Faz 4: onaylı SAATLİK izin (MAZERET) aralıkları — tür adı değil yalnız saat
        db.izinTalep.findMany({
          where: { personnelId: { in: personnelIdleri }, baslangic: tarih, durum: 'ONAYLANDI', dakika: { not: null } },
          select: { personnelId: true, baslangicSaat: true, bitisSaat: true, dakika: true },
        }),
      ])
      for (const r of rs) m.set(r.personnelId, { izinli: true, yarim: r.yarim, talepId: r.talepId, pay: Number(r.pay), etiket: 'İzinli' })
      for (const s of saatlik) {
        if (!s.baslangicSaat || !s.bitisSaat || !s.dakika) continue
        const e = m.get(s.personnelId) ?? { izinli: false }
        e.saatlik = [...(e.saatlik ?? []), { bas: s.baslangicSaat, bit: s.bitisSaat, dakika: s.dakika }]
        m.set(s.personnelId, e)
      }
      return m
    },
  }
}
