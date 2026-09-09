import * as React from "react"
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react"
import { cn } from "@/lib/utils"

export interface DeltaBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Yüzdesel değişim. Sonlu değilse (0'a bölme, eksik veri) rozet "—" gösterir. */
  value: number
  /** Gösterilecek ondalık basamak sayısı. Yön de bu basamağa yuvarlanmış değerden türetilir. */
  precision?: number
  /**
   * Hangi yönün "iyi" sayılacağı. Varsayılan "up" (artış iyi → emerald).
   * Artışın kötü olduğu metriklerde (devir hızı, SLA ihlali, devamsızlık) good="down" verin.
   */
  good?: "up" | "down"
}

/**
 * Dönemsel değişim rozeti — hub geneli ortak bileşen, ekrana özel varsayılanı yoktur.
 *
 * Yön DAİMA yuvarlanmış değerden hesaplanır: 0.04 "%0.0" yazıp yeşil yukarı ok
 * göstermesin diye. Renk yönün kendisini değil, yönün İYİ olup olmadığını anlatır;
 * bu yüzden good prop'u olmadan kullanmayın.
 */
export function DeltaBadge({
  value,
  precision = 1,
  good = "up",
  className,
  ...props
}: DeltaBadgeProps) {
  const temel = "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium"

  // Sonsuz/NaN: önceki dönem 0 ise oran hesaplanamaz. "NaN%" yazmak yerine nötr tire.
  if (!Number.isFinite(value)) {
    return (
      <span
        className={cn(temel, "bg-slate-100 text-slate-500", className)}
        title="Karşılaştırılacak önceki dönem verisi yok"
        {...props}
      >
        <span aria-hidden="true">—</span>
        <span className="sr-only">değişim hesaplanamadı</span>
      </span>
    )
  }

  const yuvarlanmis = Number(value.toFixed(precision))
  const sabit = yuvarlanmis === 0
  const artis = yuvarlanmis > 0
  const iyi = sabit ? null : (artis ? "up" : "down") === good

  const Icon = sabit ? ArrowRight : artis ? ArrowUp : ArrowDown
  const renk = sabit
    ? "bg-slate-100 text-slate-700"
    : iyi
      ? "bg-emerald-100 text-emerald-800"
      : "bg-rose-100 text-rose-800"

  return (
    <span className={cn(temel, renk, className)} {...props}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span className="sr-only">{sabit ? "değişim yok" : artis ? "artış" : "azalış"} </span>
      {Math.abs(yuvarlanmis).toFixed(precision)}%
    </span>
  )
}
