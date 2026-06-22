"use client"

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import NProgress from 'nprogress'

// NProgress konfigürasyonu
NProgress.configure({
  showSpinner: false,
  minimum: 0.1,
  speed: 300,
  trickleSpeed: 200,
})

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    NProgress.done()
  }, [pathname, searchParams])

  return <>{children}</>
}

// Navigation event handler - Link component için
export function useNavigationProgress() {
  const handleNavigationStart = () => {
    NProgress.start()
  }

  return { handleNavigationStart }
}
