'use client'

// Üretim Terminali — ekranlar arası paylaşılan küçük UI parçaları.

export const TERMINAL_ACCENT = '#1B4F72'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase('tr')
  return (parts[0][0] + parts[parts.length - 1][0]).toLocaleUpperCase('tr')
}

/** Sağ üstteki operatör rozeti — mavi pill + baş harf avatarı. */
export function OperatorBadge({ name }: { name: string }) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4 text-white shadow-sm"
      style={{ background: TERMINAL_ACCENT }}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-semibold">
        {initials(name)}
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[11px] uppercase tracking-wide text-white/60">
          Operatör
        </span>
        <span className="text-sm font-medium">{name}</span>
      </span>
    </div>
  )
}
