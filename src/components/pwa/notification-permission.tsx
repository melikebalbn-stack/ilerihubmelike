"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Bell, BellOff, Loader2, X } from "lucide-react"
import { toast } from "sonner"

export function NotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default")
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [showBanner, setShowBanner] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)

  useEffect(() => {
    // Bildirim desteğini kontrol et
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermission("unsupported")
      return
    }

    setPermission(Notification.permission)

    // Mevcut subscription'ı kontrol et
    checkExistingSubscription()

    // İzin henüz istenmemişse banner'ı göster
    if (Notification.permission === "default") {
      // Biraz bekle, kullanıcı sayfaya alışsın
      const timer = setTimeout(() => {
        setShowBanner(true)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [])

  const checkExistingSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      setIsSubscribed(!!subscription)
    } catch (error) {
      console.error("Subscription kontrol hatası:", error)
    }
  }

  const subscribeToPush = async () => {
    setIsSubscribing(true)

    try {
      // Service Worker hazır olana kadar bekle
      const registration = await navigator.serviceWorker.ready

      // VAPID public key'i al
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) {
        throw new Error("VAPID public key bulunamadı")
      }

      // URL-safe base64'ü Uint8Array'e çevir
      const urlBase64ToUint8Array = (base64String: string) => {
        const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
        const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
        const rawData = window.atob(base64)
        const outputArray = new Uint8Array(rawData.length)
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i)
        }
        return outputArray
      }

      // Push subscription oluştur
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })

      // Subscription'ı sunucuya kaydet
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
      setShowBanner(false)
      toast.success("Bildirimler aktif!", {
        description: "Artık mesaj bildirimlerini alacaksınız.",
      })
    } catch (error) {
      console.error("Push subscription hatası:", error)
      toast.error("Bildirim ayarlanamadı", {
        description: "Lütfen tarayıcı ayarlarınızı kontrol edin.",
      })
    } finally {
      setIsSubscribing(false)
    }
  }

  const requestPermission = async () => {
    try {
      const result = await Notification.requestPermission()
      setPermission(result)

      if (result === "granted") {
        await subscribeToPush()
      } else if (result === "denied") {
        toast.error("Bildirim izni reddedildi", {
          description: "Tarayıcı ayarlarından bildirimleri etkinleştirebilirsiniz.",
        })
        setShowBanner(false)
      }
    } catch (error) {
      console.error("İzin isteme hatası:", error)
    }
  }

  const unsubscribeFromPush = async () => {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        await subscription.unsubscribe()

        // Sunucudan da sil
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })

        setIsSubscribed(false)
        toast.success("Bildirimler kapatıldı")
      }
    } catch (error) {
      console.error("Unsubscribe hatası:", error)
      toast.error("İşlem başarısız")
    }
  }

  // Desteklenmiyorsa gösterme
  if (permission === "unsupported") {
    return null
  }

  // Zaten izin verilmiş ve subscribe olmuş
  if (permission === "granted" && isSubscribed && !showBanner) {
    return null
  }

  // İzin reddedilmiş
  if (permission === "denied") {
    return null
  }

  // Banner göster
  if (!showBanner) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:w-96">
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
                onClick={() => setShowBanner(false)}
              >
                Sonra
              </Button>
            </div>
          </div>
          <button
            onClick={() => setShowBanner(false)}
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
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermission("unsupported")
      return
    }

    setPermission(Notification.permission)
    checkSubscription()
  }, [])

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      setIsSubscribed(!!subscription)
    } catch (error) {
      console.error("Subscription kontrol hatası:", error)
    }
  }

  const handleToggle = async () => {
    setIsLoading(true)
    try {
      // Service worker için timeout ekle (10 saniye)
      const getRegistrationWithTimeout = () => {
        return Promise.race([
          navigator.serviceWorker.ready,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Service worker zaman aşımı")), 10000)
          )
        ])
      }

      if (isSubscribed) {
        // Unsubscribe
        const registration = await getRegistrationWithTimeout()
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
        }

        const registration = await getRegistrationWithTimeout()
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!vapidPublicKey) throw new Error("VAPID key yok")

        const urlBase64ToUint8Array = (base64String: string) => {
          const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
          const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
          const rawData = window.atob(base64)
          const outputArray = new Uint8Array(rawData.length)
          for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i)
          }
          return outputArray
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        })

        await fetch("/api/push/subscribe", {
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

        setIsSubscribed(true)
        toast.success("Bildirimler açıldı!")
      }
    } catch (error) {
      console.error("Toggle hatası:", error)
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
