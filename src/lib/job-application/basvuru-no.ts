/**
 * Başvuru numarası — okunabilir, yıl bazlı atomik sıra.
 *
 * Format: IK-{yıl}-{sıra:4 hane} → 'IK-2026-0001'
 *
 * Race-safe: pg_advisory_xact_lock(hashtext('basvuru-no-<yıl>')) ile eşzamanlı
 * consent POST'ları serialize olur. Desen src/lib/offboarding/offboarding-form-no.ts
 * (generateNextFormNo) ile BİREBİR aynı — yeni mekanizma kurulmadı.
 *
 * Çağıran zaten bir transaction'daysa tx geçirir; advisory lock aynı tx'e eklenir
 * ve commit'te otomatik serbest kalır. tx verilmezse helper kendi tx'ini açar.
 *
 * ESKİ NUMARALAR: 12.08–25.08 arası oluşan kayıtların numarası cuid biçiminde
 * (ör. cmt8lphss0007vppe815tutfi). Bu üretici YALNIZ 'IK-<yıl>-' önekli kayıtlara
 * bakar; eski numaralar sıraya karışmaz ve DEĞİŞTİRİLMEZ.
 */

import { prisma } from '@/lib/prisma'

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export const BASVURU_NO_ONEKI = 'IK-'

/** 'IK-2026-0001' biçimine uyuyor mu (sorgu/arama tarafında bilgi amaçlı). */
export function yeniBicimMi(no: string): boolean {
  return /^IK-\d{4}-\d{4,}$/i.test(no.trim())
}

export async function sonrakiBasvuruNo(year: number, tx?: TxClient): Promise<string> {
  const run = async (client: TxClient | typeof prisma) => {
    await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`basvuru-no-${year}`}))`

    const prefix = `${BASVURU_NO_ONEKI}${year}-`
    const last = await client.publicJobApplication.findFirst({
      where: { applicationNumber: { startsWith: prefix } },
      orderBy: { applicationNumber: 'desc' },
      select: { applicationNumber: true },
    })

    const lastSeq = last ? parseInt(last.applicationNumber.slice(prefix.length), 10) : 0
    const next = (Number.isFinite(lastSeq) ? lastSeq : 0) + 1
    return `${prefix}${String(next).padStart(4, '0')}`
  }

  if (tx) return run(tx)
  return prisma.$transaction((t) => run(t))
}
