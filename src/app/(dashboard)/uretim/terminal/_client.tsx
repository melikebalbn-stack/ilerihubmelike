'use client'

import Link from 'next/link'
import { ClipboardList, Factory, Plus } from 'lucide-react'
import type { TerminalIsMerkezi } from '@/lib/uretim/terminal-mock'
import { OperatorBadge, TERMINAL_ACCENT } from './_shared'

interface Props {
  operatorName: string
  isMerkezi: TerminalIsMerkezi
}

export function TerminalMenuClient({ operatorName, isMerkezi }: Props) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-8 p-6">
      {/* Üst bar — iş merkezi (sol) + operatör (sağ) */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ background: TERMINAL_ACCENT }}
          >
            <Factory className="h-5 w-5" />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-base font-semibold">
              {isMerkezi.kod} — {isMerkezi.ad}
            </span>
            <span className="text-xs text-muted-foreground">İş merkezi</span>
          </div>
        </div>
        <OperatorBadge name={operatorName} />
      </div>

      {/* Büyük dokunmatik kartlar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Aktif: İş Emirleri */}
        <Link
          href="/uretim/terminal/is-emirleri"
          className="group flex min-h-[160px] flex-col justify-between rounded-2xl border bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm"
          style={{ borderColor: TERMINAL_ACCENT }}
        >
          <span
            className="flex h-14 w-14 items-center justify-center rounded-xl text-white transition-transform group-active:scale-95"
            style={{ background: TERMINAL_ACCENT }}
          >
            <ClipboardList className="h-7 w-7" />
          </span>
          <div>
            <div
              className="text-lg font-semibold"
              style={{ color: TERMINAL_ACCENT }}
            >
              İş Emirleri
            </div>
            <div className="text-sm text-muted-foreground">
              Açık iş emirlerini gör ve bildir
            </div>
          </div>
        </Link>

        {/* Pasif kartlar — sonra eklenecek */}
        {[0, 1].map((i) => (
          <div
            key={i}
            aria-disabled="true"
            className="flex min-h-[160px] cursor-not-allowed flex-col justify-between rounded-2xl border border-dashed p-6 opacity-50 select-none"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Plus className="h-7 w-7" />
            </span>
            <div>
              <div className="text-lg font-semibold text-muted-foreground">
                Sonra eklenecek
              </div>
              <div className="text-sm text-muted-foreground">
                Bu modül ilerleyen aşamada açılacak
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
