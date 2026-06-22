import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  /** 1, 2, 3 — kart numarası (mono badge) */
  number: number | string
  /** Uppercase başlık (mockup .card-head h2) */
  title: string
  /** Sağ tarafta küçük hint metni veya component (örn. auto-suggest) */
  hint?: ReactNode
  /** Body className override — table gibi full-bleed içerik için padding kaldırılabilir */
  bodyClassName?: string
  /** Wrapper className override */
  className?: string
  children: ReactNode
}

/**
 * KALITE form sayfalarında "Card 1 / 2 / 3" düzeni.
 * Mockup F18-8511-Mockup.html .card + .card-head + .card-body paritesi.
 *
 * - white bg, border slate-200, rounded-10, overflow-visible
 * - head: linear-gradient #fdfdfd→#f9fafb, 22×22 navy badge mono numara,
 *   uppercase tracking title, sağda hint (slate-500)
 * - body: default p-5; override edilebilir
 */
export function CardNumbered({
  number,
  title,
  hint,
  bodyClassName,
  className,
  children,
}: Props) {
  return (
    <section
      className={cn(
        'bg-white border border-slate-200 rounded-[10px] overflow-visible',
        className,
      )}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-gradient-to-b from-[#fdfdfd] to-[#f9fafb]">
        <h2 className="font-quality text-[13px] font-bold text-slate-700 uppercase tracking-[0.06em] flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-[22px] h-[22px] bg-[#1B4F72] text-white rounded-[5px] font-quality-mono text-[11px] font-bold">
            {number}
          </span>
          {title}
        </h2>
        {hint && (
          <span className="font-quality text-[11px] text-slate-500 font-normal">
            {hint}
          </span>
        )}
      </div>
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </section>
  )
}
