"use client"

import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { useEffect, Suspense, useState } from "react"
import { Toaster } from "sonner"
import { RouteChangeProvider } from "@/components/providers/route-change-provider"
import { InstallPrompt } from "@/components/pwa/install-prompt"
import { NotificationPermission } from "@/components/pwa/notification-permission"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
        <div className="flex h-screen overflow-hidden">
          <Toaster position="top-right" richColors closeButton />
          <InstallPrompt />
          <NotificationPermission />

          {/* Mobile overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />

          <div className="flex flex-1 flex-col overflow-hidden min-w-0">
            <Header onMenuClick={() => setSidebarOpen(true)} />
            <main className="flex-1 overflow-auto bg-background p-4 lg:p-6">
              {children}
            </main>
          </div>
        </div>
      </RouteChangeProvider>
    </Suspense>
  )
}
