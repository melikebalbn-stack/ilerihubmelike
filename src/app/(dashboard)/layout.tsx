"use client"

import React from "react"
import { Sidebar, SidebarProvider, useSidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { BottomNav } from "@/components/layout/BottomNav"
import { useEffect, Suspense, useState } from "react"
import { Toaster } from "sonner"
import { cn } from "@/lib/utils"
import { RouteChangeProvider } from "@/components/providers/route-change-provider"
import { InstallPrompt } from "@/components/pwa/install-prompt"
import { NotificationPermission } from "@/components/pwa/notification-permission"

// İçerik alanı — sidebar collapse/pin durumuna göre sol ofset (lg) ayarlanır.
function DashboardContent({ children }: { children: React.ReactNode }) {
  const { pinned, collapsed } = useSidebar()
  // İçerik geniş ofset yalnız sidebar docked-geniş iken (pinli + collapsed değil).
  // Pinsiz/hover'da sidebar overlay olarak açılır, içerik kaymaz (dar ofset kalır).
  const contentWide = pinned && !collapsed
  return (
    <div
      className={cn(
        "flex flex-1 flex-col overflow-hidden min-w-0 transition-[padding] duration-200",
        contentWide ? "lg:pl-64" : "lg:pl-16"
      )}
    >
      <Header />
      <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background p-4 lg:p-6 pb-20 lg:pb-4">
        {children}
      </main>
    </div>
  )
}

// PWA bileşenlerini izole et - hata olursa sayfayı çökertmesin
function SafeComponent({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = useState(false)

  if (hasError) return null

  return (
    <ErrorBoundaryWrapper onError={() => setHasError(true)}>
      {children}
    </ErrorBoundaryWrapper>
  )
}

class ErrorBoundaryWrapper extends React.Component<
  { children: React.ReactNode; onError: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; onError: () => void }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error("[PWA Component Error]", error)
    this.props.onError()
  }

  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Initialize cron scheduler on mount
  useEffect(() => {
    const initScheduler = async () => {
      try {
        await fetch('/api/cron/init')
        console.log('✅ Cron scheduler initialized')
      } catch (error) {
        console.error('❌ Failed to initialize cron scheduler:', error)
      }
    }

    initScheduler()
  }, [])

  return (
    <Suspense fallback={null}>
      <RouteChangeProvider>
        <SidebarProvider>
          <div className="flex h-screen overflow-hidden">
            <Toaster position="top-right" richColors closeButton />
            <SafeComponent><InstallPrompt /></SafeComponent>
            <SafeComponent><NotificationPermission /></SafeComponent>

            {/* Masaüstü Sidebar */}
            <Sidebar />

            {/* İçerik alanı (collapse/pin'e göre ofset) */}
            <DashboardContent>{children}</DashboardContent>

            {/* Mobil alt navigasyon */}
            <BottomNav />
          </div>
        </SidebarProvider>
      </RouteChangeProvider>
    </Suspense>
  )
}
