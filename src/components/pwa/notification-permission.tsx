"use client";

/**
 * PR-PWA-1: Push notification UI'ları geçici olarak devre dışı.
 *
 * 29 Apr 2026 incident sonrası public/sw.js kill-switch'e indirildi
 * (deregister + cache temizle + reload). Bu component'lerin
 * `navigator.serviceWorker.register("/sw.js")` çağrıları kill-switch'i
 * tetikleyip reload-loop yaratıyordu.
 *
 * Export'lar korundu — layout (dashboard) ve settings sayfasından
 * import'lar break etmesin. Sonraki PR'da gerçek service worker yazılınca
 * implementasyon geri açılacak.
 */
export function NotificationPermission() {
  return null;
}

export function NotificationToggle() {
  return null;
}
