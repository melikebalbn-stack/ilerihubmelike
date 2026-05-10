'use client'

import { useEffect, useRef, useState } from 'react'

interface VantaEffect {
  destroy: () => void
}

/**
 * Login ekranı için Vanta.js Clouds animasyonu.
 *
 * - Self-hosted (npm three + vanta), CDN değil → CSP dokunulmaz
 * - Lazy loaded (dynamic import), sadece bu component mount olunca
 * - prefers-reduced-motion kontrolü — animasyon istemeyenler için skip
 * - Component unmount'ta destroy() — memory leak yok
 */
export function VantaCloudsBackground() {
  const ref = useRef<HTMLDivElement>(null)
  const [effect, setEffect] = useState<VantaEffect | null>(null)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion || effect || !ref.current) return

    let mounted = true
    let createdEffect: VantaEffect | null = null

    const init = async () => {
      try {
        const THREE = await import('three')
        // @ts-expect-error - vanta paketinin type tanımı yok
        const CLOUDS = (await import('vanta/dist/vanta.clouds.min')).default

        if (!mounted || !ref.current) return

        createdEffect = CLOUDS({
          el: ref.current,
          THREE,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200.0,
          minWidth: 200.0,
          backgroundColor: 0xffffff,
          skyColor: 0x68b8d7,
          cloudColor: 0xadc1de,
          cloudShadowColor: 0x183550,
          sunColor: 0xff9919,
          sunGlareColor: 0xff6633,
          sunlightColor: 0xff9933,
          speed: 1,
        })

        if (mounted) setEffect(createdEffect)
      } catch (err) {
        console.error('[VantaCloudsBackground] Init failed:', err)
      }
    }

    init()

    return () => {
      mounted = false
      createdEffect?.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={ref}
      className="fixed inset-0 z-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  )
}
