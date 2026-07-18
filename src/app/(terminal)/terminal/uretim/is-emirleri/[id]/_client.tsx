'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowLeft, Package, Play, RefreshCw } from 'lucide-react'
import type { TerminalIsEmri } from '@/lib/uretim/terminal-mock'
import { OperatorBadge, TERMINAL_ACCENT } from '../../../_shared'

interface Props {
  operatorName: string
  isEmri: TerminalIsEmri | null
  /** IFS okuma hatası (varsa). */
  error?: string | null
}

function formatTeslim(iso: string): string {
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}.${m}.${y}` : iso
}

export function IsEmriDetayClient({ operatorName, isEmri, error }: Props) {
  const router = useRouter()

  // IFS hatası — kırmızı hata kutusu + yeniden dene.
  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-3 p-6">
        <Link
          href="/terminal/uretim/is-emirleri"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          İş emri listesine dön
        </Link>
        <div className="flex w-full flex-col items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-6 text-red-700">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-5 w-5" />
            İş emri IFS&apos;ten alınamadı
          </div>
          <p className="max-w-full break-all text-sm text-red-700/90">{error}</p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 active:translate-y-px"
          >
            <RefreshCw className="h-4 w-4" />
            Yeniden Dene
          </button>
        </div>
      </div>
    )
  }

  // Kayıt yoksa — bulunamadı ekranı + geri butonu.
  if (!isEmri) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 p-10 text-center">
        <p className="text-base font-medium">İş emri bulunamadı</p>
        <Link
          href="/terminal/uretim/is-emirleri"
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition-colors hover:bg-muted active:bg-muted/70"
        >
          <ArrowLeft className="h-4 w-4" />
          İş emri listesine dön
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      {/* Üst bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/terminal/uretim/is-emirleri"
            aria-label="İş emri listesine dön"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors hover:bg-muted active:bg-muted/70"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex flex-col leading-tight">
            <span className="text-base font-semibold">
              İş Emri {isEmri.isEmriNo}
            </span>
            <span className="text-xs text-muted-foreground">
              {isEmri.isMerkezi} · {isEmri.operasyon}
            </span>
          </div>
        </div>
        <OperatorBadge name={operatorName} />
      </div>

      {/* Bilgi kartları */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Stok — iki kolon */}
        <div className="flex flex-col gap-1 rounded-2xl border bg-card p-5 sm:col-span-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Package className="h-4 w-4" />
            Stok
          </div>
          <div className="text-lg font-semibold">{isEmri.stokKodu}</div>
          <div className="text-sm text-muted-foreground">{isEmri.stokAdi}</div>
        </div>

        {/* Planlanan Miktar */}
        <div className="flex flex-col gap-1 rounded-2xl border bg-card p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Planlanan Miktar
          </div>
          <div className="text-4xl font-semibold leading-tight tabular-nums">
            {isEmri.miktar}
          </div>
        </div>

        {/* Kalan Miktar */}
        <div className="flex flex-col gap-1 rounded-2xl border bg-card p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Kalan Miktar
          </div>
          <div className="text-4xl font-semibold leading-tight tabular-nums">
            {isEmri.kalanMiktar}
          </div>
        </div>

        {/* Teslim Tarihi */}
        <div className="flex flex-col gap-1 rounded-2xl border bg-card p-5 sm:col-span-2 lg:col-span-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Teslim Tarihi
          </div>
          <div className="text-2xl font-semibold tabular-nums">
            {formatTeslim(isEmri.teslimTarihi)}
          </div>
        </div>
      </div>

      {/* İşi Başlat */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() =>
            router.push(`/terminal/uretim/is-emirleri/${isEmri.id}/canli`)
          }
          className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 text-lg font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:translate-y-px"
        >
          <Play className="h-6 w-6" />
          İşi Başlat
        </button>
        <p className="text-center text-xs text-muted-foreground">
          İş başladığında üretim adedi makineden otomatik sayılır
        </p>
      </div>
    </div>
  )
}
