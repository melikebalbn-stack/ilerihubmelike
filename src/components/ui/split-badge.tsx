import * as React from "react"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"

/** Repo standardı slate tabanlı palet. Ekrana özel varsayılan yok — tone zorunludur. */
const tones = {
  slate: "bg-slate-500",
  emerald: "bg-emerald-600",
  rose: "bg-rose-600",
  amber: "bg-amber-500",
  violet: "bg-violet-600",
  teal: "bg-teal-600",
  blue: "bg-blue-600",
} as const

export type SplitBadgeTone = keyof typeof tones

export interface SplitBadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color"> {
  /** Sol taraf: ne olduğu (ör. "SLA ihlali · 3 talep"). */
  label: string
  /** Sağ taraf: bağlantının ne yapacağı (ör. "Listele"). */
  action: string
  /** Sağ tarafın hedefi. */
  href: string
  /** Renk çağıran taraftan gelir; bileşen kendi başına bir anlam yüklemez. */
  tone: SplitBadgeTone
  icon?: React.ReactNode
}

/**
 * İkiye bölünmüş rozet: solda etiket, sağda tıklanabilir eylem — hub geneli ortak bileşen.
 *
 * Sağ yarı gerçek bir <Link>; klavye ile gezilebilir olması için focus halkası vardır.
 * Tıklanabilir bir satırın İÇİNE koyacaksanız olayın satıra sıçramaması için
 * sarmalayıcıda stopPropagation kullanın.
 */
export function SplitBadge({
  label,
  action,
  href,
  tone,
  icon,
  className,
  ...props
}: SplitBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-stretch overflow-hidden rounded text-xs font-medium text-white",
        tones[tone],
        className
      )}
      {...props}
    >
      <span className="flex items-center gap-1.5 px-2.5 py-1">
        {icon ? (
          <span className="inline-flex shrink-0" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        {label}
      </span>
      <Link
        href={href}
        aria-label={`${label} — ${action}`}
        className="flex items-center gap-1 border-l border-white/30 px-2.5 py-1 transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-inset"
      >
        {action}
        <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
      </Link>
    </span>
  )
}
