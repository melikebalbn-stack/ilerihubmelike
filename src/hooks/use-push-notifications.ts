"use client";

/**
 * PR-PWA-1: Push notification geçici olarak devre dışı.
 *
 * 29 Apr 2026 incident sonrası public/sw.js kill-switch'e indirildi
 * (deregister + cache temizle + reload). Bu hook'un register çağrıları
 * kill-switch'i tetikleyip reload-loop yaratıyordu.
 *
 * Return shape korundu — TypeScript breaking change yok. Sonraki PR'da
 * gerçek service worker yazılınca implementasyon geri açılacak.
 */
export function usePushNotifications() {
  return {
    isSupported: false,
    isSubscribed: false,
    permission: "default" as NotificationPermission,
    subscribe: async () => false,
    unsubscribe: async () => false,
  };
}
