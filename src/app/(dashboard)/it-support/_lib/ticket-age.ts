// Ticket bekleme yaşı — açılıştan (createdAt) şimdiye. Yalnız AÇIK ticket'larda anlamlı.
// Yaş-bazlı renkli rozet: <1 gün gri, 1-2 gün turuncu, >2 gün kırmızı.

export const OPEN_TICKET_STATUSES = ["NEW", "ASSIGNED", "IN_PROGRESS", "PENDING", "ON_HOLD", "REOPENED"]

export function isOpenStatus(status: string): boolean {
  return OPEN_TICKET_STATUSES.includes(status)
}

export interface TicketAge {
  label: string // "3 gün bekliyor" / "5 saat bekliyor"
  className: string // rozet renk sınıfları
  days: number
}

export function ticketAge(createdAt: string): TicketAge {
  const ms = Date.now() - new Date(createdAt).getTime()
  const days = ms / 86_400_000
  const hours = ms / 3_600_000

  const label =
    days >= 1
      ? `${Math.floor(days)} gün bekliyor`
      : `${Math.max(1, Math.floor(hours))} saat bekliyor`

  const className =
    days > 2
      ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
      : days >= 1
        ? "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400"
        : "bg-muted text-muted-foreground"

  return { label, className, days }
}

// Kapanma süresi — createdAt → COALESCE(closedAt, resolvedAt). Akıllı birim (dk/saat/gün).
// Negatif (test anomalisi: kapanış < açılış) → null (gösterme).
export function resolutionTime(
  createdAt: string,
  closedAt?: string | null,
  resolvedAt?: string | null,
): { label: string } | null {
  const end = closedAt ?? resolvedAt
  if (!end) return null
  const ms = new Date(end).getTime() - new Date(createdAt).getTime()
  if (ms < 0) return null // kapanış açılıştan önce → anlamsız, gösterme

  const mins = ms / 60_000
  const hours = ms / 3_600_000
  const days = ms / 86_400_000

  const unit =
    mins < 1 ? "anında"
    : mins < 60 ? `${Math.round(mins)} dakikada`
    : hours < 24 ? `${Math.round(hours)} saatte`
    : `${Math.floor(days)} günde`

  return { label: `${unit} çözüldü` }
}
