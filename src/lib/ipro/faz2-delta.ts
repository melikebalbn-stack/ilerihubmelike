// FAZ 2 (IPRO_FAZ2_DELTA) — sayaç delta zaman serisinden iş penceresi üretim hesabı.
//
// NEDEN LIB (route DEĞİL): route dosyaları yalnız HTTP metodu export edebilir (23.07 dersi).
// is-bitir buradan çağırır. Flag env'den okunur; test toggle edebilsin diye FONKSİYON.
import type { PrismaClient } from '@/generated/prisma'

/** FAZ 2 delta hesabı açık mı. Env her çağrıda okunur (test toggle edebilir). */
export function faz2DeltaAktif(): boolean {
  return process.env.IPRO_FAZ2_DELTA === 'true'
}

export interface DeltaPenceresi {
  /** Σ delta (seri yoksa 0). */
  toplam: number
  /** İş penceresinde en az bir okuma var mı — FALLBACK guard'ın anahtarı. */
  seriVar: boolean
}

/**
 * Bir iş penceresindeki [baslangic, bitis] Σ delta'yı IproSayacOkuma'dan hesaplar.
 *
 * seriVar=false ise (poller ısınmamış / yeni açılmış / eşsiz tezgah) çağıran ÇIKARMAYA
 * DÖNMELİ — boş seriyle toplam=0 her işi "iyi+hurda>0 → 400" yapardı. Bu guard FAZ 2'nin
 * emniyet kemeri. Sayaç iş ortasında sıfırlansa bile Σ delta doğrudur (poller reset'i
 * delta=cur olarak yutar, birikime doğru eklenir).
 */
export async function isPenceresiDeltaToplami(
  prisma: PrismaClient,
  tezgahKod: string,
  baslangic: Date,
  bitis: Date,
): Promise<DeltaPenceresi> {
  const agg = await prisma.iproSayacOkuma.aggregate({
    where: { tezgahKod, ts: { gte: baslangic, lte: bitis } },
    _sum: { delta: true },
    _count: { _all: true },
  })
  return { toplam: agg._sum.delta ?? 0, seriVar: agg._count._all > 0 }
}
