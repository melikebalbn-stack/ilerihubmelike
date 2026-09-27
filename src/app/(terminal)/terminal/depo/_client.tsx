'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowDownUp,
  Boxes,
  Truck,
  Forklift,
  ArrowLeft,
  ClipboardCheck,
  ClipboardList,
  HelpCircle,
  PackageMinus,
  PackageSearch,
  Send,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OperatorBadge, TERMINAL_ACCENT } from '../_shared'
import { yardimBul, type ModulYardim } from './_yardim-icerik'
import { YardimGovde } from './_yardim-govde'

interface Props {
  operatorName: string
}

interface DepoKart {
  label: string
  alt?: string
  Icon: LucideIcon
  href?: string
  yakinda?: boolean
}

const KARTLAR: DepoKart[] = [
  { label: 'Stok Taşıma', alt: 'Raf okut, taşı, etiketle', Icon: ArrowDownUp, href: '/terminal/depo/stok-tasima' },
  { label: 'Malzeme Toplama', alt: 'İş emri okut, FIFO ile topla', Icon: ClipboardList, href: '/terminal/depo/toplama' },
  { label: 'Stok Bilgisi', alt: 'Barkod, stok no ya da lokasyon okut', Icon: PackageSearch, href: '/terminal/depo/stok-bilgisi' },
  { label: 'Taşıma Birimi', alt: 'Palet oluştur, doldur, taşı, aktar', Icon: Boxes, href: '/terminal/depo/tasima-birimi' },
  { label: 'Toplu Taşıma', alt: 'Çok kalemi tek fişle lokasyona taşı', Icon: Forklift, href: '/terminal/depo/toplu-tasima' },
  { label: 'Transfer Talebi', alt: 'Onaylı talebe stok bağla, transfer et', Icon: Send, href: '/terminal/depo/transfer-talebi' },
  { label: 'Sevkiyat', alt: 'Sevkiyat toplama: okut, bitir', Icon: Truck, href: '/terminal/depo/sevkiyat' },
  { label: 'Malzeme Talebi', alt: 'Sarf çıkışı: talep, rezerv, tüket', Icon: PackageMinus, href: '/terminal/depo/malzeme-talebi' },
  { label: 'Sayım', alt: 'Sayım raporu: lokasyon, okut, say', Icon: ClipboardCheck, href: '/terminal/depo/sayim' },
]

export function DepoMenuClient({ operatorName }: Props) {
  const router = useRouter()
  const [yardim, setYardim] = useState<ModulYardim | null>(null)
  // Panel açılınca geçmişe bir kayıt eklenir → cihazın geri tuşu (popstate) sayfadan çıkmak yerine paneli kapatır.
  const gecmisKaydi = useRef(false)

  const yardimAc = (m: ModulYardim) => {
    if (!gecmisKaydi.current) {
      window.history.pushState(null, '', window.location.href)
      gecmisKaydi.current = true
    }
    setYardim(m)
  }
  // Kapat / boşluk / Esc: eklenen geçmiş kaydını geri al; popstate paneli kapatır.
  const yardimKapat = useCallback(() => {
    if (gecmisKaydi.current) window.history.back()
    else setYardim(null)
  }, [])
  useEffect(() => {
    const onPop = () => { gecmisKaydi.current = false; setYardim(null) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  useEffect(() => {
    if (!yardim) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') yardimKapat() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [yardim, yardimKapat])
  // Ekrana Git: panelin geçmiş kaydını modül ekranıyla DEĞİŞTİR → modülden geri dönünce menüye gelinir.
  const ekranaGit = (m: ModulYardim) => {
    gecmisKaydi.current = false
    router.replace(m.href)
  }

  return (
    <div className="flex flex-1 flex-col gap-4 py-2">
      {/* Üst bar — geri + başlık + operatör */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <Link
            href="/terminal"
            aria-label="Terminal menüsüne dön"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors active:bg-muted/70"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-base font-semibold leading-tight">Depo El Terminali</h1>
        </div>
        <OperatorBadge name={operatorName} />
      </div>

      {/* Kartlar */}
      <div className="flex flex-col gap-3">
        {KARTLAR.map(({ label, alt, Icon, href, yakinda }) =>
          yakinda ? (
            <div
              key={label}
              aria-disabled="true"
              className="flex min-h-20 w-full cursor-not-allowed select-none items-center gap-4 rounded-2xl border border-dashed p-4 opacity-50"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Icon className="h-6 w-6" />
              </span>
              <span className="flex-1 text-lg font-medium text-muted-foreground">
                {label}
              </span>
              <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                Yakında
              </span>
            </div>
          ) : (
            <div key={label} className="relative">
              <Link
                href={href!}
                className={cn(
                  'flex min-h-20 w-full items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm transition-all active:translate-y-px active:shadow-none',
                  yardimBul(href) && 'pr-16',
                )}
                style={{ borderColor: TERMINAL_ACCENT }}
              >
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white"
                  style={{ background: TERMINAL_ACCENT }}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <span className="flex flex-1 flex-col leading-tight">
                  <span className="text-lg font-semibold" style={{ color: TERMINAL_ACCENT }}>
                    {label}
                  </span>
                  {alt && <span className="text-xs text-muted-foreground">{alt}</span>}
                </span>
              </Link>
              {/* "?" hızlı yardım — Link'in KARDEŞİ (a içinde buton yok); tıklama kartı açmaz, yalnız paneli açar. */}
              {yardimBul(href) && (
                <button
                  type="button"
                  aria-label={`${label} — nasıl kullanılır?`}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    yardimAc(yardimBul(href)!)
                  }}
                  className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border bg-card transition-colors active:bg-muted/70"
                  style={{ borderColor: TERMINAL_ACCENT, color: TERMINAL_ACCENT }}
                >
                  <HelpCircle className="h-5 w-5" />
                </button>
              )}
            </div>
          ),
        )}
      </div>

      {/* Yardım — kısa tanıtım rehberi (statik) */}
      <Link
        href="/terminal/depo/yardim"
        className="flex min-h-12 items-center justify-center gap-2 rounded-xl border text-sm font-medium text-muted-foreground transition-colors active:bg-muted/70"
      >
        <HelpCircle className="h-4 w-4" />
        Nasıl kullanılır?
      </Link>

      {/* Hızlı yardım paneli (alttan açılır) — boşluğa dokunma, Kapat, Esc ve geri tuşu kapatır. */}
      {yardim && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={yardimKapat}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${yardim.baslik} — nasıl kullanılır`}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-background shadow-lg"
          >
            <div className="flex items-center gap-2.5 border-b p-4">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                style={{ background: TERMINAL_ACCENT }}
              >
                <yardim.Icon className="h-5 w-5" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Nasıl kullanılır
                </span>
                <span className="text-lg font-bold">{yardim.baslik}</span>
              </span>
              <button type="button" onClick={yardimKapat} aria-label="Kapat" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl active:bg-muted/70">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col gap-3 overflow-y-auto p-4">
              <YardimGovde modul={yardim} />
            </div>
            <div className="grid grid-cols-2 gap-2 border-t p-4">
              <button type="button" onClick={yardimKapat} className="min-h-12 rounded-xl border text-base font-semibold">
                Kapat
              </button>
              <button
                type="button"
                onClick={() => ekranaGit(yardim)}
                className="min-h-12 rounded-xl text-base font-semibold text-white active:translate-y-px"
                style={{ background: TERMINAL_ACCENT }}
              >
                Ekrana Git
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
