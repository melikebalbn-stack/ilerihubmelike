import * as React from "react"
import { cn } from "@/lib/utils"

export interface ProgressRingCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Kart başlığı (ör. "Kadın Oranı"). */
  title: string
  /** Halkanın doldurduğu yüzde (0-100). Aralık dışı değerler kırpılır. */
  percent: number
  /** Pay — verilirse başlığın altında "pay / payda" olarak yazılır. */
  numerator?: number
  /** Payda. */
  denominator?: number
  /** pay/payda yerine gösterilecek serbest açıklama. */
  description?: string
  /**
   * Halka rengi — Tailwind metin rengi sınıfı (stroke currentColor'dan gelir).
   * Renk çağıran taraftan gelir.
   */
  ringClassName?: string
}

const YARICAP = 26
const CEVRE = 2 * Math.PI * YARICAP

/**
 * Solda SVG halka (yüzde ortada), sağda başlık ve "x / y" — hub geneli ortak bileşen.
 * Oran göstergeleri için; mutlak sayılar için normal istatistik kartı kullanılmalı.
 */
export function ProgressRingCard({
  title,
  percent,
  numerator,
  denominator,
  description,
  ringClassName = "text-slate-500",
  className,
  ...props
}: ProgressRingCardProps) {
  const guvenli = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0
  const bosluk = CEVRE * (1 - guvenli / 100)
  const altMetin =
    numerator !== undefined && denominator !== undefined
      ? `${numerator} / ${denominator}`
      : description

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 break-inside-avoid",
        className
      )}
      {...props}
    >
      <div className={cn("relative shrink-0", ringClassName)}>
        <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`${title}: %${guvenli}`}>
          <circle cx="32" cy="32" r={YARICAP} fill="none" stroke="currentColor" strokeWidth="6" className="text-slate-100" />
          <circle
            cx="32"
            cy="32"
            r={YARICAP}
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={CEVRE}
            strokeDashoffset={bosluk}
            transform="rotate(-90 32 32)"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums text-slate-800">
          %{guvenli}
        </span>
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-600" title={title}>
          {title}
        </p>
        {altMetin ? (
          <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-slate-800">{altMetin}</p>
        ) : null}
      </div>
    </div>
  )
}
