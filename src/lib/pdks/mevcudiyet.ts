import 'server-only'
import { prisma } from '@/lib/prisma'

/**
 * PDKS Adım 6 — "içeride kim var" / yangın tahliye. Son N saat (vars. 18) içindeki geçerli geçişlerden
 * her kişinin SON hareketi GİRİŞ ise içeride, ÇIKIŞ ise dışarıda sayılır. Anlık (DB'ye yazmaz).
 * Yangın tahliyesinde "şu an binada kim var" listesi; bölüm bazlı gruplanır.
 */
export interface IcerideKisi {
  personnelId: string
  adSoyad: string
  sicil: string | null
  bolum: string
  girisZamani: string
}
export interface MevcudiyetSonuc {
  olusturuldu: string
  pencereSaat: number
  toplam: number
  bolumler: { bolum: string; kisiler: IcerideKisi[] }[]
}

const BOLUMSUZ = 'Bölüm atanmamış'

export async function iceridekiler(pencereSaat = 18): Promise<MevcudiyetSonuc> {
  const esik = new Date(Date.now() - pencereSaat * 3600_000)
  const gecisler = await prisma.pdksGecis.findMany({
    where: { olayTipi: 'GECERLI_KART', olayZamani: { gte: esik }, personnelId: { not: null }, yon: { not: null } },
    orderBy: { olayZamani: 'asc' },
    select: { personnelId: true, yon: true, olayZamani: true },
  })
  // Kişi başı SON hareket (sıralı → son kazanır)
  const son = new Map<string, { yon: string; zaman: Date }>()
  for (const g of gecisler) son.set(g.personnelId!, { yon: g.yon!, zaman: g.olayZamani })

  const icerideIds = [...son.entries()].filter(([, v]) => v.yon === 'GIRIS').map(([pid]) => pid)
  const pers = icerideIds.length
    ? await prisma.personnel.findMany({
        where: { id: { in: icerideIds } },
        select: { id: true, adSoyad: true, sicilNo: true, department: { select: { name: true } } },
      })
    : []
  const persById = new Map(pers.map((p) => [p.id, p]))

  const byBolum = new Map<string, IcerideKisi[]>()
  for (const pid of icerideIds) {
    const p = persById.get(pid)
    if (!p) continue
    const bolum = p.department?.name ?? BOLUMSUZ
    const kisi: IcerideKisi = {
      personnelId: pid,
      adSoyad: p.adSoyad ?? pid,
      sicil: p.sicilNo,
      bolum,
      girisZamani: son.get(pid)!.zaman.toISOString(),
    }
    if (!byBolum.has(bolum)) byBolum.set(bolum, [])
    byBolum.get(bolum)!.push(kisi)
  }

  const bolumler = [...byBolum.entries()]
    .map(([bolum, kisiler]) => ({ bolum, kisiler: kisiler.sort((a, b) => a.adSoyad.localeCompare(b.adSoyad, 'tr')) }))
    .sort((a, b) => a.bolum.localeCompare(b.bolum, 'tr'))

  return { olusturuldu: new Date().toISOString(), pencereSaat, toplam: icerideIds.length, bolumler }
}
