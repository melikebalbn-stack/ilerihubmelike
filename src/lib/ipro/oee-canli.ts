// OEE CANLI (Paket 2) — AÇIK iş üzerinden now()'a kadar anlık OEE. Motordan (oee-hesap.ts) TÜRETİLMİŞ,
// motora DOKUNMAZ. Kapanan iş hesabı (Paket 1, oeeKaydiHesaplaVeYaz) ayrı yol; bu ek canlı okuma.
//
// AÇIK İŞTE QUALITY = null (seçenek A): operatör iyi/hurda'yı iş bitince girer → mid-job bilinmez.
// Pano Availability + Performance CANLI gösterir; tam OEE iş kapanınca motordan (ipro_oee_kaydi).
import type { PrismaClient } from '@/generated/prisma'

export interface OeeCanliGirdi {
  planliSaniye: number
  durusSaniye: number
  uretilen: number // canlı Σdelta (iş penceresinde şu ana kadar)
  idealSaniyeAdet: number | null // güvenilir ideal yoksa null → performance null (birikiyor)
}

export interface OeeCanliSonuc {
  availability: number | null
  performance: number | null
  quality: null // AÇIK işte her zaman null (iyi/hurda henüz yok)
  oeeCanli: number | null // availability × performance (quality null → tam OEE yok)
  durum: 'CANLI_KISMI' | 'PLANLI_YOK' // pano "iş bitince tam OEE" rozetini buna göre gösterir
}

/**
 * Açık iş için canlı OEE bileşenleri. SAF — DB'siz test.
 * availability=(planli−durus)/planli · performance=(ideal×üretilen)/(planli−durus) · quality=null (açık iş).
 * oeeCanli = availability × performance (quality bilinmediğinden tam OEE değil, "kısmi").
 */
export function oeeCanliBilesenleri(g: OeeCanliGirdi): OeeCanliSonuc {
  const calisma = g.planliSaniye - g.durusSaniye
  const availability = g.planliSaniye > 0 ? calisma / g.planliSaniye : null
  const performance =
    g.idealSaniyeAdet != null && calisma > 0 ? (g.idealSaniyeAdet * g.uretilen) / calisma : null
  const oeeCanli = availability != null && performance != null ? availability * performance : null
  const durum = g.planliSaniye > 0 ? 'CANLI_KISMI' : 'PLANLI_YOK'
  return { availability, performance, quality: null, oeeCanli, durum }
}

/**
 * İş penceresi [baslatildiAt, now] içindeki duruş saniyeleri. AÇIK duruş (bitis=null) → now'a kadar.
 * NOT: motordaki private `durusSaniyeHesapla`'nın KOPYASI — motora dokunmamak için burada. Aynı mantık.
 */
export async function durusSaniyeCanli(
  prisma: PrismaClient,
  tezgahId: string,
  bas: Date,
  simdi: Date,
): Promise<number> {
  const duruslar = await prisma.iproMachineDowntime.findMany({
    where: { tezgahId, baslangic: { lt: simdi }, OR: [{ bitis: null }, { bitis: { gt: bas } }] },
    select: { baslangic: true, bitis: true },
  })
  let sn = 0
  for (const d of duruslar) {
    const dBit = d.bitis ?? simdi // açık duruş → şimdiye kadar say
    const kesBas = Math.max(d.baslangic.getTime(), bas.getTime())
    const kesBit = Math.min(dBit.getTime(), simdi.getTime())
    if (kesBit > kesBas) sn += (kesBit - kesBas) / 1000
  }
  return Math.round(sn)
}
