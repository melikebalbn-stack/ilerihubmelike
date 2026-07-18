'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Pause, Play, Trash2 } from 'lucide-react'
import type {
  TerminalCanliDurum,
  TerminalIsEmri,
} from '@/lib/uretim/terminal-mock'
import { cn } from '@/lib/utils'
import { OperatorBadge, TERMINAL_ACCENT } from '../../../../_shared'

interface Props {
  operatorName: string
  isEmri: TerminalIsEmri | null
  canli: TerminalCanliDurum
}

// Türkçe sayı (ondalık virgül). 217.9 → "217,9", 88 → "88".
const nf = (n: number) =>
  n.toLocaleString('tr-TR', { maximumFractionDigits: 1 })

// Saniye → "{mm} dk {ss} sn".
function formatMmSs(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${mm} dk ${ss} sn`
}

// Saniye → kompakt duruş süresi ("7 dk", "1 sa 5 dk").
function formatDurus(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const dk = Math.floor(s / 60)
  if (dk < 60) return `${dk} dk`
  return `${Math.floor(dk / 60)} sa ${dk % 60} dk`
}

// ISO → "dd.MM HH:mm" (tz-güvenli, elle).
function formatDateTimeShort(iso: string): string {
  const [datePart, timePart = ''] = iso.split('T')
  const [, m, d] = datePart.split('-')
  return `${d}.${m} ${timePart.slice(0, 5)}`
}

// OEE eşik tonları: >=90 yeşil, 70–90 amber, <70 kırmızı.
function oeeTone(value: number): string {
  if (value >= 90) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (value >= 70) return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-red-200 bg-red-50 text-red-700'
}

const OEE_KARTLARI: { key: keyof TerminalCanliDurum; label: string }[] = [
  { key: 'oee', label: 'OEE' },
  { key: 'performans', label: 'Performans' },
  { key: 'kullanilabilirlik', label: 'Kullanılabilirlik' },
  { key: 'kalite', label: 'Kalite' },
]

export function CanliTakipClient({ operatorName, isEmri, canli }: Props) {
  const router = useRouter()
  // Son sinyal sayacı — 5 sn'de bir artar (canlılık hissi). Diğer mock veriye dokunulmaz.
  const [sonSinyal, setSonSinyal] = useState(canli.sonSinyalSn)
  useEffect(() => {
    const t = setInterval(() => setSonSinyal((s) => s + 5), 5000)
    return () => clearInterval(t)
  }, [])

  // Duruş süresi — mount anında hesaplanır (tick etmez). Wall-clock absürt olursa fallback.
  const [durusSec] = useState(() => {
    if (!canli.durusBaslangic) return 0
    const diff = (Date.now() - Date.parse(canli.durusBaslangic)) / 1000
    return diff > 0 && diff < 86400 ? Math.floor(diff) : 432
  })

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

  const durusta = canli.durum === 'DURUSTA'
  const pct =
    canli.planUretim > 0
      ? Math.round((canli.netUretim / canli.planUretim) * 100)
      : 0
  const cevrimYuksek = canli.ortCevrimSn > canli.planCevrimSn

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      {/* Üst bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col leading-tight">
          <span className="text-base font-semibold">
            İş Emri {isEmri.isEmriNo} / Op {isEmri.operasyonNo} ·{' '}
            {isEmri.operasyon}
          </span>
          <span className="text-xs text-muted-foreground">
            {canli.makine} · {isEmri.stokKodu} {isEmri.stokAdi}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          {/* Durum rozeti */}
          <div
            className={cn(
              'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium',
              durusta
                ? 'bg-amber-100 text-amber-800'
                : 'bg-emerald-100 text-emerald-800',
            )}
          >
            {durusta ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {durusta
              ? `${canli.durusTuru ?? 'Duruş'} · ${formatDurus(durusSec)}`
              : 'Çalışıyor'}
          </div>
          <OperatorBadge name={operatorName} />
        </div>
      </div>

      {/* Üretim bloğu */}
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Net Üretim
            </div>
            <div className="mt-1 text-5xl font-semibold leading-none tabular-nums sm:text-6xl">
              {canli.netUretim}
              <span className="ml-2 text-2xl font-medium text-muted-foreground sm:text-3xl">
                / {canli.planUretim} ad
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              <div className="text-[11px] uppercase tracking-wide">
                Hurda / Rework
              </div>
              <div className="text-2xl font-semibold tabular-nums">
                {canli.hurda} ad
              </div>
            </div>
            <div className="rounded-xl border bg-muted/30 px-4 py-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Son Sinyal
              </div>
              <div className="text-2xl font-semibold tabular-nums">
                {formatMmSs(sonSinyal)}
              </div>
            </div>
          </div>
        </div>

        {/* Tamamlanma progress */}
        <div className="mt-6">
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: TERMINAL_ACCENT }}
            />
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Tamamlanma %{pct} · veri kaynağı: {canli.veriKaynagi}
          </div>
        </div>
      </div>

      {/* Üç metrik kartı */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Ort. Çevrim Süresi
          </div>
          <div
            className={cn(
              'mt-1 text-3xl font-semibold tabular-nums',
              cevrimYuksek && 'text-red-600',
            )}
          >
            {nf(canli.ortCevrimSn)} sn
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Plan: {nf(canli.planCevrimSn)} sn
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Planlı Duruş
          </div>
          <div className="mt-1 text-3xl font-semibold tabular-nums">
            {canli.planliDurusDk} dk
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Plansız: {canli.plansizDurusDk} · Belirsiz: {canli.belirsizDurusDk}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Net Süre
          </div>
          <div className="mt-1 text-3xl font-semibold tabular-nums">
            {canli.netSureDk} dk
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            İş başlangıcı: {formatDateTimeShort(canli.isBaslangic)}
          </div>
        </div>
      </div>

      {/* Dört OEE kartı */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {OEE_KARTLARI.map(({ key, label }) => {
          const value = canli[key] as number
          return (
            <div
              key={key}
              className={cn(
                'rounded-2xl border p-5 text-center',
                oeeTone(value),
              )}
            >
              <div className="text-xs uppercase tracking-wide opacity-80">
                {label}
              </div>
              <div className="mt-1 text-4xl font-semibold tabular-nums">
                %{nf(value)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Alt aksiyon satırı */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() =>
            router.push(`/terminal/uretim/is-emirleri/${isEmri.id}/durus`)
          }
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border bg-card text-base font-medium transition-colors hover:bg-muted active:bg-muted/70"
        >
          <Pause className="h-5 w-5" />
          Duruş Bildir
        </button>
        <button
          type="button"
          onClick={() =>
            router.push(`/terminal/uretim/is-emirleri/${isEmri.id}/hurda`)
          }
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-red-300 text-base font-medium text-red-700 transition-colors hover:bg-red-50 active:bg-red-100"
        >
          <Trash2 className="h-5 w-5" />
          Hurda Bildir
        </button>
        <button
          type="button"
          onClick={() =>
            router.push(`/terminal/uretim/is-emirleri/${isEmri.id}/bitir`)
          }
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-semibold text-white transition-colors hover:bg-emerald-700 active:translate-y-px"
        >
          <Check className="h-5 w-5" />
          İşi Bitir
        </button>
      </div>
    </div>
  )
}
