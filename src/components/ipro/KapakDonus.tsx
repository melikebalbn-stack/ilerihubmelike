'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * IPRO alt sayfalarından kapak sayfasına (/ipro) iki parçalı rozet geri butonu (tremor "Badge 11"
 * deseni): sol koyu/dolgulu ikon+etiket, dikey ayraç, sağ eylem. accent mavi, beyaz metin,
 * radius var(--radius), 13px; hover'da bir ton koyulaşır.
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
        'group mb-3 inline-flex items-center overflow-hidden rounded-[var(--radius)] text-[13px] font-medium text-white shadow-sm',
        className,
      )}
    >
      <span className="flex items-center gap-1.5 bg-[#1B4F72] px-3 py-1.5 transition-colors group-hover:bg-[#153c58]">
        <ArrowLeft className="h-3.5 w-3.5" />
        IPRO Üretim Takip
      </span>
      <span className="border-l border-white/25 bg-[#2a6ea3] px-3 py-1.5 transition-colors group-hover:bg-[#215a84]">
        Kapak
      </span>
    </Link>
  )
}
