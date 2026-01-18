"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Download, X, Smartphone, Monitor, Share } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Check if already installed (standalone mode)
    const standalone = window.matchMedia("(display-mode: standalone)").matches
    setIsStandalone(standalone)

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    setIsIOS(iOS)

    // Listen for install prompt event
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)

      // Check if user has dismissed before
      const dismissed = localStorage.getItem("pwa-install-dismissed")
      const dismissedDate = dismissed ? new Date(dismissed) : null
      const now = new Date()

      // Show again after 7 days
      if (!dismissedDate || (now.getTime() - dismissedDate.getTime()) > 7 * 24 * 60 * 60 * 1000) {
        // Delay showing prompt
        setTimeout(() => setShowPrompt(true), 3000)
      }
    }

    window.addEventListener("beforeinstallprompt", handler)

    // Show iOS prompt after delay if not installed
    if (iOS && !standalone) {
      const dismissed = localStorage.getItem("pwa-install-dismissed-ios")
      const dismissedDate = dismissed ? new Date(dismissed) : null
      const now = new Date()

      if (!dismissedDate || (now.getTime() - dismissedDate.getTime()) > 7 * 24 * 60 * 60 * 1000) {
        setTimeout(() => setShowPrompt(true), 5000)
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === "accepted") {
      setDeferredPrompt(null)
    }

    setShowPrompt(false)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    if (isIOS) {
      localStorage.setItem("pwa-install-dismissed-ios", new Date().toISOString())
    } else {
      localStorage.setItem("pwa-install-dismissed", new Date().toISOString())
    }
  }

  // Don't show if already installed
  if (isStandalone) return null

  return (
    <Dialog open={showPrompt} onOpenChange={setShowPrompt}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            ILERIHub Uygulamasini Yukle
          </DialogTitle>
          <DialogDescription>
            ILERIHub&apos;i telefonunuza veya bilgisayariniza yukleyerek daha hizli erisim saglayin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Benefits */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Download className="h-4 w-4 text-primary" />
              </div>
              <span>Hizli erisim</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Monitor className="h-4 w-4 text-primary" />
              </div>
              <span>Tam ekran</span>
            </div>
          </div>

          {isIOS ? (
            // iOS Instructions
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <p className="text-sm font-medium">iOS&apos;ta yukleme:</p>
              <ol className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">1</span>
                  Safari&apos;nin alt menusunden
                  <Share className="h-4 w-4" />
                  simgesine dokunun
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">2</span>
                  &quot;Ana Ekrana Ekle&quot; secenegine dokunun
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">3</span>
                  &quot;Ekle&quot; butonuna dokunun
                </li>
              </ol>
            </div>
          ) : (
            // Android / Desktop Install Button
            <div className="flex gap-2">
              <Button onClick={handleInstall} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Simdi Yukle
              </Button>
              <Button variant="outline" onClick={handleDismiss}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {isIOS && (
            <Button variant="outline" onClick={handleDismiss} className="w-full">
              Daha Sonra
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
