'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * IPRO alt sayfalarından kapak sayfasına (/ipro) tek parça accent dolgulu rozet geri butonu:
 * ← ikon + "IPRO Üretim Takip"; radius var(--radius), 13px, beyaz metin, hover'da bir ton koyulaşır.
 *
 * NOT: /ipro, mevcut yolun (/ipro/harita…) ön-ekidir → Next <Link> soft-nav bu durumda güvenilmez
 * (Sidebar renderMenuItem handleClick aynı deseni kullanıyor). Ön-ek eşleşince sert gezinme fallback.
 * className ile dıştan margin ezilebilir (terminal header'da mb-0 için).
 */
export function KapakDonus({ className }: { className?: string }) {
  const pathname = usePathname()
  return (
    <Link
      href="/ipro"
      onClick={(e) => {
        if (pathname?.startsWith('/ipro')) {
          e.preventDefault()
          window.location.href = '/ipro'
        }
      }}
      className={cn(
        'mb-3 inline-flex items-center gap-1.5 rounded-[var(--radius)] bg-[#1B4F72] px-3 py-1.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#153c58]',
        className,
      )}
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      IPRO Üretim Takip
    </Link>
  )
}
