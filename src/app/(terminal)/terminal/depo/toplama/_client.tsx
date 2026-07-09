'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  Loader2,
  MapPin,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScanner } from '@/lib/depo/use-scanner'
import { TERMINAL_ACCENT } from '../../_shared'
import type { FifoKaynak, IsEmriBaslik, ToplamaSatiri } from '@/lib/ifs/tuketim'

type ToplamaSatirDetay = ToplamaSatiri & { fifo: FifoKaynak[]; stokYok: boolean }

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}.${m}.${y}` : iso
}

export function MalzemeToplamaClient() {
  const router = useRouter()
  const [step, setStep] = useState<'IS_EMRI' | 'LISTE'>('IS_EMRI')
  const [baslik, setBaslik] = useState<IsEmriBaslik | null>(null)
  const [satirlar, setSatirlar] = useState<ToplamaSatirDetay[]>([])
  const [loading, setLoading] = useState(false)

  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [errorKey, setErrorKey] = useState(0)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualVal, setManualVal] = useState('')

  const showError = useCallback((msg: string) => {
    setErrorMsg(msg)
    setErrorKey((k) => k + 1)
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(200)
  }, [])
  useEffect(() => {
    if (!errorMsg) return
    const t = setTimeout(() => setErrorMsg(null), 2500)
    return () => clearTimeout(t)
  }, [errorKey, errorMsg])

  const isEmriOkut = useCallback(
    async (ham: string) => {
      const v = ham.trim()
      if (!v) return
      setLoading(true)
      try {
        const res = await fetch(`/api/depo/toplama/${encodeURIComponent(v)}`)
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) {
          showError(data?.error ?? `İş emri bulunamadı: ${v}`)
          return
        }
        setBaslik(data.baslik as IsEmriBaslik)
        setSatirlar((data.satirlar ?? []) as ToplamaSatirDetay[])
        setStep('LISTE')
      } catch {
        showError('Bağlantı hatası — tekrar deneyin')
      } finally {
        setLoading(false)
      }
    },
    [showError],
  )

  const { inputProps } = useScanner(step === 'IS_EMRI' && !manualOpen && !loading, isEmriOkut)

  const submitManual = () => {
    isEmriOkut(manualVal)
    setManualVal('')
    setManualOpen(false)
  }

  const reset = () => {
    setStep('IS_EMRI')
    setBaslik(null)
    setSatirlar([])
    setErrorMsg(null)
    setManualOpen(false)
    setManualVal('')
  }

  const tamamlanan = satirlar.filter((s) => s.kalan === 0).length

  return (
    <div className="relative flex flex-1 flex-col gap-3 py-2">
      {step === 'IS_EMRI' && <input {...inputProps} />}

      {errorMsg && (
        <div className="absolute inset-x-0 top-0 z-20 mx-2 flex items-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-base font-semibold text-white shadow-lg">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Üst bar */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => (step === 'LISTE' ? reset() : router.push('/terminal/depo'))}
          aria-label="Geri"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors active:bg-muted/70"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {step === 'IS_EMRI' ? (
          <h1 className="text-base font-semibold">Malzeme Toplama</h1>
        ) : (
          <div className="flex min-w-0 flex-col leading-tight">
            <h1 className="truncate text-base font-semibold">
              İE {baslik?.orderNo} · {baslik?.urunAdi || baslik?.urunKodu}
            </h1>
            <span className="text-xs text-muted-foreground">
              {satirlar.length} kalem · {tamamlanan} toplandı
            </span>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          IFS sorgulanıyor…
        </div>
      )}

      {/* AŞAMA 1 — iş emri okut */}
      {step === 'IS_EMRI' && !loading && (
        <div className="flex flex-col items-center gap-3">
          <div
            className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center"
            style={{ borderColor: TERMINAL_ACCENT, color: TERMINAL_ACCENT }}
          >
            <ClipboardList className="h-12 w-12" />
            <div className="text-lg font-semibold">İş emrini okut</div>
            <div className="text-sm text-muted-foreground">
              Kağıttaki barkodu okut veya no gir
            </div>
          </div>
          {manualOpen ? (
            <div className="flex w-full gap-2">
              <input
                autoFocus
                value={manualVal}
                onChange={(e) => setManualVal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitManual()}
                placeholder="İş emri no (ör. 147)"
                className="h-11 flex-1 rounded-xl border bg-background px-3 text-base outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                type="button"
                onClick={submitManual}
                className="h-11 rounded-xl px-4 text-sm font-semibold text-white"
                style={{ background: TERMINAL_ACCENT }}
              >
                Getir
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setManualOpen(true)}
              className="text-sm text-muted-foreground underline underline-offset-2"
            >
              veya elle gir
            </button>
          )}
        </div>
      )}

      {/* AŞAMA 2 — toplama listesi */}
      {step === 'LISTE' && !loading && (
        <div className="flex flex-col gap-3">
          {satirlar.length === 0 && (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Bu iş emrinde malzeme kalemi yok
            </div>
          )}
          {satirlar.map((s) => (
            <KalemKart key={s.lineItemNo} s={s} />
          ))}
        </div>
      )}
    </div>
  )
}

function KalemKart({ s }: { s: ToplamaSatirDetay }) {
  // Toplandı
  if (s.kalan === 0) {
    return (
      <div className="flex min-h-16 items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-800">
        <Check className="h-6 w-6 shrink-0 text-emerald-600" />
        <div className="min-w-0">
          <div className="font-semibold">{s.partNo}</div>
          <div className="text-sm">{s.gerekli} {s.birim} · toplandı</div>
        </div>
      </div>
    )
  }
  // Stokta yok
  if (s.stokYok) {
    return (
      <div className="flex flex-col gap-1 rounded-2xl border border-red-300 bg-red-50 p-4 text-red-800">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
          <span className="min-w-0 truncate font-semibold">
            {s.partNo}
            {s.partAdi ? ` · ${s.partAdi}` : ''}
          </span>
        </div>
        <div className="text-sm">{s.kalan} {s.birim} gerekli</div>
        <div className="mt-1 text-sm font-semibold">STOKTA YOK — planlamaya bildir</div>
      </div>
    )
  }
  // Açık — FIFO kaynakları
  return (
    <button
      type="button"
      onClick={() => {
        // TODO EL-6b: satır teyit ekranı (raf okut → miktar → reserve+issue)
      }}
      className="flex w-full flex-col gap-2 rounded-2xl border bg-card p-4 text-left transition-opacity active:opacity-70"
      style={{ borderColor: TERMINAL_ACCENT }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 font-semibold">{s.partNo}</span>
        <span className="shrink-0 text-sm font-semibold" style={{ color: TERMINAL_ACCENT }}>
          {s.kalan} {s.birim}
        </span>
      </div>
      {s.partAdi && <div className="truncate text-xs text-muted-foreground">{s.partAdi}</div>}

      <div className="mt-1 flex flex-col gap-2">
        {s.fifo.map((k, i) => (
          <div key={`${k.locationNo}-${k.lotBatchNo ?? '_'}-${i}`} className="rounded-xl bg-muted/50 p-3">
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                GİT →
              </span>
              <span className="flex items-baseline gap-1">
                <MapPin className="h-4 w-4 self-center" style={{ color: TERMINAL_ACCENT }} />
                <span className="text-lg font-semibold" style={{ color: TERMINAL_ACCENT }}>
                  {k.lokasyonAdi}
                </span>
                <span className="text-xs text-muted-foreground">({k.locationNo})</span>
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-sm">
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">
                {k.alinacak} {s.birim}
              </span>
              {k.lotBatchNo && <span className="text-muted-foreground"> · lot {k.lotBatchNo}</span>}
              <span className="text-muted-foreground"> · giriş {fmtDate(k.receiptDate)}</span>
            </div>
          </div>
        ))}
      </div>
    </button>
  )
}
