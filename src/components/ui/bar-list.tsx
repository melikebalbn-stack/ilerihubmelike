import * as React from "react"
import { cn } from "@/lib/utils"

export interface BarListItem {
  /** Satır etiketi (ör. bölüm adı). */
  label: string
  /** Barın uzunluğunu belirleyen sayı. */
  value: number
  /** Sağda değerin altında/yanında gösterilecek ikincil metin (ör. "%12.3"). */
  meta?: string
}

export interface BarListProps extends React.HTMLAttributes<HTMLDivElement> {
  data: BarListItem[]
  /**
   * Bar rengi — Tailwind arka plan sınıfı. Çağıran taraftan gelir;
   * bileşen kendi başına bir kategori rengi varsaymaz.
   */
  barClassName?: string
  /**
   * Ölçek tabanı. Verilmezse listedeki en büyük değer maksimum kabul edilir;
   * birden çok listeyi aynı ölçekte göstermek isteyen çağıran burayı doldurur.
   */
  max?: number
  /** Liste boşken gösterilecek metin. */
  emptyText?: string
}

/**
 * Yatay bar listesi (Tremor "Bar List" deseni): solda etiket, altında maksimuma
 * oranlı bar, sağda sayı. Grafik kütüphanesi kullanmaz — saf div + Tailwind,
 * bu sayede yazdırmada ve dar ekranda da bozulmadan basılır.
 */
export function BarList({
  data,
  barClassName = "bg-slate-500",
  max,
  emptyText = "Kayıt yok",
  className,
  ...props
}: BarListProps) {
  const tavan = max ?? data.reduce((enBuyuk, satir) => Math.max(enBuyuk, satir.value), 0)

  if (data.length === 0) {
    return <p className={cn("py-6 text-center text-xs text-slate-400", className)}>{emptyText}</p>
  }

  return (
    <div className={cn("space-y-2", className)} {...props}>
      {data.map((satir) => {
        // Sıfır tavanda bölme yok; 2% taban sayesinde 1 kişilik bölüm de görünür kalır.
        const oran = tavan > 0 ? Math.max((satir.value / tavan) * 100, 2) : 0
        return (
          <div key={satir.label} className="break-inside-avoid">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-xs font-medium text-slate-700" title={satir.label}>
                {satir.label}
              </span>
              <span className="shrink-0 text-xs text-slate-500">
                {satir.meta ? <span className="mr-2 text-slate-400">{satir.meta}</span> : null}
                <span className="font-semibold tabular-nums text-slate-800">{satir.value}</span>
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className={cn("h-full rounded-full", barClassName)} style={{ width: `${oran}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
