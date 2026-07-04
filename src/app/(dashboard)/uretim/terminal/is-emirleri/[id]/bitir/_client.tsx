'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Check, Trash2 } from 'lucide-react'
import type {
  TerminalCanliDurum,
  TerminalIsEmri,
} from '@/lib/uretim/terminal-mock'
import { OperatorBadge } from '../../../_shared'

interface Props {
  operatorName: string
  isEmri: TerminalIsEmri | null
  canli: TerminalCanliDurum
}

export function IsiBitirClient({ operatorName, isEmri, canli }: Props) {
  const router = useRouter()

  if (!isEmri) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 p-10 text-center">
        <p className="text-base font-medium">İş emri bulunamadı</p>
        <Link
          href="/uretim/terminal/is-emirleri"
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition-colors hover:bg-muted active:bg-muted/70"
        >
          <ArrowLeft className="h-4 w-4" />
          İş emri listesine dön
        </Link>
      </div>
    )
  }

  const canliHref = `/uretim/terminal/is-emirleri/${isEmri.id}/canli`
  const toplamDurus =
    canli.planliDurusDk + canli.plansizDurusDk + canli.belirsizDurusDk
  const toplamSure = canli.netSureDk + toplamDurus
  const raporlanan = canli.netUretim + canli.hurda
  const eksikRapor = raporlanan < canli.planUretim
  const kalan = Math.max(0, canli.planUretim - raporlanan)

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      {/* Üst bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={canliHref}
            aria-label="Canlı ekrana dön"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors hover:bg-muted active:bg-muted/70"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex flex-col leading-tight">
            <span className="text-base font-semibold">İşi Bitir</span>
            <span className="text-xs text-muted-foreground">
              {isEmri.isEmriNo} / Op {isEmri.operasyonNo} · {isEmri.operasyon} ·{' '}
              {operatorName}
            </span>
          </div>
        </div>
        <OperatorBadge name={operatorName} />
      </div>

      {/* İş Özeti */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">İş Özeti</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-700">
            <div className="text-xs uppercase tracking-wide opacity-80">
              Sağlam Üretim
            </div>
            <div className="mt-1 text-4xl font-semibold tabular-nums">
              {canli.netUretim}
            </div>
          </div>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            <div className="text-xs uppercase tracking-wide opacity-80">
              Hurda
            </div>
            <div className="mt-1 text-4xl font-semibold tabular-nums">
              {canli.hurda}
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Toplam Süre
            </div>
            <div className="mt-1 text-4xl font-semibold tabular-nums">
              {toplamSure} dk
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Toplam Duruş
            </div>
            <div className="mt-1 text-4xl font-semibold tabular-nums">
              {toplamDurus} dk
            </div>
          </div>
        </div>
      </div>

      {/* Eksik raporlama uyarısı */}
      {eksikRapor && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            Planlanan {canli.planUretim} adedin {raporlanan}&apos;i raporlandı (
            {canli.netUretim} sağlam + {canli.hurda} hurda). Kalan {kalan} adet
            iş emrinde açık kalacak. Bildirmediğin hurda varsa önce onu kaydet.
          </p>
        </div>
      )}

      {/* Aksiyonlar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() =>
            router.push(`/uretim/terminal/is-emirleri/${isEmri.id}/hurda`)
          }
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border bg-card text-base font-medium transition-colors hover:bg-muted active:bg-muted/70"
        >
          <Trash2 className="h-5 w-5" />
          Hurda Ekle
        </button>
        <button
          type="button"
          onClick={() => {
            // TODO: ReportQuantityComplete entegrasyonu (nested payload) — T3 sonrası
            router.push('/uretim/terminal')
          }}
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-semibold text-white transition-colors hover:bg-emerald-700 active:translate-y-px"
        >
          <Check className="h-5 w-5" />
          Onayla ve İşi Bitir
        </button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Onaylandığında bildirim IFS&apos;e işlenir ve etiket yazdırma ekranı
        açılır
      </p>
    </div>
  )
}
