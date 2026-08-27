/**
 * Ticket numarası üretimi — TEK KAYNAK.
 *
 * POST /api/tickets içinde private bir fonksiyondu; e-posta kanalı da ticket
 * açtığı için buraya çıkarıldı. Mantık AYNEN korundu, yeniden yazılmadı:
 * yıl önekiyle son numarayı bul, bir artır.
 *
 * ⚠ BİLİNEN SINIR (mevcut davranış, bu işte DEĞİŞTİRİLMEDİ): advisory lock ya
 * da veritabanı dizisi yok. İki ticket tam aynı anda açılırsa ikisi de aynı
 * numarayı okuyabilir ve ikincisi ticketNumber @unique kısıtına takılır.
 * Bugüne kadar sorun çıkarmamış (dakikada tek hane talep); e-posta cron'u
 * mesajları SIRAYLA işlediği için bu sınırı genişletmiyor. Kalıcı çözüm
 * (sequence ya da pg advisory lock) AYRI İŞ.
 */

import type { PrismaClient } from '@/generated/prisma'

type PrismaBenzeri = Pick<PrismaClient, 'ticket'>

export async function ticketNumarasiUret(db: PrismaBenzeri): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `TKT-${year}-`

  const lastTicket = await db.ticket.findFirst({
    where: { ticketNumber: { startsWith: prefix } },
    orderBy: { ticketNumber: 'desc' },
  })

  let nextNumber = 1
  if (lastTicket) {
    const lastNumber = parseInt(lastTicket.ticketNumber.split('-').pop() || '0')
    nextNumber = lastNumber + 1
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`
}
