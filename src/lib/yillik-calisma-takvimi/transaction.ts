import { Prisma, type YillikTakvimDurum } from '@/generated/prisma'

export interface LockedYillikTakvimState {
  id: string; durum: YillikTakvimDurum; iptalMi: boolean; arsivMi: boolean; kaynakModul: string | null
}

/** PostgreSQL transaction-scoped parent row lock. Yalnız tagged/parameterized Prisma raw kullanır. */
export async function lockYillikTakvimParent(tx: Prisma.TransactionClient, id: string): Promise<LockedYillikTakvimState | null> {
  const rows = await tx.$queryRaw<LockedYillikTakvimState[]>`
    SELECT "id", "durum", "iptalMi", "arsivMi", "kaynakModul"
    FROM "YillikTakvimKaydi"
    WHERE "id" = ${id}
    FOR UPDATE
  `
  return rows[0] ?? null
}

export class YillikTakvimConflictError extends Error {}
