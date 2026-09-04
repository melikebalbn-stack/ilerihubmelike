/**
 * Kronik sorun — ortak kurallar (SAF: prisma yok).
 *
 * Faz 1.5: kronik tespiti OTOMATİK DEĞİL. Faz 1'deki kategori+cihaz tekrar
 * sayımı kaldırıldı; hangi taleplerin "aynı sorun" olduğuna IT ekibi karar
 * verip Ticket.kronikSorunId ile bağlıyor.
 */

/** Kronik sorunları görebilen/yönetebilen kadro — arşivle aynı kapı. */
export function kronikYetkisiVarMi(izinler: string[] | undefined): boolean {
  const i = izinler ?? []
  return i.includes('helpdesk.admin') || i.includes('helpdesk.ticket.resolve')
}

export const KRONIK_DURUMLARI = ['AKTIF', 'COZULDU'] as const
export type KronikDurum = (typeof KRONIK_DURUMLARI)[number]

export function gecerliDurumMu(d: unknown): d is KronikDurum {
  return typeof d === 'string' && (KRONIK_DURUMLARI as readonly string[]).includes(d)
}

/**
 * COZULDU'ya geçişte kalıcı çözüm metni ZORUNLU.
 *
 * Ticket çözümündeki opsiyonellikle karıştırılmamalı: orada amaç akışı
 * tıkamamak (teknisyen yazmazsa da talep çözülür), burada ise kronik sorunun
 * kalıcı çözümü kaydın tek arşiv değeri — notsuz "çözüldü" kaydı, bilgiyi
 * kaybedip yalnız durumu değiştirir.
 */
export function cozumNotuZorunluMu(yeniDurum: string): boolean {
  return yeniDurum === 'COZULDU'
}
