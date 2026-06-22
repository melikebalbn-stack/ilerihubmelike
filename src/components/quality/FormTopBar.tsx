import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface FormTopBarMeta {
  label: string
  value: string
}

interface Props {
  /** Mono badge — F18.8511 vb. form/rapor numarası */
  formNo: string
  /** Ana başlık (TR) */
  title: string
  /** Alt başlık (EN — uppercase tracking) */
  subtitle?: string
  /** Sağ tarafta sıralı metadata satırları */
  meta?: FormTopBarMeta[]
  /** Sağ köşe aksiyonları (örn. "Geçmiş Ölçümler") */
  actions?: ReactNode
  className?: string
}

/**
 * KALITE form sayfalarının sticky üst bandı.
 * navy bg + white text + mono badge — mockup F18-8511-Mockup.html .topbar paritesi.
 *
 * Modül-scope font: title/subtitle font-quality, badge + meta value font-quality-mono.
 */
export function FormTopBar({
  formNo,
  title,
  subtitle,
  meta,
  actions,
  className,
}: Props) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 bg-[#1B4F72] text-white border-b border-[#143955]',
        className,
      )}
    >
      <div className="mx-auto max-w-[1500px] px-6 py-3 flex items-center justify-between gap-6">
        <div className="flex items-center gap-3.5 min-w-0">
          <span className="font-quality-mono text-[12px] font-semibold tracking-[0.04em] bg-white/10 border border-white/20 px-2.5 py-1 rounded text-white/90">
            {formNo}
          </span>
          <div className="min-w-0">
            <div className="font-quality text-[14px] font-semibold text-white tracking-[-0.01em] truncate">
              {title}
            </div>
            {subtitle && (
              <div className="text-[11px] text-white/55 tracking-[0.02em] uppercase mt-px truncate">
                {subtitle}
              </div>
            )}
          </div>
        </div>

        {meta && meta.length > 0 && (
          <div className="hidden md:flex gap-7 text-[11px] text-white/70 tracking-[0.02em]">
            {meta.map((m, i) => (
              <div key={i}>
                {m.label}
                <strong className="block font-quality-mono font-medium text-[13px] text-white tracking-normal mt-px">
                  {m.value}
                </strong>
              </div>
            ))}
          </div>
        )}

        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}
