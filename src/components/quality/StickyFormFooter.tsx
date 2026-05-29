import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type FooterStatusTone = 'idle' | 'saving' | 'saved' | 'error'

interface Props {
  /** Sol taraf — kısa durum metni (örn. "Otomatik kayıt aktif · son güncelleme...") */
  status?: ReactNode
  /** Sol taraf pulse noktasının rengini belirler */
  statusTone?: FooterStatusTone
  /** Sağ taraf — buton grubu (Taslak / PDF / Onaya Gönder vb.) */
  actions: ReactNode
  className?: string
}

const dotClass: Record<FooterStatusTone, string> = {
  idle: 'bg-slate-300',
  saving: 'bg-amber-500 animate-pulse',
  saved: 'bg-emerald-500',
  error: 'bg-red-500 animate-pulse',
}

/**
 * Form sayfasının dipte sabit duran aksiyon bandı —
 * mockup .footer-actions paritesi.
 *
 * - sticky bottom-0, white bg, border-top slate-200
 * - sol: pulse dot + status metni (slate-500)
 * - sağ: actions slot (buton grubu, parent yerleştirir)
 *
 * `position: sticky` parent'ın overflow yapısına bağlıdır; sayfa düzeyinde
 * kullanım için page wrapper'a `pb-20` (footer yüksekliği kadar) eklenmelidir.
 */
export function StickyFormFooter({
  status,
  statusTone = 'idle',
  actions,
  className,
}: Props) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-20 bg-white border-t border-slate-200 px-6 py-3.5',
        'flex justify-between items-center gap-4',
        className,
      )}
    >
      <div className="font-quality text-[12px] text-slate-500 flex items-center gap-2 min-w-0">
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full flex-shrink-0',
            dotClass[statusTone],
          )}
        />
        <span className="truncate">{status}</span>
      </div>
      <div className="flex items-center gap-2.5 flex-shrink-0">{actions}</div>
    </div>
  )
}
