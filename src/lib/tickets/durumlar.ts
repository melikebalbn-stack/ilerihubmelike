import type { TicketStatus } from '@/generated/prisma'

// IT Ticket durum kümeleri — TEK KAYNAK.
//
// "Açık talep" listesi 01.10.2026'ya kadar 13 ayrı dosyada elle kopyalanmıştı
// (liste ucu, stats, iki rapor ucu, ekran, YetkisizErisim…). Yeni bir durum
// eklenince hepsini bulmak gerekiyordu; biri atlanırsa talep listeden sessizce
// düşüyor, sayımlar tutmuyordu. Bu dosya o kopyaların yerine geçer.

/** Talebin hâlâ iş beklediği durumlar — kapanmış/iptal olmayan her şey. */
export const ACIK_TICKET_DURUMLARI = [
  'NEW',
  'ASSIGNED',
  'IN_PROGRESS',
  'PENDING',
  'ON_HOLD',
  'PURCHASING',
  'REOPENED',
] as const

export type AcikTicketDurumu = (typeof ACIK_TICKET_DURUMLARI)[number]

/**
 * Prisma `where: { status: { in: … } }` için dizi kopyası.
 * Tip TicketStatus — enum'a eklenmemiş bir değer yazılırsa DERLEME hatası verir
 * (string[] olsaydı sessizce geçer, sorgu çalışma anında patlardı).
 */
export const ACIK_TICKET_DURUMLARI_DIZI: TicketStatus[] = [...ACIK_TICKET_DURUMLARI]

const ACIK_SET = new Set<string>(ACIK_TICKET_DURUMLARI)

export function acikTicketMi(status: string | null | undefined): boolean {
  return !!status && ACIK_SET.has(status)
}
