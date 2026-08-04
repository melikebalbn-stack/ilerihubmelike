'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Maximize, Minimize } from 'lucide-react'

/**
 * Harita iframe'i + TV modu.
 * TAM EKRANA GİREN ELEMAN IFRAME'İN KENDİSİ — sarmalayıcı değil.
 * Sarmalayıcı tam ekrana alınırsa dashboard kabuğu (sol menü, logo, üst çubuk)
 * da ekranda kalır; duvar ekranında istenmeyen budur.
 */
export function HaritaCerceve({ src }: { src: string }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [tam, setTam] = useState(false)

  const ac = useCallback(() => {
    const el = ref.current
    if (!el?.requestFullscreen) return
    el.requestFullscreen().catch((e) => {
      // Sessiz yutma YOK: reddedilirse sebebi görünsün.
      console.warn('Tam ekran reddedildi:', e?.name, e?.message)
    })
  }, [])

  const kapat = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  }, [])

  // ESC/F11 ile çıkılırsa düğme durumu senkron kalsın.
  useEffect(() => {
    const onFs = () => setTam(document.fullscreenElement === ref.current)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  return (
    <div className="relative h-full w-full">
      <iframe
        ref={ref}
        src={src}
        title="Fabrika Haritası"
        allowFullScreen
        className="h-full w-full border-0"
      />
      <button
        type="button"
        onClick={tam ? kapat : ac}
        title={tam ? 'TV modundan çık (ESC)' : 'TV modu — tam ekran'}
        className="absolute right-4 top-4 z-10 flex items-center gap-1.5 rounded-md border border-slate-600/60 bg-slate-900/80 px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider text-slate-300 backdrop-blur transition-colors hover:bg-slate-800 hover:text-slate-100"
      >
        {tam ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
        {tam ? 'Çık' : 'TV Modu'}
      </button>
    </div>
  )
}
