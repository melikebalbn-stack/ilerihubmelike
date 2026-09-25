'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronDown, ChevronUp, Loader2, RefreshCw, ScanLine, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScanner } from '@/lib/depo/use-scanner'
import type { EtiketKaynak } from '@/lib/depo/etiket-parse'
import { TERMINAL_ACCENT } from '../../_shared'
import type { DegerListeleri, StokBilgisiSatir, StokBilgisiSonuc } from '@/lib/ifs/stok-bilgisi'

type Okut = { deger: string; kaynak: EtiketKaynak }
type Filtre = { ambar: string; stokAdi: string; lot: string; seri: string; tasimaBirimi: string; proje: string }
const BOS_FILTRE: Filtre = { ambar: '', stokAdi: '', lot: '', seri: '', tasimaBirimi: '', proje: '' }

const fmt = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 3 })
// IFS'te boş anahtar değerleri '*' ya da 0 → ekranda '—'.
const tire = (v: string | number) => (v === '' || v === '*' || v === 0 ? '—' : String(v))

export function StokBilgisiClient() {
  const router = useRouter()
  const [okut, setOkut] = useState<Okut | null>(null)
  const [filtre, setFiltre] = useState<Filtre>(BOS_FILTRE)
  const [filtreAcik, setFiltreAcik] = useState(false)
  const [listeler, setListeler] = useState<DegerListeleri>({ ambarlar: [], projeler: [] })
  const [sonuc, setSonuc] = useState<StokBilgisiSonuc | null>(null)
  const [sayfa, setSayfa] = useState(0)
  const [loading, setLoading] = useState(false)
  const [dahaYukleniyor, setDahaYukleniyor] = useState(false)
  const [acikKart, setAcikKart] = useState<number | null>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualVal, setManualVal] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [errorKey, setErrorKey] = useState(0)

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

  // Açılır listeler bir kez (ambar + proje; proje boşsa alan gizli).
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/depo/stok-bilgisi/listeler')
        const data = await res.json().catch(() => null)
        if (res.ok && data?.ok) setListeler({ ambarlar: data.ambarlar ?? [], projeler: data.projeler ?? [] })
      } catch { /* listeler opsiyonel — filtre metinle de çalışır */ }
    })()
  }, [])

  const ara = useCallback(
    async (o: Okut | null, f: Filtre, s = 0) => {
      const hicbiri = !o && Object.values(f).every((v) => !v.trim())
      if (hicbiri) {
        showError('Okutun ya da en az bir filtre girin')
        return
      }
      if (s === 0) setLoading(true)
      else setDahaYukleniyor(true)
      try {
        const p = new URLSearchParams({ sayfa: String(s) })
        if (o) { p.set('okut', o.deger); p.set('kaynak', o.kaynak) }
        for (const [k, v] of Object.entries(f)) if (v.trim()) p.set(k, v.trim())
        const res = await fetch(`/api/depo/stok-bilgisi?${p.toString()}`)
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) {
          showError(data?.error ?? 'Stok bilgisi alınamadı')
          return
        }
        const yeni = data as StokBilgisiSonuc
        if (o && yeni.cozum === null) {
          showError(`Bulunamadı: ${o.deger} (barkod / stok no / lokasyon)`)
          setOkut(null)
          return
        }
        setSonuc((prev) => (s > 0 && prev ? { ...prev, satirlar: [...prev.satirlar, ...yeni.satirlar] } : yeni))
        setSayfa(s)
        if (s === 0) setAcikKart(null)
      } catch {
        showError('Bağlantı hatası — tekrar deneyin')
      } finally {
        setLoading(false)
        setDahaYukleniyor(false)
      }
    },
    [showError],
  )

  const okutVeAra = useCallback(
    (deger: string, kaynak: EtiketKaynak) => {
      const v = deger.trim()
      if (!v) return
      const o = { deger: v, kaynak }
      setOkut(o)
      void ara(o, filtre)
    },
    [ara, filtre],
  )

  const { inputProps } = useScanner(!manualOpen && !filtreAcik && !loading, (v) => okutVeAra(v, 'okutma'))

  const submitManual = () => {
    const v = manualVal.trim()
    if (!v) return
    setManualVal('')
    setManualOpen(false)
    okutVeAra(v, 'elle')
  }

  const temizle = () => {
    setOkut(null)
    setFiltre(BOS_FILTRE)
    setSonuc(null)
    setAcikKart(null)
  }

  const setF = (k: keyof Filtre) => (v: string) => setFiltre((f) => ({ ...f, [k]: v }))
  const cozum = sonuc?.cozum
  const kalan = sonuc ? sonuc.toplam - sonuc.satirlar.length : 0

  return (
    <div className="flex flex-1 flex-col gap-3 py-2">
      <input {...inputProps} />

      {/* Üst bar */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => router.push('/terminal/depo')}
          aria-label="Geri"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors active:bg-muted/70"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-col leading-tight">
          <h1 className="text-base font-semibold">Stok Bilgisi</h1>
          {sonuc && sonuc.toplam > 0 && (
            <span className="truncate text-xs text-muted-foreground">
              {sonuc.toplam} satır
              {sonuc.tekParca && ` · toplam kullanılabilir ${fmt(sonuc.tekParca.kullanilabilir)} ${sonuc.tekParca.birim}`}
            </span>
          )}
        </div>
      </div>

      {errorMsg && (
        <div key={errorKey} className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {errorMsg}
        </div>
      )}

      {/* Okutma şeridi + elle giriş */}
      <div
        className="flex items-center gap-3 rounded-2xl border p-3"
        style={{ borderColor: TERMINAL_ACCENT, background: `${TERMINAL_ACCENT}0D` }}
      >
        <ScanLine className="h-6 w-6 shrink-0" style={{ color: TERMINAL_ACCENT }} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-sm font-semibold" style={{ color: TERMINAL_ACCENT }}>Barkod, stok no veya lokasyon okut</div>
          <div className="truncate text-xs text-muted-foreground">stoktaki tüm satırlar listelenir</div>
        </div>
      </div>
      {manualOpen ? (
        <div className="flex w-full gap-2">
          <input
            autoFocus
            value={manualVal}
            onChange={(e) => setManualVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitManual()}
            placeholder="Stok no ya da lokasyon"
            className="h-11 flex-1 rounded-xl border bg-background px-3 text-base outline-none focus:ring-1 focus:ring-ring"
          />
          <button type="button" onClick={submitManual} className="h-11 rounded-xl px-4 text-sm font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>
            Getir
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setManualOpen(true)} className="self-center text-sm text-muted-foreground underline underline-offset-2">
          veya elle gir
        </button>
      )}

      {/* Aktif okutma çözümü */}
      {okut && cozum && (
        <div className="flex items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2 text-sm">
          <span className="min-w-0 truncate">
            {cozum.tip === 'barkod' && cozum.barkod
              ? `Barkod ${cozum.deger} → ${cozum.barkod.partNo}${cozum.barkod.lotBatchNo !== '*' ? ` · lot ${cozum.barkod.lotBatchNo}` : ''}`
              : cozum.tip === 'parca'
                ? `Stok no: ${cozum.deger}`
                : `Lokasyon: ${cozum.deger}`}
          </span>
          <button type="button" onClick={temizle} aria-label="Temizle" className="shrink-0 text-muted-foreground active:opacity-60">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Daha fazla filtre */}
      <button
        type="button"
        onClick={() => setFiltreAcik((a) => !a)}
        className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border text-sm font-medium text-muted-foreground transition-colors active:bg-muted/70"
      >
        {filtreAcik ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        Daha fazla filtre
      </button>
      {filtreAcik && (
        <div className="flex flex-col gap-2 rounded-2xl border p-3">
          {listeler.ambarlar.length > 0 ? (
            <Alan etiket="Ambar">
              <select value={filtre.ambar} onChange={(e) => setF('ambar')(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-2 text-base">
                <option value="">Tümü</option>
                {listeler.ambarlar.map((a) => <option key={a.id} value={a.id}>{a.id === a.ad ? a.id : `${a.id} · ${a.ad}`}</option>)}
              </select>
            </Alan>
          ) : (
            <MetinAlan etiket="Ambar" value={filtre.ambar} onChange={setF('ambar')} />
          )}
          <MetinAlan etiket="Stok Adı" value={filtre.stokAdi} onChange={setF('stokAdi')} placeholder="içinde geçen" />
          <MetinAlan etiket="Lot" value={filtre.lot} onChange={setF('lot')} />
          <MetinAlan etiket="Seri" value={filtre.seri} onChange={setF('seri')} />
          <MetinAlan etiket="Taşıma Birimi" value={filtre.tasimaBirimi} onChange={setF('tasimaBirimi')} inputMode="numeric" />
          {listeler.projeler.length > 0 && (
            <Alan etiket="Proje">
              <select value={filtre.proje} onChange={(e) => setF('proje')(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-2 text-base">
                <option value="">Tümü</option>
                {listeler.projeler.map((p) => <option key={p.id} value={p.id}>{p.id === p.ad ? p.id : `${p.id} · ${p.ad}`}</option>)}
              </select>
            </Alan>
          )}
          <div className="mt-1 flex gap-2">
            <button type="button" onClick={temizle} className="h-11 flex-1 rounded-xl border text-sm font-semibold text-muted-foreground active:bg-muted/70">
              Temizle
            </button>
            <button
              type="button"
              onClick={() => { setFiltreAcik(false); void ara(okut, filtre) }}
              className="flex h-11 flex-[2] items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: TERMINAL_ACCENT }}
            >
              <Search className="h-4 w-4" /> ARA
            </button>
          </div>
        </div>
      )}

      {/* Sonuçlar */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> IFS&apos;ten okunuyor…
        </div>
      ) : sonuc && sonuc.toplam === 0 ? (
        <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {cozum?.tip === 'barkod' ? 'Barkod çözüldü ama stokta satır yok' : 'Filtreye uyan stok yok'}
        </div>
      ) : sonuc ? (
        <div className="flex flex-col gap-2">
          {sonuc.satirlar.map((s, i) => (
            <StokKart key={i} s={s} acik={acikKart === i} onToggle={() => setAcikKart((a) => (a === i ? null : i))} />
          ))}
          {kalan > 0 && (
            <button
              type="button"
              onClick={() => void ara(okut, filtre, sayfa + 1)}
              disabled={dahaYukleniyor}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border text-sm font-semibold transition-colors active:bg-muted/70 disabled:opacity-50"
              style={{ color: TERMINAL_ACCENT, borderColor: TERMINAL_ACCENT }}
            >
              {dahaYukleniyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Daha fazla göster ({kalan})
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}

function Alan({ etiket, children }: { etiket: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{etiket}</span>
      {children}
    </label>
  )
}

function MetinAlan({ etiket, value, onChange, placeholder, inputMode }: {
  etiket: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  inputMode?: 'numeric'
}) {
  return (
    <Alan etiket={etiket}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="h-10 w-full rounded-lg border bg-background px-3 text-base outline-none focus:ring-1 focus:ring-ring"
      />
    </Alan>
  )
}

function StokKart({ s, acik, onToggle }: { s: StokBilgisiSatir; acik: boolean; onToggle: () => void }) {
  const bos = s.kullanilabilir <= 0
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn('flex w-full flex-col gap-2 rounded-2xl border bg-card p-4 text-left transition-opacity active:opacity-70', bos && 'bg-muted/40')}
      style={bos ? undefined : { borderColor: TERMINAL_ACCENT }}
    >
      <div className="min-w-0">
        <div className="font-semibold">{s.partNo}</div>
        <div className="truncate text-xs text-muted-foreground">{s.partAdi}</div>
      </div>
      <div className="text-sm">
        {s.ambar} · {s.lokasyonNo}
        {s.lokasyonAdi && <span className="text-muted-foreground"> ({s.lokasyonAdi})</span>}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Miktar etiket="Eldeki" deger={s.eldeki} birim={s.birim} />
        <Miktar etiket="Rezerve" deger={s.rezerve} birim={s.birim} />
        <Miktar etiket="Kullanılabilir" deger={s.kullanilabilir} birim={s.birim} vurgu={!bos} soluk={bos} />
      </div>
      {acik && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 border-t pt-2 text-xs">
          <Detay e="Lot" d={tire(s.lot)} />
          <Detay e="Seri" d={tire(s.seri)} />
          <Detay e="Taşıma Birimi" d={tire(s.tasimaBirimi)} />
          <Detay e="Konfig." d={tire(s.konfigurasyon)} />
          <Detay e="Koşul Kodu" d={tire(s.kosulKodu)} />
          <Detay e="Müh. Seviye" d={tire(s.muhSeviye)} />
          <Detay e="Aktivite" d={tire(s.aktiviteSira)} />
          <Detay e="Kullanılabilirlik" d={tire(s.kullanilabilirlikKontrolu)} />
          <Detay e="Proje" d={tire(s.proje)} />
        </dl>
      )}
    </button>
  )
}

function Miktar({ etiket, deger, birim, vurgu, soluk }: { etiket: string; deger: number; birim: string; vurgu?: boolean; soluk?: boolean }) {
  return (
    <div className={cn('rounded-lg border px-1 py-1.5', soluk && 'text-muted-foreground')}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{etiket}</div>
      <div className="text-sm font-semibold" style={vurgu ? { color: TERMINAL_ACCENT } : undefined}>
        {fmt(deger)} <span className="text-xs font-normal">{birim}</span>
      </div>
    </div>
  )
}

function Detay({ e, d }: { e: string; d: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{e}</dt>
      <dd className="truncate font-medium">{d}</dd>
    </>
  )
}
