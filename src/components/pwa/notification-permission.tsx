"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Bell, BellOff, Loader2, X } from "lucide-react"
import { toast } from "sonner"

const DISMISS_KEY = "push-banner-dismissed"
const DISMISS_DAYS = 30

// URL-safe base64'ü Uint8Array'e çevir
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function isDismissed(): boolean {
  try {
    const ts = localStorage.getItem(DISMISS_KEY)
    if (!ts) return false
    const dismissedAt = parseInt(ts, 10)
    const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24)
    return daysSince < DISMISS_DAYS
  } catch {
    return false
  }
}

function setDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
  } catch { /* ignore */ }
}

// Service worker'ı hazır hale getir (register + activate bekle)
async function ensureServiceWorkerReady(timeoutMs = 15000): Promise<ServiceWorkerRegistration> {
  // Zaten aktif SW var mı kontrol et
  const existingReg = await navigator.serviceWorker.getRegistration()
  if (existingReg?.active) {
    return existingReg
  }

  // SW kayıtlı değilse veya aktif değilse, kaydet
  if (!existingReg) {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" })
  }

  // SW'nin aktif olmasını bekle (timeout ile)
  return new Promise<ServiceWorkerRegistration>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Service worker zaman aşımı"))
    }, timeoutMs)

    navigator.serviceWorker.ready.then((reg) => {
      clearTimeout(timer)
      resolve(reg)
    }).catch((err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

// Sessiz arka plan subscription (banner göstermeden)
async function silentSubscribe(): Promise<boolean> {
  try {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidPublicKey) return false

    const registration = await ensureServiceWorkerReady(10000)

    // Mevcut subscription varsa zaten OK
    const existingSub = await registration.pushManager.getSubscription()
    if (existingSub) return true

    // Yeni subscription oluştur
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })

    // Sunucuya kaydet
    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey("p256dh")!))),
          auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey("auth")!))),
        },
      }),
    })

    return response.ok
  } catch (error) {
    console.warn("[Push] Sessiz subscription başarısız:", error)
    return false
  }
}

export function NotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default")
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [showBanner, setShowBanner] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    // Bildirim desteğini kontrol et
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPermission("unsupported")
      return
    }

    const perm = Notification.permission
    setPermission(perm)

    // İzin reddedilmişse hiçbir şey yapma
    if (perm === "denied") return

    // İzin zaten verilmişse sessizce arka planda subscribe ol (banner yok)
    if (perm === "granted") {
      silentSubscribe()
      return
    }

    // İzin henüz istenmemişse ("default") ve kullanıcı daha önce kapatmamışsa banner göster
    if (perm === "default" && !isDismissed()) {
      const timer = setTimeout(() => {
        if (mountedRef.current) setShowBanner(true)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [])

  const dismissBanner = () => {
    setShowBanner(false)
    setDismissed()
  }

  const requestPermission = async () => {
    setIsSubscribing(true)
    try {
      const result = await Notification.requestPermission()
      if (mountedRef.current) setPermission(result)

      if (result === "granted") {
        await new Promise((r) => setTimeout(r, 500))
        const ok = await silentSubscribe()
        if (ok) {
          toast.success("Bildirimler aktif!", {
            description: "Artık mesaj bildirimlerini alacaksınız.",
          })
        }
        if (mountedRef.current) setShowBanner(false)
      } else if (result === "denied") {
        toast.error("Bildirim izni reddedildi", {
          description: "Tarayıcı ayarlarından bildirimleri etkinleştirebilirsiniz.",
        })
        if (mountedRef.current) setShowBanner(false)
      }
    } catch (error) {
      console.error("[Push] İzin isteme hatası:", error)
    } finally {
      if (mountedRef.current) {
        setIsSubscribing(false)
      }
    }
  }

  // Banner gösterilmeyecek durumlar
  if (permission === "unsupported" || permission === "denied" || permission === "granted" || !showBanner) {
    return null
  }

  return (
    <div
      className="fixed left-4 right-4 z-[60] sm:left-auto sm:right-4 sm:w-96 bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-4"
    >
      <div className="bg-card border rounded-lg shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <Bell className="h-6 w-6 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">Bildirimleri Aç</p>
            <p className="text-xs text-muted-foreground mt-1">
              Yeni mesaj ve grup bildirimlerini anında alın.
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={requestPermission}
                disabled={isSubscribing}
              >
                {isSubscribing ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Ayarlanıyor...
                  </>
                ) : (
                  <>
                    <Bell className="h-3 w-3 mr-1" />
                    İzin Ver
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={dismissBanner}
              >
                Sonra
              </Button>
            </div>
          </div>
          <button
            onClick={dismissBanner}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// Settings sayfası için bildirim toggle bileşeni
export function NotificationToggle() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default")
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPermission("unsupported")
      return
    }

    setPermission(Notification.permission)
    checkSubscription()
  }, [])

  const checkSubscription = async () => {
    try {
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("SW timeout")), 5000)
        )
      ])
      const subscription = await registration.pushManager.getSubscription()
      setIsSubscribed(!!subscription)
    } catch (error) {
      console.error("[Push] Subscription kontrol hatası:", error)
    }
  }

  const handleToggle = async () => {
    setIsLoading(true)
    try {
      if (isSubscribed) {
        // Unsubscribe
        const registration = await ensureServiceWorkerReady(15000)
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          await subscription.unsubscribe()
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          })
        }
        setIsSubscribed(false)
        toast.success("Bildirimler kapatıldı")
      } else {
        // Subscribe
        if (permission !== "granted") {
          const result = await Notification.requestPermission()
          setPermission(result)
          if (result !== "granted") {
            toast.error("Bildirim izni verilmedi")
            return
          }
          // Mobilde SW hazır olması için bekle
          await new Promise((r) => setTimeout(r, 500))
        }

        const registration = await ensureServiceWorkerReady(15000)
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!vapidPublicKey) throw new Error("VAPID yapılandırması eksik")

        // Mevcut subscription varsa temizle
        const existingSub = await registration.pushManager.getSubscription()
        if (existingSub) {
          await existingSub.unsubscribe()
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        })

        const response = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: {
              p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey("p256dh")!))),
              auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey("auth")!))),
            },
          }),
        })

        if (!response.ok) {
          throw new Error("Sunucuya kaydetme başarısız")
        }

        setIsSubscribed(true)
        toast.success("Bildirimler açıldı!")
      }
    } catch (error) {
      console.error("[Push] Toggle hatası:", error)
      const errorMessage = error instanceof Error ? error.message : "Bilinmeyen hata"
      toast.error(`İşlem başarısız: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  if (permission === "unsupported") {
    return (
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">Push Bildirimleri</p>
          <p className="text-sm text-muted-foreground">Tarayıcınız bildirimleri desteklemiyor</p>
        </div>
        <BellOff className="h-5 w-5 text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium">Push Bildirimleri</p>
        <p className="text-sm text-muted-foreground">
          {isSubscribed ? "Mesaj bildirimleri aktif" : "Mesaj bildirimleri kapalı"}
        </p>
      </div>
      <Button
        variant={isSubscribed ? "outline" : "default"}
        size="sm"
        onClick={handleToggle}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isSubscribed ? (
          <>
            <BellOff className="h-4 w-4 mr-1" />
            Kapat
          </>
        ) : (
          <>
            <Bell className="h-4 w-4 mr-1" />
            Aç
          </>
        )}
      </Button>
    </div>
  )
}
