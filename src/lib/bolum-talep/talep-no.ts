// Talep numarası üretimi — BDT-YYYY-NNN (kadro talebi PR-YYYY-NNN deseni).
// Aynı yıl içinde son numaranın bir fazlası; eşzamanlı iki talepte unique
// constraint ikinciyi düşürür, çağıran bir kez daha dener.

import type { Prisma } from '@/generated/prisma'

export async function yeniTalepNo(tx: Prisma.TransactionClient): Promise<string> {
  const yil = new Date().getFullYear()
  const onek = `BDT-${yil}-`
  const son = await tx.bolumDegisiklikTalep.findFirst({
    where: { talepNo: { startsWith: onek } },
    orderBy: { talepNo: 'desc' },
    select: { talepNo: true },
  })
  const sira = son ? Number(son.talepNo.slice(onek.length)) + 1 : 1
  return `${onek}${String(sira).padStart(3, '0')}`
}
