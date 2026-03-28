"use client"

import { useState, useEffect } from "react"
import { Search } from "lucide-react"
import { useSession } from "next-auth/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/theme-toggle"
import { NotificationCenter } from "@/components/notifications/notification-center"
import { CommandPalette } from "@/components/global-search/command-palette"
import { MobileSidebar } from "./MobileSidebar"

// Rol etiketleri
const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrator",
  QUALITY_MANAGER: "Kalite Yoneticisi",
  HR_MANAGER: "IK Yoneticisi",
  USER: "Kullanici",
}

export function Header() {
  const { data: session } = useSession()
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)

  // Kullanicinin bas harflerini al
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  // Cmd+K / Ctrl+K kısayolu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setIsCommandPaletteOpen(true)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <>
      <header className="flex h-14 lg:h-16 items-center justify-between border-b bg-card px-3 lg:px-6">
        {/* Mobile menu button */}
        <MobileSidebar />

        {/* Search — mobilde sadece ikon */}
        <div className="flex flex-1 items-center">
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="hidden md:flex relative w-full max-w-[250px] lg:w-96 h-9 items-center rounded-md border border-input bg-background px-3 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Search className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>Ara...</span>
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="md:hidden flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:bg-accent transition-colors"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1 lg:gap-3">
          {/* Theme Toggle — masaüstünde */}
          <div className="hidden lg:block">
            <ThemeToggle />
          </div>

          {/* Notifications */}
          <NotificationCenter />

          {/* User Profile — masaüstünde */}
          {session?.user && (
            <div className="hidden lg:flex items-center space-x-3">
              <div className="text-right">
                <p className="text-sm font-medium">{session.user.name}</p>
                <p className="text-xs text-muted-foreground">
                  {session.user.title || roleLabels[session.user.role] || session.user.role}
                </p>
              </div>
              <Avatar>
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {getInitials(session.user.name || "U")}
                </AvatarFallback>
              </Avatar>
            </div>
          )}
        </div>
      </header>

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </>
  )
}
