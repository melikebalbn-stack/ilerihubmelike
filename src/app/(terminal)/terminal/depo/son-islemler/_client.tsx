'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Loader2, RefreshCw, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TERMINAL_ACCENT } from '../../_shared'
import type { SonIslem } from '@/lib/depo/geri-al'

const fmt = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 4 })
const saatTr = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(new Date(iso))

function ozet(k: SonIslem): string {
  const p: string[] = []
  if (k.partNo && k.partNo !== '-') p.push(k.partNo + (k.lotBatchNo ? ` · lot ${k.lotBatchNo}` : ''))
  if (k.miktar != null) p.push(fmt(k.miktar))
  if (k.kaynakLok || k.hedefLok) p.push(`${k.kaynakLok ?? '—'}${k.hedefLok ? ` → ${k.hedefLok}` : ''}`)
  if (k.orderNo) p.push(`no ${k.orderNo}`)
  return p.join(' · ')
}

export function SonIslemlerClient() {
  const router = useRouter()
  const [kayitlar, setKayitlar] = useState<SonIslem[] | null>(null)
  const [saat, setSaat] = useState(12)
  const [loading, setLoading] = useState(false)
  const [onay, setOnay] = useState<SonIslem | null>(null)
  const [calisiyor, setCalisiyor] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    if (!info) return
    const t = setTimeout(() => setInfo(null), 4000)
    return () => clearTimeout(t)
  }, [info])

  const yukle = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/depo/son-islemler')
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) return setErrorMsg(data?.error ?? 'Liste alınamadı')
      setKayitlar(data.kayitlar as SonIslem[])
      setSaat(Number(data.saat) || 12)
    } catch {
      setErrorMsg('Bağlantı hatası — tekrar deneyin')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void yukle() }, [yukle])

  const geriAl = async () => {
    if (!onay || calisiyor) return
    setCalisiyor(true)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/depo/son-islemler/${onay.id}/geri-al`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setErrorMsg(data?.error ?? 'Geri alınamadı')
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(200)
      } else setInfo(String(data.mesaj ?? 'Geri alındı'))
      setOnay(null)
      await yukle()
    } catch {
      setErrorMsg('Bağlantı hatası — tekrar deneyin')
    } finally {
      setCalisiyor(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-3 py-2">
      <div className="flex items-center gap-2 pt-1">
        <button type="button" onClick={() => router.push('/terminal/depo')} aria-label="Geri" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors active:bg-muted/70">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <h1 className="text-base font-semibold">Son İşlemlerim</h1>
          <span className="text-xs text-muted-foreground">son {saat} saat · yalnız kendi işlemleriniz</span>
        </div>
        <button type="button" onClick={() => void yukle()} aria-label="Yenile" className="flex h-10 w-10 items-center justify-center rounded-xl border"><RefreshCw className="h-4 w-4" /></button>
      </div>

      {errorMsg && <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{errorMsg}</div>}
      {info && <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{info}</div>}

      {loading && !kayitlar && <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Yükleniyor…</div>}
      {kayitlar && kayitlar.length === 0 && <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Son {saat} saatte işlem yok</div>}

      {kayitlar?.map((k) => (
        <div key={k.id} className={cn('flex flex-col gap-1.5 rounded-2xl border bg-card p-3', k.olay === 'GERI_AL' && 'bg-muted/40')}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">{k.olayAdi}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{saatTr(k.createdAt)}</span>
          </div>
          <div className="text-xs text-muted-foreground">{ozet(k)}</div>
          {k.geriAlindi ? (
            <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
              <Check className="h-3.5 w-3.5" /> Geri alındı {saatTr(k.geriAlindi.createdAt)}{k.geriAlindi.mesaj ? ` — ${k.geriAlindi.mesaj}` : ''}
            </div>
          ) : k.durum.uygun ? (
            <button type="button" onClick={() => { setErrorMsg(null); setOnay(k) }}
              className="flex h-10 items-center justify-center gap-2 rounded-xl border border-red-300 text-sm font-semibold text-red-700 active:bg-red-50">
              <Undo2 className="h-4 w-4" /> Geri Al
            </button>
          ) : k.olay !== 'GERI_AL' ? (
            <div className="text-[11px] text-muted-foreground">{k.durum.neden}</div>
          ) : null}
        </div>
      ))}

      {onay && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={() => !calisiyor && setOnay(null)}>
          <div className="w-full max-w-md rounded-2xl bg-background p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-semibold">{onay.olayAdi} geri alınsın mı?</div>
            <div className="mt-1 text-sm text-muted-foreground">{ozet(onay)}</div>
            <div className="mt-2 text-xs text-muted-foreground">İşlemin tersi IFS&apos;e hemen yazılır. Bir işlem yalnız bir kez geri alınabilir.</div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setOnay(null)} disabled={calisiyor} className="h-11 rounded-xl border text-sm font-semibold">Vazgeç</button>
              <button type="button" onClick={() => void geriAl()} disabled={calisiyor}
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 text-sm font-semibold text-white disabled:opacity-50">
                {calisiyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />} GERİ AL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
