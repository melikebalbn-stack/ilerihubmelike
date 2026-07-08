'use client'

import Link from 'next/link'
import { ChevronRight, Factory, Warehouse } from 'lucide-react'
import { OperatorBadge, TERMINAL_ACCENT } from './_shared'

interface Props {
  operatorName: string
}

const KARTLAR = [
  { href: '/terminal/uretim', label: 'Üretim', Icon: Factory },
  { href: '/terminal/depo', label: 'Depo', Icon: Warehouse },
]

export function TerminalRootClient({ operatorName }: Props) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-2">
      {/* Başlık + operatör */}
      <div className="flex flex-col items-center gap-2 pt-2">
        <h1 className="text-lg font-semibold tracking-tight">İLERİ Terminal</h1>
        <OperatorBadge name={operatorName} />
      </div>

      {/* Büyük dikey kartlar */}
      <div className="mt-2 flex flex-col gap-3">
        {KARTLAR.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-24 w-full items-center gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-all active:translate-y-px active:shadow-none"
            style={{ borderColor: TERMINAL_ACCENT }}
          >
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ background: TERMINAL_ACCENT }}
            >
              <Icon className="h-7 w-7" />
            </span>
            <span
              className="flex-1 text-xl font-semibold"
              style={{ color: TERMINAL_ACCENT }}
            >
              {label}
            </span>
            <ChevronRight className="h-6 w-6 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  )
}
