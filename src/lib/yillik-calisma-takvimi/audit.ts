import type { Prisma } from '@/generated/prisma'

interface CreateAuditParams {
  tx: Prisma.TransactionClient
  kayitId: string
  yapanId: string
  metadata: { yil: number; departmentId: string; periyot: string }
}

/** Create ile aynı transaction'da minimum, kişisel veri içermeyen audit kaydı. */
export async function logYillikTakvimCreate({ tx, kayitId, yapanId, metadata }: CreateAuditParams): Promise<void> {
  await tx.yillikTakvimIslemGecmisi.create({
    data: {
      kayitId,
      yapanId,
      islemTuru: 'OLUSTUR',
      alan: 'kayit',
      yeniDeger: JSON.stringify(metadata),
    },
  })
}
