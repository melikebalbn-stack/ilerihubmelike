'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

/**
 * IPRO alt sayfalarında kapak sayfasına (/ipro) küçük geri bağlantısı.
 * NOT: /ipro, mevcut yolun (/ipro/harita…) ön-ekidir → Next <Link> soft-nav bu
 * durumda güvenilmez (Sidebar renderMenuItem handleClick aynı deseni kullanıyor).
 * Bu yüzden ön-ek eşleşince sert gezinme (window.location) fallback'i uygulanır.
 */
export function KapakDonus() {
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
      className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-primary"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      IPRO Üretim Takip
    </Link>
  )
}
