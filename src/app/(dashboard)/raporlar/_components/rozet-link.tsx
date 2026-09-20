'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Rapor modülü sayfa başı bağlantıları — IPRO KapakDonus ("Badge 11") deseni birebir:
 * accent dolgulu rozet, ikon + etiket, radius var(--radius), 13px, hover'da bir ton koyulaşır.
 *
 * NOT (KapakDonus / Sidebar handleClick ile aynı): hedef, mevcut yolun ön-ekiyse
 * (/raporlar/[id] → /raporlar) Next <Link> soft-nav güvenilmez — sayfa "Yükleniyor..."da
 * asılı kalır. Ön-ek eşleşince e.preventDefault + window.location.href ile sert gezinme.
 */
export function RozetLink({
  href,
  icon,
  className,
  children,
}: {
  href: string
  icon?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  return (
    <Link
      href={href}
      onClick={(e) => {
        if (pathname === href || pathname?.startsWith(href + '/')) {
          e.preventDefault()
          window.location.href = href
        }
      }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[var(--radius)] bg-[#1B4F72] px-3 py-1.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#153c58]',
        className,
      )}
    >
      {icon}
      {children}
    </Link>
  )
}

/** "← Üst sayfa" geri rozeti — KapakDonus'taki gibi başlığın üstünde, mb-3. */
export function GeriRozet({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <RozetLink href={href} icon={<ArrowLeft className="h-3.5 w-3.5" />} className={cn('mb-3', className)}>
      {children}
    </RozetLink>
  )
}
