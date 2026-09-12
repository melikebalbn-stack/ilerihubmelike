// OEE CANLI HESAP (Paket 2) — SALT OKUMA. İzleme paneliyle BİRLEŞTİ: bu dosya artık yalnız
// canlı OEE bileşenlerini (tezgah başına) hesaplayan yeniden-kullanılabilir fonksiyonu barındırır;
// pano verisini izleme-service.ts (panoData({ oee:true })) toplar. oee-canli.ts'e DOKUNULMADI.
//
// TEK YÖN import: izleme-service → oee-pano-service (dairesel bağımlılık yok).
import 'server-only'
import type { PrismaClient } from '@/generated/prisma'
import { planliSaniyeHesapla } from '@/lib/ipro/oee-hesap'
import { isPenceresiDeltaToplami } from '@/lib/ipro/faz2-delta'
import { durusSaniyeCanli, oeeCanliBilesenleri, type OeeCanliSonuc } from '@/lib/ipro/oee-canli'
import { gecerliTatilTip, tarihAnahtari, type IproTatilTip } from '@/lib/ipro/takvim-util'

/** Canlı OEE bileşenleri (açık iş varsa dolu; quality açık işte null → tam OEE iş kapanınca). */
export type OeeCanliKart = {
  availability: number | null
  performance: number | null
  quality: null
  oeeCanli: number | null
  durum: OeeCanliSonuc['durum']
  planliSaniye: number
  durusSaniye: number
  uretilen: number
  idealGuvenilir: boolean
  ornekSayisi: number // X — güvenilirlik eşiği (X/esik)
}

// İdeal güvenilirlik eşiği — oee-canli/ideal-cevrim ile hizalı (X/esik gösterimi).
export const IDEAL_ESIK = 50

/** Canlı OEE hesabı için gereken minimal açık iş girdisi (izleme-service'ten geçer). */
export type CanliOeeAcikIs = {
  tezgahId: string
  ifsPartNo: string | null
  baslatildiAt: Date | null
}

/**
 * AÇIK işler için tezgah başına canlı OEE bileşenleri. N+1 YOK — açık iş sayısı kadar (tipik <30)
 * canlı aggregate; 214 tezgah değil. Girdiler (tezgahlar/açık işler) çağırandan gelir → sorgu tekrarı yok.
 * Vardiya/tatil/ideal çevrim burada çekilir (OEE'ye özel — durum görünümünde çekilmez).
 */
export async function tezgahlarinCanliOee(
  prisma: PrismaClient,
  tezgahlar: { id: string; kod: string }[],
  acikIsler: CanliOeeAcikIs[],
  simdi: Date,
): Promise<Map<string, OeeCanliKart>> {
  const kodById = new Map(tezgahlar.map((t) => [t.id, t.kod]))

  const [vardiyalar, tatiller] = await Promise.all([
    prisma.iproVardiya.findMany({
      where: { aktif: true },
      select: { baslangicSaat: true, bitisSaat: true, ertesiGuneTasar: true },
    }),
    prisma.iproTatil.findMany({ select: { tarih: true, tip: true } }),
  ])
  const tatilMap = new Map<string, IproTatilTip>()
  for (const t of tatiller) if (gecerliTatilTip(t.tip)) tatilMap.set(tarihAnahtari(t.tarih), t.tip)

  // İdeal çevrimler — açık işlerin (tezgahKod, parcaKod) çiftleri tek sorguda.
  const ciftler = acikIsler
    .filter((a) => a.ifsPartNo && a.baslatildiAt)
    .map((a) => ({ tezgahKod: kodById.get(a.tezgahId)!, parcaKod: a.ifsPartNo! }))
    .filter((c) => c.tezgahKod)
  const idealler = ciftler.length
    ? await prisma.iproIdealCevrim.findMany({
        where: { OR: ciftler.map((c) => ({ tezgahKod: c.tezgahKod, parcaKod: c.parcaKod })) },
        select: { tezgahKod: true, parcaKod: true, idealSaniyeAdet: true, guvenilir: true, ornekSayisi: true },
      })
    : []
  const idealByKey = new Map(idealler.map((i) => [`${i.tezgahKod}|${i.parcaKod}`, i]))

  const canliByTezgah = new Map<string, OeeCanliKart>()
  await Promise.all(
    acikIsler.map(async (a) => {
      if (!a.baslatildiAt) return
      const tezgahKod = kodById.get(a.tezgahId)
      if (!tezgahKod) return
      const [{ toplam: uretilen }, durusSaniye] = await Promise.all([
        isPenceresiDeltaToplami(prisma, tezgahKod, a.baslatildiAt, simdi),
        durusSaniyeCanli(prisma, a.tezgahId, a.baslatildiAt, simdi),
      ])
      const planliSaniye = planliSaniyeHesapla(a.baslatildiAt, simdi, vardiyalar, tatilMap)
      const ideal = a.ifsPartNo ? idealByKey.get(`${tezgahKod}|${a.ifsPartNo}`) : undefined
      const idealSaniyeAdet = ideal?.guvenilir ? ideal.idealSaniyeAdet : null
      const b = oeeCanliBilesenleri({ planliSaniye, durusSaniye, uretilen, idealSaniyeAdet })
      canliByTezgah.set(a.tezgahId, {
        ...b,
        planliSaniye,
        durusSaniye,
        uretilen,
        idealGuvenilir: !!ideal?.guvenilir,
        ornekSayisi: ideal?.ornekSayisi ?? 0,
      })
    }),
  )
  return canliByTezgah
}
