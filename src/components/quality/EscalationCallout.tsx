import { ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  /** Başlık — uppercase, bold (default: "Eskalasyon Prosedürü") */
  title?: string
  /** Açıklama metni veya custom içerik (örn. "Bildirilecek kişi: X") */
  children: ReactNode
  className?: string
}

/**
 * Amber eskalasyon kutusu — mockup .escalation paritesi.
 * Şablon/raporun "Hata/Ret durumunda eskalasyon prosedürü" notu için.
 *
 * - amber-50 bg, amber-100 border, sol 3px amber-500 vurgu çizgisi
 * - sol ikon (AlertCircle 18px amber-700)
 * - sağ: uppercase başlık + amber-700 description
 */
export function EscalationCallout({
  title = 'Eskalasyon Prosedürü',
  children,
  className,
}: Props) {
  return (
    <div
      className={cn(
        'flex gap-3 items-start rounded-md bg-amber-50 border border-amber-100 border-l-[3px] border-l-amber-500 px-3.5 py-3',
        className,
      )}
    >
      <AlertCircle className="w-[18px] h-[18px] text-amber-700 flex-shrink-0 mt-px" />
      <div className="font-quality text-[12.5px] text-amber-700 font-medium leading-[1.5] min-w-0">
        <strong className="block font-bold text-[11.5px] uppercase tracking-[0.05em] mb-0.5">
          {title}
        </strong>
        {children}
      </div>
    </div>
  )
}
