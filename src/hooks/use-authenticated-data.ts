"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

/**
 * Auth-gate + loading/error/timeout/polling deseninin tek noktadan yönetimi.
 *
 * Kanon: messages/page.tsx'te elle yazılmış "sonsuz-spinner fix" deseni.
 * Aynı mantık it-support, ticket-detail, dashboard ve backups'ta tekrar ediyordu;
 * bu hook o tekrarı tek yerde topluyor.
 *
 * Davranış:
 *   status 'loading'        → loading=true, bekle (hiçbir şey yapma)
 *   status 'unauthenticated'→ /login'e yönlendir
 *   authenticated + email   → fetchFn() çağır; finally { loading=false }
 *   authenticated + email YOK→ loading=false + loadError=true (spinner'ı kes)
 *   fetchFn throw ederse     → loadError=true (yine de loading kapatılır)
 *   timeout (varsayılan 10sn)→ ilk yükleme bitmediyse loading=false + loadError=true
 *
 * NOT: State'i (loading/loadError) bu hook tutar. VERİYİ tutmaz — data ve diğer
 * state'ler çağıran component'te kalır. Arka planda sessiz yenileme için fetchFn'i
 * doğrudan çağırın; spinner göstererek yeniden yüklemek için retry() kullanın.
 */
interface UseAuthenticatedDataOptions {
  /** Verilirse, authenticated+email iken bu aralıkta fetchFn tekrar çağrılır (loading'e dokunmadan). */
  pollMs?: number
  /** İlk yükleme sigortası; bu süre içinde bitmezse spinner kesilir. Varsayılan 10000. */
  timeoutMs?: number
  /** false ise hiçbir şey yapma, loading=false. Varsayılan true. */
  enabled?: boolean
}

interface UseAuthenticatedDataResult {
  loading: boolean
  loadError: boolean
  retry: () => void
  isAuthenticated: boolean
}

export function useAuthenticatedData(
  fetchFn: () => Promise<void> | void,
  opts: UseAuthenticatedDataOptions = {}
): UseAuthenticatedDataResult {
  const { pollMs, timeoutMs = 10000, enabled = true } = opts
  const { data: session, status } = useSession()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const initialLoadedRef = useRef(false)

  // fetchFn'i ref'te tut: effect dependency'sine koymuyoruz ki çağıran component
  // useCallback'e zorlanmasın ve sonsuz effect döngüsü oluşmasın. Ref her render'da
  // en güncel closure'ı tutar (en taze props/state'i okur).
  const fetchFnRef = useRef(fetchFn)
  fetchFnRef.current = fetchFn

  const email = session?.user?.email
  const isAuthenticated = status === "authenticated" && !!email

  // retry() ilk yüklemeyi yeniden tetiklemek için bu sayacı artırır.
  const [reloadTick, setReloadTick] = useState(0)

  // İlk yükleme — messages/page.tsx kanonu.
  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    if (status === "loading") return
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }
    if (status === "authenticated" && email) {
      let cancelled = false
      ;(async () => {
        try {
          await fetchFnRef.current()
          if (!cancelled) setLoadError(false)
        } catch (err) {
          console.error("[useAuthenticatedData] fetch hatası:", err)
          if (!cancelled) setLoadError(true)
        } finally {
          if (!cancelled) {
            setLoading(false)
            initialLoadedRef.current = true
          }
        }
      })()
      return () => {
        cancelled = true
      }
    }
    // authenticated ama email yok → spinner'ı kes + hata ekranı
    setLoading(false)
    setLoadError(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, email, enabled, reloadTick])

  // Güvenlik timeout'u: ilk yükleme bu süre içinde tamamlanmazsa spinner'ı kes.
  useEffect(() => {
    if (!enabled) return
    const timer = setTimeout(() => {
      if (!initialLoadedRef.current) {
        setLoading(false)
        setLoadError(true)
      }
    }, timeoutMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, timeoutMs])

  // Polling: yalnız authenticated+email iken, arka planda (loading'e dokunmadan).
  useEffect(() => {
    if (!enabled || !pollMs) return
    if (status !== "authenticated" || !email) return
    const interval = setInterval(() => {
      Promise.resolve(fetchFnRef.current()).catch((err) => {
        console.error("[useAuthenticatedData] polling hatası:", err)
      })
    }, pollMs)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, pollMs, status, email])

  const retry = useCallback(() => {
    setLoadError(false)
    setLoading(true)
    initialLoadedRef.current = false
    setReloadTick((t) => t + 1)
  }, [])

  return { loading, loadError, retry, isAuthenticated }
}
