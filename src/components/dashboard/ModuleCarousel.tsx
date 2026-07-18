'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'

interface CarouselItem {
  id: string
  headline: string
  description: string
  href: string
  image: string | null
  placeholderIcon: string
  placeholderGradient: string
}

const MODULES: CarouselItem[] = [
  {
    id: 'it-destek',
    headline: 'IT Destek',
    description: 'Teknik sorun bildir, talep olustur ve cozum surecini takip et.',
    href: '/it-support',
    image: '/carousel/it-destek.jpg',
    placeholderIcon: '\uD83C\uDFAB',
    placeholderGradient: 'from-teal-100 to-teal-200',
  },
  {
    id: 'tezgah-ariza',
    headline: 'Tezgah Ariza',
    description: 'Makine ve tezgah arizalarini kaydet, bakim ekibini aninda bilgilendir.',
    href: '/maintenance',
    image: '/carousel/tezgah-ariza.jpg',
    placeholderIcon: '\u2699\uFE0F',
    placeholderGradient: 'from-violet-100 to-violet-200',
  },
  {
    id: 'anketler',
    headline: 'Anketler',
    description: 'Memnuniyet anketlerine katil, goruslerini paylas ve sonuclari goruntule.',
    href: '/surveys',
    image: '/carousel/anketler.jpg',
    placeholderIcon: '\uD83D\uDCCB',
    placeholderGradient: 'from-blue-100 to-blue-200',
  },
  {
    id: 'oneri-sistemi',
    headline: 'Oneri Sistemi',
    description: 'Kaizen, NearMiss ve 5S onerilerini kaydet, surec iyilestirmelerine katki sagla.',
    href: '/suggestions',
    image: '/carousel/oneri-sistemi.jpg',
    placeholderIcon: '\uD83D\uDCA1',
    placeholderGradient: 'from-amber-100 to-amber-200',
  },
  {
    id: 'el-terminali',
    headline: 'El Terminali',
    description: 'Depo el terminali \u2014 stok tasima, malzeme toplama ve etiket islemleri.',
    href: '/terminal',
    image: null,
    placeholderIcon: '\uD83D\uDCE6',
    placeholderGradient: 'from-cyan-100 to-cyan-200',
  },
]

export default function ModuleCarousel() {
  const [pos, setPos] = useState(0)
  const [visible, setVisible] = useState(4)
  const touchStartX = useRef(0)

  useEffect(() => {
    const calc = () => {
      if (window.innerWidth < 640) setVisible(1)
      else if (window.innerWidth < 1024) setVisible(2)
      else setVisible(4)
      setPos(0)
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  const maxPos = Math.max(0, MODULES.length - visible)
  const progress = maxPos > 0 ? (pos / maxPos) * 100 : 100

  const go = useCallback((dir: number) => {
    setPos(p => Math.max(0, Math.min(p + dir, maxPos)))
  }, [maxPos])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [go])

  const cardW = `calc(${100 / visible}% - ${(visible - 1) * 16 / visible}px)`

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3">
      <div
        className="overflow-hidden"
        onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
        onTouchEnd={e => {
          const diff = touchStartX.current - e.changedTouches[0].clientX
          if (Math.abs(diff) > 50) go(diff > 0 ? 1 : -1)
        }}
      >
        <div
          className="flex transition-transform duration-[400ms] ease-in-out"
          style={{
            gap: '16px',
            transform: `translateX(calc(-${pos} * (${cardW} + 16px)))`,
          }}
        >
          {MODULES.map(item => (
            <Link
              key={item.id}
              href={item.href}
              className="group flex-shrink-0 block"
              style={{ width: cardW }}
            >
              <div
                className={`relative w-full rounded-lg overflow-hidden mb-2 bg-gradient-to-br ${item.placeholderGradient} transition-all duration-300 group-hover:brightness-95`}
                style={{ aspectRatio: '21/9' }}
              >
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={item.headline}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl opacity-40">{item.placeholderIcon}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />
              </div>

              <h3 className="text-[13px] font-bold text-slate-900 mb-0.5 leading-snug group-hover:underline underline-offset-2 decoration-slate-400">
                {item.headline}
              </h3>
              <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-1">
                {item.description}
              </p>
            </Link>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
        <div className="flex-1 mr-4 h-[3px] bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-600 rounded-full transition-all duration-[400ms]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <button
            onClick={() => go(-1)}
            disabled={pos === 0}
            aria-label="Onceki"
            className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center font-semibold text-slate-600 transition-all duration-150 hover:bg-teal-600 hover:text-white hover:border-teal-600 disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-slate-600 disabled:hover:border-slate-200"
          >&#8249;</button>
          <button
            onClick={() => go(1)}
            disabled={pos >= maxPos}
            aria-label="Sonraki"
            className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center font-semibold text-slate-600 transition-all duration-150 hover:bg-teal-600 hover:text-white hover:border-teal-600 disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-slate-600 disabled:hover:border-slate-200"
          >&#8250;</button>
        </div>
      </div>
    </div>
  )
}
