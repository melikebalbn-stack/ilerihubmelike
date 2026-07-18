'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'

// Üretim Terminali — ekranlar arası paylaşılan küçük UI parçaları.

export const TERMINAL_ACCENT = '#1B4F72'

/**
 * Terminal guard reddinde gösterilen sade "yetkisiz" ekranı.
 * Terminal kabuğu sidebar'sız olduğundan çıkış yolu panoya (/dashboard) döner.
 */
export function TerminalYetkiYok() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-5 p-6 text-center">
      <span
        className="flex h-16 w-16 items-center justify-center rounded-2xl text-white"
        style={{ background: TERMINAL_ACCENT }}
      >
        <Lock className="h-8 w-8" />
      </span>
      <p className="max-w-xs text-base font-medium text-foreground">
        Bu sayfayı görmek için yetkiniz bulunmamaktadır.
      </p>
      <Link
        href="/dashboard"
        className="flex min-h-11 items-center justify-center rounded-xl px-6 text-sm font-semibold text-white active:translate-y-px"
        style={{ background: TERMINAL_ACCENT }}
      >
        Panoya dön
      </Link>
    </div>
  )
}

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
