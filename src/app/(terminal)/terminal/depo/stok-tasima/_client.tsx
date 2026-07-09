'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Delete,
  Loader2,
  MapPin,
  Package,
  PackageCheck,
  Printer,
  ScanLine,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseEtiket } from '@/lib/depo/etiket-parse'
import { useScanner } from '@/lib/depo/use-scanner'
import type { DepoRafBilgisi, DepoStokKaydi } from '@/lib/ifs/depo-stok'
import { TERMINAL_ACCENT } from '../../_shared'

type Step = 'KAYNAK_RAF' | 'MALZEME' | 'MIKTAR' | 'HEDEF_RAF' | 'TAMAM'
const STEP_INDEX: Record<Step, number> = { KAYNAK_RAF: 1, MALZEME: 2, MIKTAR: 3, HEDEF_RAF: 4, TAMAM: 4 }

export function StokTasimaClient() {
  const router = useRouter()

  const [step, setStep] = useState<Step>('KAYNAK_RAF')
  const [kaynakRaf, setKaynakRaf] = useState<DepoRafBilgisi | null>(null)
  const [rafStok, setRafStok] = useState<DepoStokKaydi[]>([])
  const [secilenStok, setSecilenStok] = useState<DepoStokKaydi | null>(null)
  const [miktar, setMiktar] = useState('')
  const [hedefRaf, setHedefRaf] = useState<DepoRafBilgisi | null>(null)
  const [loading, setLoading] = useState(false)
  const [tasiniyor, setTasiniyor] = useState(false)
  const [sonucYol, setSonucYol] = useState<'CREATE' | 'UPDATE' | null>(null)
  const [etiketYukleniyor, setEtiketYukleniyor] = useState(false)

  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [errorKey, setErrorKey] = useState(0)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualVal, setManualVal] = useState('')

  const isScanStep = step === 'KAYNAK_RAF' || step === 'MALZEME' || step === 'HEDEF_RAF'

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

  // ── Raf çözümleme (API) ──────────────────────────────────────────
  const cozRafKaynak = useCallback(
    async (kod: string) => {
      setLoading(true)
      try {
        const res = await fetch(`/api/depo/raf/${encodeURIComponent(kod)}/stok`)
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) {
          showError(`Raf bulunamadı: ${kod}`)
          return
        }
        setKaynakRaf(data.raf as DepoRafBilgisi)
        setRafStok((data.stok ?? []) as DepoStokKaydi[])
        setStep('MALZEME')
      } catch {
        showError('Bağlantı hatası — tekrar deneyin')
      } finally {
        setLoading(false)
      }
    },
    [showError],
  )

  const cozRafHedef = useCallback(
    async (kod: string) => {
      setLoading(true)
      try {
        const res = await fetch(`/api/depo/raf/${encodeURIComponent(kod)}`)
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) {
          showError(`Raf bulunamadı: ${kod}`)
          return
        }
        const raf = data.raf as DepoRafBilgisi
        if (raf.locationNo === kaynakRaf?.locationNo) {
          showError('Hedef raf kaynakla aynı olamaz')
          return
        }
        setHedefRaf(raf)
      } catch {
        showError('Bağlantı hatası — tekrar deneyin')
      } finally {
        setLoading(false)
      }
    },
    [showError, kaynakRaf],
  )

  const secStok = (kaydi: DepoStokKaydi) => {
    setSecilenStok(kaydi)
    setMiktar('')
    setStep('MIKTAR')
  }

  // ── Okutma dağıtımı ──────────────────────────────────────────────
  const handleValue = useCallback(
    (raw: string) => {
      const val = raw.trim()
      if (!val) return
      if (step === 'KAYNAK_RAF') return void cozRafKaynak(val)
      if (step === 'HEDEF_RAF') return void cozRafHedef(val)
      if (step === 'MALZEME') {
        const p = parseEtiket(val)
        if (p.tip !== 'MALZEME' || !p.stokKodu) return showError('Malzeme okutun')
        const eslesme = rafStok.find(
          (s) => s.stokKodu === p.stokKodu && (p.lot ? s.lot === p.lot : true),
        )
        if (!eslesme) return showError('Bu malzeme bu rafta görünmüyor')
        secStok(eslesme)
      }
    },
    [step, cozRafKaynak, cozRafHedef, rafStok, showError],
  )

  const { inputProps } = useScanner(isScanStep && !manualOpen && !loading, handleValue)

  const submitManual = () => {
    handleValue(manualVal)
    setManualVal('')
    setManualOpen(false)
  }

  const goBack = () => {
    setErrorMsg(null)
    setManualOpen(false)
    switch (step) {
      case 'KAYNAK_RAF':
        router.push('/terminal/depo')
        break
      case 'MALZEME':
        setKaynakRaf(null)
        setRafStok([])
        setStep('KAYNAK_RAF')
        break
      case 'MIKTAR':
        setSecilenStok(null)
        setMiktar('')
        setStep('MALZEME')
        break
      case 'HEDEF_RAF':
        setHedefRaf(null)
        setStep('MIKTAR')
        break
      default:
        break
    }
  }

  const resetAll = () => {
    setStep('KAYNAK_RAF')
    setKaynakRaf(null)
    setRafStok([])
    setSecilenStok(null)
    setMiktar('')
    setHedefRaf(null)
    setErrorMsg(null)
    setManualOpen(false)
    setSonucYol(null)
    setTasiniyor(false)
  }

  const maxMiktar = secilenStok?.miktar ?? 0
  const miktarNum = Number(miktar || '0')
  const miktarExceed = miktarNum > maxMiktar
  const miktarValid = miktarNum >= 1 && miktarNum <= maxMiktar
  const pressKey = (k: string) => {
    if (k === 'C') return setMiktar('')
    if (k === '⌫') return setMiktar((m) => m.slice(0, -1))
    setMiktar((m) => {
      const next = m === '0' ? k : m + k
      return next.length > 7 ? m : next
    })
  }

  const stoguTasi = async () => {
    // Çifte-dokunma koruması: istek uçuştaysa yok say.
    if (tasiniyor || !secilenStok || !hedefRaf || !kaynakRaf) return
    setTasiniyor(true)
    try {
      const res = await fetch('/api/depo/stok-tasima', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kimlik: secilenStok.kimlik,
          hedefLocationNo: hedefRaf.locationNo,
          miktar: miktarNum,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        // 409'un güncel-miktar mesajı dahil sunucudan geleni göster; adım HEDEF_RAF'ta kalır.
        showError(data?.error ?? 'Taşıma başarısız — tekrar deneyin')
        return
      }
      setSonucYol((data.yol as 'CREATE' | 'UPDATE') ?? null)
      setStep('TAMAM')
    } catch {
      showError('Bağlantı hatası — tekrar deneyin')
    } finally {
      setTasiniyor(false)
    }
  }

  const etiketYazdir = async () => {
    if (etiketYukleniyor || !secilenStok || !kaynakRaf || !hedefRaf) return
    setEtiketYukleniyor(true)
    try {
      const kaynakAd = kaynakRaf.aciklama || kaynakRaf.locationNo
      const hedefAd = hedefRaf.aciklama || hedefRaf.locationNo
      const res = await fetch('/api/depo/etiket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stokKodu: secilenStok.stokKodu,
          stokAdi: secilenStok.stokAdi,
          miktar: miktarNum,
          birim: secilenStok.birim,
          lot: secilenStok.lot,
          girisTarihi: new Date().toISOString().slice(0, 10),
          kaynakBilgi: `Stok Tasima · ${kaynakAd} → ${hedefAd}`,
          lokasyon: hedefAd,
          kaynakModul: 'Depo El Terminali / Stok Tasima',
        }),
      })
      if (!res.ok) {
        showError('Etiket üretilemedi')
        return
      }
      const url = URL.createObjectURL(await res.blob())
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      showError('Etiket üretilemedi')
    } finally {
      setEtiketYukleniyor(false)
    }
  }

  return (
    <div className="relative flex flex-1 flex-col gap-3 py-2">
      {isScanStep && <input {...inputProps} />}

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
          onClick={goBack}
          aria-label="Geri"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors active:bg-muted/70"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-lg font-semibold">Stok Taşıma</h1>
        {step !== 'TAMAM' && (
          <span className="rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {STEP_INDEX[step]}/4
          </span>
        )}
      </div>

      {kaynakRaf && step !== 'TAMAM' && (
        <div className="flex w-fit items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
          <MapPin className="h-4 w-4" />
          Raf: {kaynakRaf.aciklama || kaynakRaf.locationNo} ({kaynakRaf.locationNo})
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          IFS sorgulanıyor…
        </div>
      )}

      {/* KAYNAK_RAF */}
      {step === 'KAYNAK_RAF' && !loading && (
        <ScanPrompt
          icon={<ScanLine className="h-12 w-12" />}
          title="Kaynak rafı okut"
          hint="Rafın etiketini okutun (LocationNo ya da Y1A01 gibi kod)"
          manualOpen={manualOpen}
          manualVal={manualVal}
          setManualVal={setManualVal}
          onManualOpen={() => setManualOpen(true)}
          onManualSubmit={submitManual}
          manualPlaceholder="Raf kodu (ör. 40 veya Y1A01)"
        />
      )}

      {/* MALZEME — raf stok listesi (kart) + okutma */}
      {step === 'MALZEME' && !loading && (
        <div className="flex flex-1 flex-col gap-3">
          <ScanPrompt
            icon={<Package className="h-12 w-12" />}
            title="Malzemeyi okut"
            hint="Etiketi okut ya da aşağıdan seç"
            manualOpen={manualOpen}
            manualVal={manualVal}
            setManualVal={setManualVal}
            onManualOpen={() => setManualOpen(true)}
            onManualSubmit={submitManual}
            manualPlaceholder="Stok kodu (| lot)"
            compact
          />
          <div className="flex flex-col gap-2">
            {rafStok.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Bu rafta taşınabilir stok yok
              </div>
            ) : (
              rafStok.map((s, i) => (
                <button
                  key={`${s.stokKodu}-${s.lot ?? '_'}-${i}`}
                  type="button"
                  onClick={() => secStok(s)}
                  className="flex min-h-14 items-center justify-between gap-3 rounded-xl border bg-card p-3 text-left transition-colors active:bg-muted"
                >
                  <div className="min-w-0">
                    {/* TODO: stokAdi (PartDescription) bu projeksiyonda yok — şimdilik stok kodu */}
                    <div className="font-semibold">{s.stokKodu}</div>
                    {s.lot && <div className="text-xs text-muted-foreground">Lot: {s.lot}</div>}
                  </div>
                  <div className="shrink-0 text-sm font-semibold" style={{ color: TERMINAL_ACCENT }}>
                    {s.miktar} {s.birim}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* MIKTAR */}
      {step === 'MIKTAR' && secilenStok && (
        <div className="flex flex-1 flex-col gap-3">
          <div className="rounded-2xl border bg-card p-4">
            <div className="text-base font-semibold">{secilenStok.stokKodu}</div>
            {secilenStok.lot && <div className="text-xs text-muted-foreground">Lot: {secilenStok.lot}</div>}
            <div className="mt-1 text-sm">
              Taşınabilir:{' '}
              <span className="font-semibold" style={{ color: TERMINAL_ACCENT }}>
                {secilenStok.miktar} {secilenStok.birim}
              </span>
            </div>
          </div>

          <div
            className={cn(
              'rounded-2xl border bg-card py-4 text-center text-5xl font-semibold tabular-nums',
              miktarExceed && 'border-red-400 text-red-600',
            )}
          >
            {miktar || '0'}
            <span className="ml-2 text-2xl text-muted-foreground">{secilenStok.birim}</span>
          </div>
          {miktarExceed && (
            <p className="text-center text-sm font-medium text-red-600">
              En fazla {maxMiktar} {secilenStok.birim} taşınabilir
            </p>
          )}

          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => pressKey(key)}
                className="flex min-h-12 items-center justify-center rounded-xl border bg-card text-2xl font-semibold transition-colors active:bg-muted"
              >
                {key === '⌫' ? <Delete className="h-6 w-6" /> : key}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => miktarValid && setStep('HEDEF_RAF')}
            disabled={!miktarValid}
            className="mt-1 flex min-h-14 items-center justify-center gap-2 rounded-2xl text-lg font-semibold text-white transition-all active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: TERMINAL_ACCENT }}
          >
            Devam
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* HEDEF_RAF */}
      {step === 'HEDEF_RAF' && secilenStok && !loading && (
        <div className="flex flex-1 flex-col gap-3">
          <ScanPrompt
            icon={<MapPin className="h-12 w-12" />}
            title="Hedef rafı okut"
            hint="Malzemenin taşınacağı rafı okutun"
            manualOpen={manualOpen}
            manualVal={manualVal}
            setManualVal={setManualVal}
            onManualOpen={() => setManualOpen(true)}
            onManualSubmit={submitManual}
            manualPlaceholder="Hedef raf kodu"
            compact
          />
          <div className="rounded-2xl border bg-card p-4 text-sm">
            <div className="font-semibold">
              {secilenStok.stokKodu} · {miktar} {secilenStok.birim}
            </div>
            {secilenStok.lot && <div className="text-xs text-muted-foreground">Lot: {secilenStok.lot}</div>}
            <div className="mt-2 flex items-center gap-2 font-medium">
              <span className="rounded-md bg-muted px-2 py-0.5">{kaynakRaf?.locationNo}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span
                className={cn(
                  'rounded-md px-2 py-0.5',
                  hedefRaf ? 'text-white' : 'border border-dashed text-muted-foreground',
                )}
                style={hedefRaf ? { background: TERMINAL_ACCENT } : undefined}
              >
                {hedefRaf ? hedefRaf.locationNo : 'okutun'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={stoguTasi}
            disabled={!hedefRaf || tasiniyor}
            className="mt-auto flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-lg font-semibold text-white transition-all hover:bg-emerald-700 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
          >
            {tasiniyor ? <Loader2 className="h-6 w-6 animate-spin" /> : <PackageCheck className="h-6 w-6" />}
            {tasiniyor ? 'Taşınıyor…' : 'Stoğu Taşı'}
          </button>
        </div>
      )}

      {/* TAMAM — TEST MODU */}
      {step === 'TAMAM' && secilenStok && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Check className="h-11 w-11" />
          </div>
          <div>
            <div className="text-2xl font-semibold">
              {miktar} {secilenStok.birim} · {secilenStok.stokKodu}
            </div>
            <div className="mt-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span className="rounded-md bg-muted px-2 py-0.5">{kaynakRaf?.locationNo}</span>
              <ArrowRight className="h-4 w-4" />
              <span className="rounded-md bg-muted px-2 py-0.5">{hedefRaf?.locationNo}</span>
            </div>
          </div>

          <div className="w-full rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-800">
            {miktar} {secilenStok.birim} taşındı ·{' '}
            {kaynakRaf?.aciklama || kaynakRaf?.locationNo} →{' '}
            {hedefRaf?.aciklama || hedefRaf?.locationNo}
          </div>
          <div className="-mt-2 text-xs text-muted-foreground">
            IFS kaydı: {sonucYol === 'UPDATE' ? 'mevcut satıra eklendi' : 'yeni satır açıldı'}
          </div>

          <div className="mt-1 flex w-full flex-col gap-2">
            <button
              type="button"
              onClick={etiketYazdir}
              disabled={etiketYukleniyor}
              className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border bg-card text-base font-medium transition-colors active:bg-muted/70 disabled:opacity-50"
            >
              {etiketYukleniyor ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Printer className="h-5 w-5" />
              )}
              {etiketYukleniyor ? 'Hazırlanıyor…' : 'Etiket Yazdır'}
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="flex min-h-14 items-center justify-center gap-2 rounded-2xl text-lg font-semibold text-white active:translate-y-px"
              style={{ background: TERMINAL_ACCENT }}
            >
              Yeni Taşıma
            </button>
            <Link
              href="/terminal/depo"
              className="flex min-h-12 items-center justify-center rounded-2xl border text-base font-medium active:bg-muted/70"
            >
              Depo Menüsü
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

interface ScanPromptProps {
  icon: React.ReactNode
  title: string
  hint: string
  manualOpen: boolean
  manualVal: string
  setManualVal: (v: string) => void
  onManualOpen: () => void
  onManualSubmit: () => void
  manualPlaceholder: string
  compact?: boolean
}

function ScanPrompt({
  icon,
  title,
  hint,
  manualOpen,
  manualVal,
  setManualVal,
  onManualOpen,
  onManualSubmit,
  manualPlaceholder,
  compact,
}: ScanPromptProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={cn(
          'flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center',
          compact ? 'py-6' : 'py-10',
        )}
        style={{ borderColor: TERMINAL_ACCENT, color: TERMINAL_ACCENT }}
      >
        {icon}
        <div className="text-lg font-semibold">{title}</div>
        <div className="text-sm text-muted-foreground">{hint}</div>
      </div>

      {manualOpen ? (
        <div className="flex w-full gap-2">
          <input
            autoFocus
            value={manualVal}
            onChange={(e) => setManualVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onManualSubmit()}
            placeholder={manualPlaceholder}
            className="h-11 flex-1 rounded-xl border bg-background px-3 text-base outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="button"
            onClick={onManualSubmit}
            className="h-11 rounded-xl px-4 text-sm font-semibold text-white"
            style={{ background: TERMINAL_ACCENT }}
          >
            Onayla
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onManualOpen}
          className="text-sm text-muted-foreground underline underline-offset-2"
        >
          veya elle gir
        </button>
      )}
    </div>
  )
}
