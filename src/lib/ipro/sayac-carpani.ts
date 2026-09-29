import 'server-only'
import { prisma } from '@/lib/prisma'

/**
 * PLC ham Σdelta → gerçek adet çarpanı çözümü (IproSayacCarpani).
 * Çözüm sırası: TEZGAHLI satır > TEZGAHSIZ (genel) satır > 1 (varsayılan).
 *
 * DİKKAT: bu helper SAYIM HESABINDA HENÜZ KULLANILMAZ (poller/is-bitir/oee-canli/ayna DEĞİŞMEZ).
 * Yalnız rapor/ayar ve ileride sayım geçişi için hazır. göz/cavity = bu çarpan.
 */
export interface CarpanSatiri {
  tezgahKod: string | null
  carpan: number
}

/** SAF: aday satırlardan tezgahlı > tezgahsız > null sırasıyla çarpanı seçer (DB'siz test edilir). */
export function carpanSec(satirlar: CarpanSatiri[], tezgahKod?: string | null): number | null {
  if (tezgahKod) {
    const t = satirlar.find((s) => s.tezgahKod === tezgahKod)
    if (t) return t.carpan
  }
  const genel = satirlar.find((s) => s.tezgahKod == null)
  if (genel) return genel.carpan
  return null
}

/** DB çözümü: parça+op(+tezgah) → çarpan. Kayıt yoksa 1 (çarpansız). */
export async function carpanBul(parcaNo: string, operasyonNo: string, tezgahKod?: string | null): Promise<number> {
  if (tezgahKod) {
    const t = await prisma.iproSayacCarpani.findFirst({ where: { parcaNo, operasyonNo, tezgahKod }, select: { carpan: true } })
    if (t) return Number(t.carpan) // Prisma Decimal → number
  }
  const genel = await prisma.iproSayacCarpani.findFirst({ where: { parcaNo, operasyonNo, tezgahKod: null }, select: { carpan: true } })
  return genel ? Number(genel.carpan) : 1
}
