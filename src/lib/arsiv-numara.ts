import type { PrismaClient } from '@/generated/prisma'
import { prisma as defaultPrisma } from '@/lib/prisma'

const MAX_KOLI_PER_YEAR = 999

export class ArsivNumaraServisi {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async generateNextArsivNo(bolumId: number, yil: number): Promise<string> {
    const result = await this.prisma.$queryRaw<
      Array<{ son_sira: number; kod: string }>
    >`
      WITH bolum AS (
        SELECT kod
        FROM arsiv_bolum
        WHERE id = ${bolumId} AND aktif_mi = true
      ),
      sayac_upsert AS (
        INSERT INTO arsiv_sayac (bolum_id, yil, son_sira)
        SELECT ${bolumId}, ${yil}, 1
        WHERE EXISTS (SELECT 1 FROM bolum)
        ON CONFLICT (bolum_id, yil)
        DO UPDATE SET son_sira = arsiv_sayac.son_sira + 1
        RETURNING son_sira
      )
      SELECT su.son_sira, b.kod
      FROM sayac_upsert su
      CROSS JOIN bolum b;
    `

    if (result.length === 0) {
      throw new Error(`Geçersiz veya pasif bölüm: id=${bolumId}`)
    }

    const { son_sira, kod } = result[0]
    if (son_sira > MAX_KOLI_PER_YEAR) {
      throw new Error(
        `Bu yıl için maksimum ${MAX_KOLI_PER_YEAR} koli sınırına ulaşıldı (bolum=${kod}, yil=${yil}).`
      )
    }
    const sira = String(son_sira).padStart(3, '0')
    return `ARK-${kod}-${yil}-${sira}`
  }

  async generateNextAltKoliHarf(anaKoliId: bigint): Promise<string> {
    const sonuncu = await this.prisma.arsivAltKoli.findFirst({
      where: { anaKoliId },
      orderBy: { harf: 'desc' },
      select: { harf: true },
    })

    if (!sonuncu) return 'A'

    const charCode = sonuncu.harf.charCodeAt(0)
    if (charCode >= 'Z'.charCodeAt(0)) {
      throw new Error('Maksimum 26 alt koli sınırı aşıldı.')
    }
    return String.fromCharCode(charCode + 1)
  }
}

export const arsivNumaraServisi = new ArsivNumaraServisi()

// Standalone fonksiyon export'ları (singleton'a thin wrapper).
export const generateNextArsivNo = (bolumId: number, yil: number) =>
  arsivNumaraServisi.generateNextArsivNo(bolumId, yil)

export const generateNextAltKoliHarf = (anaKoliId: bigint) =>
  arsivNumaraServisi.generateNextAltKoliHarf(anaKoliId)
