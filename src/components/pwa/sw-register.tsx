"use client";

import { useEffect } from "react";

/**
 * ILERIHub vanilla service worker register'ı.
 *
 * /sw.js install/activate/fetch + push handler içerir. Production'da
 * register edilir; dev modunda gereksiz (Next.js HMR ile çakışır).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        console.log("[SW] Registered:", reg.scope);

        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "activated") {
              console.log("[SW] Updated to new version");
            }
          });
        });
      })
      .catch((err) => {
        console.error("[SW] Registration failed:", err);
      });
  }, []);

  return null;
}
