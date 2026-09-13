/**
 * FİF kayıt numarası — yıl bazlı atomik seri (KAL-FR-10).
 *
 * Format: FIF-{year}-{seq:3digits} → 'FIF-2026-001'
 * quality-report-no.ts deseni: pg_advisory_xact_lock(hashtext('fif_no_<year>'))
 * ile yıl bazlı concurrent POST'lar serialize olur. Kayıt oluşturma ile AYNI
 * $transaction içinde çağrılmalı (tx parametresi geç); advisory lock erken
 * bırakılmasın.
 *
 * Yıl geçişi: her yıl 001'den başlar (prefix'e yıl gömülü, MAX aynı yıl serisinde).
 */
import { prisma } from '@/lib/prisma'

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export function fifNoPrefix(year: number): string {
  return `FIF-${year}-`
}

/** Bir kayıtNo'dan yıl+sıra ayrıştır (test/tutarlılık için). null = biçim dışı. */
export function parseFifNo(kayitNo: string): { year: number; seq: number } | null {
  const m = /^FIF-(\d{4})-(\d{3,})$/.exec(kayitNo)
  if (!m) return null
  return { year: Number(m[1]), seq: Number(m[2]) }
}

export async function generateNextFifNo(year: number, tx?: TxClient): Promise<string> {
  const run = async (client: TxClient | typeof prisma): Promise<string> => {
    await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fif_no_${year}`}))`

    const prefix = fifNoPrefix(year)
    const last = await client.fif.findFirst({
      where: { kayitNo: { startsWith: prefix } },
      orderBy: { kayitNo: 'desc' },
      select: { kayitNo: true },
    })

    const lastSeq = last ? parseInt(last.kayitNo.slice(prefix.length), 10) : 0
    const next = (Number.isFinite(lastSeq) ? lastSeq : 0) + 1
    return `${prefix}${String(next).padStart(3, '0')}`
  }

  if (tx) return run(tx)
  return prisma.$transaction((t) => run(t))
}
