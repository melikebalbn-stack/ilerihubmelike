"use client"

import { useEffect, useRef, useState } from "react"

/**
 * İnce üst yatay-kaydırma şeridi. Geniş bir tablonun ALT (asıl) `overflow-x-auto`
 * container'ının hemen ÜSTÜNE konur; iki container'ın `scrollLeft`'ini çift yönlü
 * senkronlar. Böylece kullanıcı tabloyu görmeden de üstteki şeritle yatay kaydırabilir.
 *
 * - tableWidth alt container'ın `scrollWidth`'inden ResizeObserver + MutationObserver ile alınır
 *   (satır/kolon değişimlerinde de güncel kalır).
 * - Tablo taşmıyorsa (scrollWidth <= clientWidth) şerit gizlenir.
 * - Döngü kilidi: programatik scrollLeft ataması karşı tarafın scroll event'ini tetikler;
 *   `syncing` bayrağı bir rAF penceresi boyunca bu yankıyı yutar (ping-pong engellenir).
 *
 * Kullanım:
 *   const scrollRef = useRef<HTMLDivElement>(null)
 *   <TopScrollbar targetRef={scrollRef} />
 *   <div ref={scrollRef} className="overflow-x-auto">…tablo…</div>
 */
export function TopScrollbar({
  targetRef,
  className = "",
}: {
  targetRef: React.RefObject<HTMLElement | null>
  className?: string
}) {
  const topRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [overflow, setOverflow] = useState(false)
  const syncing = useRef(false)

  useEffect(() => {
    const target = targetRef.current
    const top = topRef.current
    if (!target || !top) return

    const measure = () => {
      setWidth(target.scrollWidth)
      setOverflow(target.scrollWidth - target.clientWidth > 1)
    }
    measure()

    const ro = new ResizeObserver(measure)
    ro.observe(target)
    // İçerik (satır/hücre) değişimlerinde scrollWidth'i tazele.
    const mo = new MutationObserver(measure)
    mo.observe(target, { childList: true, subtree: true, characterData: true })

    // Tek yönde senkron; rAF penceresi boyunca karşı yankı yutulur.
    const sync = (from: HTMLElement, to: HTMLElement) => {
      if (syncing.current) return
      syncing.current = true
      to.scrollLeft = from.scrollLeft
      requestAnimationFrame(() => {
        syncing.current = false
      })
    }
    const onTop = () => sync(top, target)
    const onTarget = () => sync(target, top)
    top.addEventListener("scroll", onTop, { passive: true })
    target.addEventListener("scroll", onTarget, { passive: true })

    return () => {
      ro.disconnect()
      mo.disconnect()
      top.removeEventListener("scroll", onTop)
      target.removeEventListener("scroll", onTarget)
    }
  }, [targetRef])

  return (
    <div
      ref={topRef}
      aria-hidden="true"
      className={`overflow-x-auto sticky top-0 z-20 ${overflow ? "" : "hidden"} ${className}`}
    >
      <div style={{ width, height: 1 }} />
    </div>
  )
}
