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

interface UpdateAuditParams {
  tx: Prisma.TransactionClient
  kayitId: string
  yapanId: string
  degisenAlanlar: string[]
}

/** Değer/PII tutmadan, PATCH ile değişen alan adlarını atomik kaydeder. */
export async function logYillikTakvimUpdate({ tx, kayitId, yapanId, degisenAlanlar }: UpdateAuditParams): Promise<void> {
  await tx.yillikTakvimIslemGecmisi.create({
    data: {
      kayitId,
      yapanId,
      islemTuru: 'GUNCELLE',
      alan: 'kayit',
      yeniDeger: JSON.stringify({ degisenAlanlar }),
    },
  })
}

/** Soft-delete ile aynı transaction'da, PII içermeyen iptal kaydı oluşturur. */
export async function logYillikTakvimCancel({ tx, kayitId, yapanId }: Omit<UpdateAuditParams, 'degisenAlanlar'>): Promise<void> {
  await tx.yillikTakvimIslemGecmisi.create({
    data: {
      kayitId,
      yapanId,
      islemTuru: 'IPTAL',
      alan: 'iptalMi',
      yeniDeger: 'true',
    },
  })
}

export async function logYillikTakvimAction({ tx, kayitId, yapanId, islemTuru, alan, metadata }: {
  tx: Prisma.TransactionClient; kayitId: string; yapanId: string; islemTuru: string; alan: string; metadata?: Record<string, unknown>
}): Promise<void> {
  await tx.yillikTakvimIslemGecmisi.create({
    data: { kayitId, yapanId, islemTuru, alan, yeniDeger: metadata ? JSON.stringify(metadata) : null },
  })
}
