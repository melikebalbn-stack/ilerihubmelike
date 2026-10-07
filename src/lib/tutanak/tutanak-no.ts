// Tutanak numarası — TUT-YYYY-NNN, yıl bazlı artan (BDT/PR deseniyle aynı).
// Eşzamanlı iki tutanakta unique constraint ikinciyi düşürür; çağıran bir kez
// daha dener (POST'ta tekrar denemesi var).

import type { Prisma } from '@/generated/prisma'

export const TUTANAK_NO_ONEKI = (yil: number) => `TUT-${yil}-`

/** Saf: son numaradan sıradakini üretir. `sonNo` yoksa yılın ilk tutanağıdır. */
export function sonrakiTutanakNo(yil: number, sonNo: string | null | undefined): string {
  const onek = TUTANAK_NO_ONEKI(yil)
  if (!sonNo || !sonNo.startsWith(onek)) return `${onek}001`
  const sira = Number(sonNo.slice(onek.length))
  const sonraki = Number.isFinite(sira) ? sira + 1 : 1
  return `${onek}${String(sonraki).padStart(3, '0')}`
}

export async function yeniTutanakNo(tx: Prisma.TransactionClient, simdi = new Date()): Promise<string> {
  const yil = simdi.getFullYear()
  const son = await tx.tutanak.findFirst({
    where: { tutanakNo: { startsWith: TUTANAK_NO_ONEKI(yil) } },
    orderBy: { tutanakNo: 'desc' },
    select: { tutanakNo: true },
  })
  return sonrakiTutanakNo(yil, son?.tutanakNo)
}
