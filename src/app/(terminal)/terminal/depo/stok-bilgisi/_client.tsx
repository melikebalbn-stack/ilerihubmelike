'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDownUp, ArrowLeft, Boxes, ChevronDown, ChevronUp, Loader2, MapPin, RefreshCw, ScanLine, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScanner } from '@/lib/depo/use-scanner'
import { miktarOku, rezerveMesaji } from '@/lib/depo/miktar'
import type { EtiketKaynak } from '@/lib/depo/etiket-parse'
import { TERMINAL_ACCENT } from '../../_shared'
import type { DegerListeleri, StokBilgisiSatir, StokBilgisiSonuc } from '@/lib/ifs/stok-bilgisi'
import type { DepoRafBilgisi, DepoStokKaydi, RafOnerisi } from '@/lib/ifs/depo-stok'

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
  const [info, setInfo] = useState<string | null>(null)
  // Karttan taşıma paneli (alttan açılır).
  const [tasiSatir, setTasiSatir] = useState<StokBilgisiSatir | null>(null)

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
  useEffect(() => {
    if (!info) return
    const t = setTimeout(() => setInfo(null), 3000)
    return () => clearTimeout(t)
  }, [info])

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

  const { inputProps } = useScanner(!manualOpen && !filtreAcik && !loading && !tasiSatir, (v) => okutVeAra(v, 'okutma'))

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
      {info && <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{info}</div>}

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
            <StokKart
              key={i}
              s={s}
              acik={acikKart === i}
              onToggle={() => setAcikKart((a) => (a === i ? null : i))}
              onTasi={() => setTasiSatir(s)}
              onPalet={() => router.push(`/terminal/depo/tasima-birimi?palet=${s.tasimaBirimi}`)}
            />
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

      {tasiSatir && (
        <TasiPanel
          s={tasiSatir}
          onKapat={() => setTasiSatir(null)}
          onBasari={(mesaj) => {
            setTasiSatir(null)
            setInfo(mesaj)
            void ara(okut, filtre, 0)
          }}
        />
      )}
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

function StokKart({ s, acik, onToggle, onTasi, onPalet }: {
  s: StokBilgisiSatir
  acik: boolean
  onToggle: () => void
  onTasi: () => void
  onPalet: () => void
}) {
  const bos = s.kullanilabilir <= 0
  return (
    <div
      className={cn('flex w-full flex-col gap-3 rounded-2xl border bg-card p-4', bos && 'bg-muted/40')}
      style={bos ? undefined : { borderColor: TERMINAL_ACCENT }}
    >
    <button type="button" onClick={onToggle} className="flex w-full flex-col gap-2 text-left transition-opacity active:opacity-70">
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
    {/* Karttan taşıma: palete bağlı satır → Taşıma Birimi (bütün palet); kullanılabilir 0 → pasif + neden. */}
    {s.tasimaBirimi > 0 ? (
      <button type="button" onClick={onPalet} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border text-sm font-semibold active:bg-muted/70" style={{ borderColor: TERMINAL_ACCENT, color: TERMINAL_ACCENT }}>
        <Boxes className="h-4 w-4" /> Palet Taşı&apos;ya git (palet {s.tasimaBirimi})
      </button>
    ) : (
      <div className="flex flex-col gap-1">
        <button type="button" onClick={onTasi} disabled={bos} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white active:translate-y-px disabled:opacity-40" style={{ background: TERMINAL_ACCENT }}>
          <ArrowDownUp className="h-4 w-4" /> TAŞI
        </button>
        {bos && <div className="text-center text-xs text-muted-foreground">{s.eldeki > 0 && s.rezerve > 0 ? 'Tamamı rezerve' : 'Stok yok'}</div>}
      </div>
    )}
    </div>
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

// ── Karttan taşıma paneli ────────────────────────────────────────────────────

const gunAy = (iso: string | null) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}` : '')
const yildiz = (v: string) => v || '*'
/** Stok Bilgisi satırı ↔ raftaki stok kaydı (Stok Taşıma kimliği) — 10 anahtar (contract hariç, raf zaten aynı). */
const ayniKimlik = (s: StokBilgisiSatir, k: DepoStokKaydi) =>
  k.kimlik.partNo === s.partNo && k.kimlik.locationNo === s.lokasyonNo && k.kimlik.lotBatchNo === yildiz(s.lot) &&
  k.kimlik.serialNo === yildiz(s.seri) && k.kimlik.engChgLevel === yildiz(s.muhSeviye) && k.kimlik.waivDevRejNo === yildiz(s.waivDevRejNo) &&
  k.kimlik.configurationId === yildiz(s.konfigurasyon) && k.kimlik.activitySeq === s.aktiviteSira && k.kimlik.handlingUnitId === s.tasimaBirimi

/**
 * Alttan açılan taşıma paneli (hızlı yardım paneli deseni: boşluk / Kapat / Esc / geri tuşu kapatır).
 * Hedef raf: öneri kartı (son giriş, kaynak hariç) + okutma / elle giriş — hedef çözümü yalnız raf arar (barkod yok).
 * Taşıma: Stok Taşıma'nın mevcut /api/depo/stok-tasima ucu (IFS'ten taze doğrulama + STOK_TASIMA logu).
 */
function TasiPanel({ s, onKapat, onBasari }: { s: StokBilgisiSatir; onKapat: () => void; onBasari: (mesaj: string) => void }) {
  const [miktar, setMiktar] = useState(String(s.kullanilabilir).replace('.', ','))
  const [hedef, setHedef] = useState<DepoRafBilgisi | null>(null)
  const [oneri, setOneri] = useState<RafOnerisi | null>(null)
  const [elleAcik, setElleAcik] = useState(false)
  const [elleVal, setElleVal] = useState('')
  // Miktar alanı odaktayken okutucu gizli input'a odak çekmesin.
  const [miktarOdak, setMiktarOdak] = useState(false)
  const [calisiyor, setCalisiyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const gecmisKaydi = useRef(false)

  // Geri tuşu paneli kapatsın: açılışta geçmişe kayıt; popstate kapatır.
  useEffect(() => {
    window.history.pushState(null, '', window.location.href)
    gecmisKaydi.current = true
    const onPop = () => { gecmisKaydi.current = false; onKapat() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') kapat() }
    window.addEventListener('popstate', onPop)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('keydown', onKey) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const kapat = () => { if (gecmisKaydi.current) window.history.back(); else onKapat() }
  const basariylaKapat = (mesaj: string) => {
    if (gecmisKaydi.current) { gecmisKaydi.current = false; window.history.back() }
    onBasari(mesaj)
  }

  // Hedef raf önerisi — hata/yoksa gizli.
  useEffect(() => {
    let iptal = false
    void (async () => {
      try {
        const res = await fetch(`/api/depo/raf-oneri?${new URLSearchParams({ partNo: s.partNo, kaynak: s.lokasyonNo }).toString()}`)
        const data = await res.json().catch(() => null)
        if (!iptal && res.ok && data?.ok) setOneri((data.oneri ?? null) as RafOnerisi | null)
      } catch { /* öneri opsiyonel */ }
    })()
    return () => { iptal = true }
  }, [s.partNo, s.lokasyonNo])

  const hedefCoz = async (kod: string) => {
    const v = kod.trim()
    if (!v) return
    setHata(null)
    setCalisiyor(true)
    try {
      const res = await fetch(`/api/depo/raf/${encodeURIComponent(v)}`)
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) return setHata(`Raf bulunamadı: ${v}`)
      const raf = data.raf as DepoRafBilgisi
      if (raf.locationNo === s.lokasyonNo) return setHata('Hedef raf kaynakla aynı olamaz')
      setHedef(raf)
      setElleAcik(false)
      setElleVal('')
    } catch {
      setHata('Bağlantı hatası — tekrar deneyin')
    } finally {
      setCalisiyor(false)
    }
  }
  const { inputProps } = useScanner(!elleAcik && !miktarOdak && !calisiyor, (v) => void hedefCoz(v))

  const tasi = async () => {
    if (!hedef || calisiyor) return
    const m = miktarOku(miktar)
    if (m == null || !(m > 0)) return setHata('Geçerli bir miktar girin (en fazla 4 ondalık)')
    if (m > s.kullanilabilir) return setHata(rezerveMesaji(s.kullanilabilir, s.rezerve, s.birim))
    setHata(null)
    setCalisiyor(true)
    try {
      // Stok Taşıma kimliği (contract dahil) raftaki stoktan — sunucu yine IFS'ten taze doğrular.
      const r = await fetch(`/api/depo/raf/${encodeURIComponent(s.lokasyonNo)}/stok`)
      const rd = await r.json().catch(() => null)
      const kayit = r.ok && rd?.ok ? ((rd.stok ?? []) as DepoStokKaydi[]).find((k) => ayniKimlik(s, k)) : undefined
      if (!kayit) return setHata('Kaynak stok satırı rafta bulunamadı — listeyi yenileyin')
      const res = await fetch('/api/depo/stok-tasima', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kimlik: kayit.kimlik, hedefLocationNo: hedef.locationNo, miktar: m }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) return setHata(data?.error ?? 'Taşıma başarısız — tekrar deneyin')
      basariylaKapat(`Taşındı: ${s.partNo} · ${fmt(m)} ${s.birim} · ${s.lokasyonNo} → ${hedef.locationNo}`)
    } catch {
      setHata('Bağlantı hatası — tekrar deneyin')
    } finally {
      setCalisiyor(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={kapat}>
      <input {...inputProps} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${s.partNo} taşı`}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-md flex-col rounded-t-2xl bg-background shadow-lg"
      >
        <div className="flex items-center gap-2.5 border-b p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: TERMINAL_ACCENT }}>
            <ArrowDownUp className="h-5 w-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="text-lg font-bold">{s.partNo}</span>
            <span className="truncate text-xs text-muted-foreground">{s.partAdi}</span>
          </span>
          <button type="button" onClick={kapat} aria-label="Kapat" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl active:bg-muted/70">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto p-4">
          {/* Kaynak (sabit) */}
          <div className="grid grid-cols-3 gap-2 rounded-xl border bg-card p-3 text-center text-xs">
            <div><div className="text-muted-foreground">Raf</div><b>{s.lokasyonNo}</b>{s.lokasyonAdi && <div className="truncate text-muted-foreground">{s.lokasyonAdi}</div>}</div>
            <div><div className="text-muted-foreground">Lot</div><b>{tire(s.lot)}</b></div>
            <div><div className="text-muted-foreground">Kullanılabilir</div><b style={{ color: TERMINAL_ACCENT }}>{fmt(s.kullanilabilir)} {s.birim}</b></div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold" style={{ color: TERMINAL_ACCENT }}>Miktar (en fazla {fmt(s.kullanilabilir)} {s.birim})</span>
            <input
              value={miktar}
              onChange={(e) => setMiktar(e.target.value)}
              onFocus={() => setMiktarOdak(true)}
              onBlur={() => setMiktarOdak(false)}
              inputMode="decimal"
              className="h-12 rounded-xl border bg-background px-3 text-lg font-semibold outline-none focus:ring-1 focus:ring-ring"
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold" style={{ color: TERMINAL_ACCENT }}>Hedef raf</span>
            {hedef ? (
              <div className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: TERMINAL_ACCENT }}>
                <MapPin className="h-4 w-4 shrink-0" style={{ color: TERMINAL_ACCENT }} />
                <span className="min-w-0 flex-1 text-sm font-semibold">{hedef.aciklama ? `${hedef.aciklama} (${hedef.locationNo})` : hedef.locationNo}</span>
                <button type="button" onClick={() => setHedef(null)} className="text-xs text-muted-foreground underline">değiştir</button>
              </div>
            ) : (
              <>
                {oneri && (
                  <button type="button" onClick={() => void hedefCoz(oneri.locationNo)} className="flex min-h-12 items-center gap-2 rounded-xl border border-dashed bg-card px-3 py-2 text-left text-sm active:bg-muted/70" style={{ borderColor: TERMINAL_ACCENT }}>
                    <MapPin className="h-4 w-4 shrink-0" style={{ color: TERMINAL_ACCENT }} />
                    <span className="min-w-0 flex-1">
                      Önerilen: <b>{oneri.aciklama ? `${oneri.aciklama} (${oneri.locationNo})` : oneri.locationNo}</b>
                      <span className="text-xs text-muted-foreground">
                        {oneri.kaynak === 'son-giris' ? (gunAy(oneri.tarih) ? ` · son giriş ${gunAy(oneri.tarih)}` : ' · son giriş') : ' · varsayılan lokasyon'}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold" style={{ color: TERMINAL_ACCENT }}>Seç</span>
                  </button>
                )}
                <div className="flex items-center gap-2 rounded-xl border p-3 text-sm" style={{ borderColor: TERMINAL_ACCENT, background: `${TERMINAL_ACCENT}0D` }}>
                  <ScanLine className="h-5 w-5 shrink-0" style={{ color: TERMINAL_ACCENT }} />
                  <span className="font-semibold" style={{ color: TERMINAL_ACCENT }}>Hedef rafı okut</span>
                </div>
                {elleAcik ? (
                  <div className="flex gap-2">
                    <input autoFocus value={elleVal} onChange={(e) => setElleVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void hedefCoz(elleVal)} placeholder="Hedef raf kodu"
                      className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-3 text-base outline-none focus:ring-1 focus:ring-ring" />
                    <button type="button" onClick={() => void hedefCoz(elleVal)} className="h-11 rounded-xl px-4 text-sm font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>Getir</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setElleAcik(true)} className="self-center text-sm text-muted-foreground underline underline-offset-2">veya elle gir</button>
                )}
              </>
            )}
          </div>

          {hata && <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{hata}</div>}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t p-4">
          <button type="button" onClick={kapat} className="min-h-12 rounded-xl border text-base font-semibold">Kapat</button>
          <button type="button" onClick={() => void tasi()} disabled={!hedef || calisiyor}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl text-base font-semibold text-white disabled:opacity-40" style={{ background: TERMINAL_ACCENT }}>
            {calisiyor ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowDownUp className="h-5 w-5" />} TAŞI
          </button>
        </div>
      </div>
    </div>
  )
}
