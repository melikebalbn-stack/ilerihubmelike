'use client'

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
    id: 'ipro-uretim',
    headline: 'IPRO \u2014 \u00DCretim Takip',
    description: 'Is emri operasyonlarini takip et, uretim bildirimlerini terminalden gir.',
    href: '/terminal/uretim',
    image: '/carousel/ipro-uretim.png',
    placeholderIcon: '\uD83C\uDFED',
    placeholderGradient: 'from-sky-100 to-sky-200',
  },
  {
    id: 'depo-terminal',
    headline: 'Depo El Terminali',
    description: 'Stok tasima, malzeme toplama ve barkod etiket islemlerini yonet.',
    href: '/terminal/depo',
    image: '/carousel/Elterminali.jpg',
    placeholderIcon: '\uD83D\uDCE6',
    placeholderGradient: 'from-cyan-100 to-cyan-200',
  },
]

export default function ModuleCarousel() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {MODULES.map(item => (
          <Link
            key={item.id}
            href={item.href}
            className="group block"
          >
            <div
              className={`relative h-32 w-full rounded-lg overflow-hidden mb-1.5 bg-gradient-to-br ${item.placeholderGradient} transition-all duration-300 group-hover:brightness-95`}
            >
              {item.image ? (
                <Image
                  src={item.image}
                  alt={item.headline}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl opacity-40">{item.placeholderIcon}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />
            </div>

            <h3 className="text-sm font-bold text-slate-900 mb-0.5 leading-snug group-hover:underline underline-offset-2 decoration-slate-400">
              {item.headline}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
              {item.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
