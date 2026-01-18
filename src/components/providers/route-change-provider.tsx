"use client"

import { useEffect, useState, createContext, useContext } from 'react'
import { usePathname } from 'next/navigation'

const LoadingContext = createContext({
  isLoading: false,
})

export function useLoading() {
  return useContext(LoadingContext)
}

export function RouteChangeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(false)
  const [prevPathname, setPrevPathname] = useState(pathname)

  // Route değiştiğinde loading'i kapat
  useEffect(() => {
    if (pathname !== prevPathname) {
      setIsLoading(false)
      setPrevPathname(pathname)
    }
  }, [pathname, prevPathname])

  // Link tıklamalarını yakala
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const anchor = target.closest('a')

      if (anchor) {
        const href = anchor.getAttribute('href')
        const targetAttr = anchor.getAttribute('target')

        // Yeni sekmede açılan linkleri atla (target="_blank")
        if (targetAttr === '_blank') {
          return
        }

        // Aynı sayfa içi linkleri atla, farklı sayfaya gidiyorsa loading göster
        if (href && href.startsWith('/') && !href.startsWith('#') && href !== pathname) {
          setIsLoading(true)
        }
      }
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [pathname])

  return (
    <LoadingContext.Provider value={{ isLoading }}>
      {children}
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="classic-spinner" />
            <p className="text-sm text-muted-foreground">Yükleniyor...</p>
          </div>
        </div>
      )}
    </LoadingContext.Provider>
  )
}
