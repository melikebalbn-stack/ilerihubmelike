'use client'

import Link from 'next/link'
import {
  ArrowDownUp,
  ArrowLeft,
  ClipboardList,
  PackageMinus,
  Send,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OperatorBadge, TERMINAL_ACCENT } from '../_shared'

interface Props {
  operatorName: string
}

interface DepoKart {
  label: string
  alt?: string
  Icon: LucideIcon
  href?: string
  yakinda?: boolean
}

const KARTLAR: DepoKart[] = [
  { label: 'Stok Taşıma', alt: 'Raf okut, taşı, etiketle', Icon: ArrowDownUp, href: '/terminal/depo/stok-tasima' },
  { label: 'Malzeme Toplama', alt: 'İş emri okut, FIFO ile topla', Icon: ClipboardList, href: '/terminal/depo/toplama' },
  { label: 'Transfer Talebi', Icon: Send, yakinda: true },
  { label: 'Malzeme Talebi', Icon: PackageMinus, yakinda: true },
]

export function DepoMenuClient({ operatorName }: Props) {
  return (
    <div className="flex flex-1 flex-col gap-4 py-2">
      {/* Üst bar — geri + başlık + operatör */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <Link
            href="/terminal"
            aria-label="Terminal menüsüne dön"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors active:bg-muted/70"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-base font-semibold leading-tight">Depo El Terminali</h1>
        </div>
        <OperatorBadge name={operatorName} />
      </div>

      {/* Kartlar */}
      <div className="flex flex-col gap-3">
        {KARTLAR.map(({ label, alt, Icon, href, yakinda }) =>
          yakinda ? (
            <div
              key={label}
              aria-disabled="true"
              className="flex min-h-20 w-full cursor-not-allowed select-none items-center gap-4 rounded-2xl border border-dashed p-4 opacity-50"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Icon className="h-6 w-6" />
              </span>
              <span className="flex-1 text-lg font-medium text-muted-foreground">
                {label}
              </span>
              <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                Yakında
              </span>
            </div>
          ) : (
            <Link
              key={label}
              href={href!}
              className={cn(
                'flex min-h-20 w-full items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm transition-all active:translate-y-px active:shadow-none',
              )}
              style={{ borderColor: TERMINAL_ACCENT }}
            >
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white"
                style={{ background: TERMINAL_ACCENT }}
              >
                <Icon className="h-6 w-6" />
              </span>
              <span className="flex flex-1 flex-col leading-tight">
                <span className="text-lg font-semibold" style={{ color: TERMINAL_ACCENT }}>
                  {label}
                </span>
                {alt && <span className="text-xs text-muted-foreground">{alt}</span>}
              </span>
            </Link>
          ),
        )}
      </div>
    </div>
  )
}
