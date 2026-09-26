'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Loader2, MapPin, Plus, ScanLine, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScanner } from '@/lib/depo/use-scanner'
import type { EtiketKaynak } from '@/lib/depo/etiket-parse'
import { TERMINAL_ACCENT } from '../../_shared'
import type { StokKimligi, TalepDetay, TalepListeleri, TalepSatir, TuketSatirSonuc } from '@/lib/ifs/malzeme-talebi'
import type { StokBilgisiSatir } from '@/lib/ifs/stok-bilgisi'

type Sekme = 'TALEP' | 'SATIRLAR' | 'OZET'
type Adim = 'LOKASYON' | 'BARKOD' | 'MIKTAR'

const fmt = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 3 })
const tire = (v: string) => (!v || v === '*' ? '—' : v)

function kimlikOf(s: StokBilgisiSatir): StokKimligi {
  return {
    partNo: s.partNo,
    locationNo: s.lokasyonNo,
    lotBatchNo: s.lot || '*',
    serialNo: s.seri || '*',
    engChgLevel: s.muhSeviye || '*',
    waivDevRejNo: s.waivDevRejNo || '*',
    configurationId: s.konfigurasyon || '*',
    activitySeq: s.aktiviteSira,
    handlingUnitId: s.tasimaBirimi,
  }
}

export function MalzemeTalebiClient() {
  const router = useRouter()
  const [sekme, setSekme] = useState<Sekme>('TALEP')
  const [talep, setTalep] = useState<TalepDetay | null>(null)
  const [listeler, setListeler] = useState<TalepListeleri>({ musteriler: [], varisYerleri: [] })
  const [musteri, setMusteri] = useState('')
  const [varis, setVaris] = useState('')
  const [not, setNot] = useState('')

  const [adim, setAdim] = useState<Adim>('LOKASYON')
  const [lokasyon, setLokasyon] = useState('')
  const [adaylar, setAdaylar] = useState<StokBilgisiSatir[] | null>(null)
  const [secili, setSecili] = useState<StokBilgisiSatir | null>(null)
  const [miktar, setMiktar] = useState('')

  const [onayAcik, setOnayAcik] = useState(false)
  const [ozet, setOzet] = useState<{ sonuclar: TuketSatirSonuc[]; talepDurumu: string } | null>(null)

  const [loading, setLoading] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualVal, setManualVal] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [errorKey, setErrorKey] = useState(0)
  const [info, setInfo] = useState<string | null>(null)

  const showError = useCallback((msg: string) => {
    setErrorMsg(msg)
    setErrorKey((k) => k + 1)
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(200)
  }, [])
  useEffect(() => {
    if (!errorMsg) return
    const t = setTimeout(() => setErrorMsg(null), 3500)
    return () => clearTimeout(t)
  }, [errorKey, errorMsg])
  useEffect(() => {
    if (!info) return
    const t = setTimeout(() => setInfo(null), 2500)
    return () => clearTimeout(t)
  }, [info])

  // Değer listeleri — tek müşteri varsa otomatik seç.
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/depo/malzeme-talebi/listeler')
        const data = await res.json().catch(() => null)
        if (res.ok && data?.ok) {
          const l = { musteriler: data.musteriler ?? [], varisYerleri: data.varisYerleri ?? [] } as TalepListeleri
          setListeler(l)
          if (l.musteriler.length === 1) setMusteri(l.musteriler[0].id)
        }
      } catch { /* liste yoksa yeni talep butonu pasif kalır */ }
    })()
  }, [])

  const salt = talep?.durum === 'Closed'

  const satirSifirla = useCallback((lokasyonuKoru: boolean) => {
    setAdaylar(null)
    setSecili(null)
    setMiktar('')
    if (!lokasyonuKoru) setLokasyon('')
    setAdim(lokasyonuKoru ? 'BARKOD' : 'LOKASYON')
  }, [])

  const talepYukle = useCallback(async (no: string, sekmeyeGec = true) => {
    const v = no.trim()
    if (!v) return
    setLoading(true)
    try {
      const res = await fetch(`/api/depo/malzeme-talebi?orderNo=${encodeURIComponent(v)}`)
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        showError(data?.error ?? `Talep bulunamadı: ${v}`)
        return
      }
      setTalep(data.talep as TalepDetay)
      if (sekmeyeGec) setSekme('SATIRLAR')
    } catch {
      showError('Bağlantı hatası — tekrar deneyin')
    } finally {
      setLoading(false)
    }
  }, [showError])

  const yeniTalep = async () => {
    if (!musteri || !varis) return showError('Dahili müşteri ve varış yeri seçin')
    setLoading(true)
    try {
      const res = await fetch('/api/depo/malzeme-talebi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intCustomerNo: musteri, destinationId: varis, not: not.trim() || undefined }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) return showError(data?.error ?? 'Talep oluşturulamadı')
      setNot('')
      setInfo(`Talep ${data.orderNo} oluşturuldu`)
      satirSifirla(false)
      await talepYukle(String(data.orderNo))
    } catch {
      showError('Bağlantı hatası — tekrar deneyin')
    } finally {
      setLoading(false)
    }
  }

  const lokasyonOkut = async (v: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/depo/malzeme-talebi/stok?lokasyon=${encodeURIComponent(v)}`)
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) return showError(data?.error ?? 'Lokasyon okunamadı')
      if (!data.toplam) return showError(`Lokasyonda stok yok: ${v}`)
      setLokasyon(v)
      setAdim('BARKOD')
    } catch {
      showError('Bağlantı hatası — tekrar deneyin')
    } finally {
      setLoading(false)
    }
  }

  const stokOkut = async (v: string, kaynak: EtiketKaynak) => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ lokasyon, okut: v, kaynak })
      const res = await fetch(`/api/depo/malzeme-talebi/stok?${p.toString()}`)
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) return showError(data?.error ?? 'Stok okunamadı')
      const satirlar = (data.satirlar ?? []) as StokBilgisiSatir[]
      if (!satirlar.length) return showError(`${lokasyon} lokasyonunda bulunamadı: ${v}`)
      if (satirlar.length === 1) {
        setSecili(satirlar[0])
        setAdaylar(null)
        setAdim('MIKTAR')
      } else {
        setAdaylar(satirlar)
        setSecili(null)
      }
    } catch {
      showError('Bağlantı hatası — tekrar deneyin')
    } finally {
      setLoading(false)
    }
  }

  const ekle = async () => {
    if (!talep || !secili) return
    const m = Number(miktar.replace(',', '.'))
    if (!(m > 0)) return showError('Miktar girin')
    if (m > secili.kullanilabilir) return showError(`En fazla ${fmt(secili.kullanilabilir)} ${secili.birim}`)
    setLoading(true)
    try {
      const res = await fetch(`/api/depo/malzeme-talebi/${encodeURIComponent(talep.orderNo)}/satir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stok: kimlikOf(secili), miktar: m }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) return showError(data?.error ?? 'Satır eklenemedi')
      setInfo(`${secili.partNo} · ${fmt(m)} ${secili.birim} rezerve edildi`)
      satirSifirla(true)
      await talepYukle(talep.orderNo, false)
    } catch {
      showError('Bağlantı hatası — tekrar deneyin')
    } finally {
      setLoading(false)
    }
  }

  const cikar = async (s: TalepSatir) => {
    if (!talep) return
    setLoading(true)
    try {
      const p = new URLSearchParams({ lineNo: s.lineNo, releaseNo: s.releaseNo, lineItemNo: String(s.lineItemNo) })
      const res = await fetch(`/api/depo/malzeme-talebi/${encodeURIComponent(talep.orderNo)}/satir?${p.toString()}`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) return showError(data?.error ?? 'Satır çıkarılamadı')
      setInfo(`${s.partNo} çıkarıldı, rezerv geri alındı`)
      await talepYukle(talep.orderNo, false)
    } catch {
      showError('Bağlantı hatası — tekrar deneyin')
    } finally {
      setLoading(false)
    }
  }

  const tuketilecek = talep?.satirlar.filter((s) => s.rezerve > 0 && s.durum !== 'Closed') ?? []

  const tuketOnayla = async () => {
    if (!talep) return
    setOnayAcik(false)
    setLoading(true)
    try {
      const res = await fetch(`/api/depo/malzeme-talebi/${encodeURIComponent(talep.orderNo)}/tuket`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) return showError(data?.error ?? 'Tüketim başarısız')
      setOzet({ sonuclar: data.sonuclar ?? [], talepDurumu: data.talepDurumu ?? '' })
      setSekme('OZET')
      await talepYukle(talep.orderNo, false)
    } catch {
      showError('Bağlantı hatası — tekrar deneyin')
    } finally {
      setLoading(false)
    }
  }

  // Okutma yönlendirmesi: sekme + adıma göre.
  const dispatch = (v: string, kaynak: EtiketKaynak) => {
    const s = v.trim()
    if (!s) return
    if (sekme === 'TALEP') return void talepYukle(s)
    if (sekme !== 'SATIRLAR' || salt) return
    if (adim === 'LOKASYON') return void lokasyonOkut(s)
    return void stokOkut(s, kaynak) // BARKOD ve MIKTAR: yeni okutma yeni stok satırı
  }
  const { inputProps } = useScanner(!manualOpen && !loading && !onayAcik && sekme !== 'OZET', (v) => dispatch(v, 'okutma'))

  const submitManual = () => {
    const v = manualVal.trim()
    if (!v) return
    setManualVal('')
    setManualOpen(false)
    dispatch(v, 'elle')
  }

  const serit =
    sekme === 'TALEP'
      ? { baslik: 'Talep no okut', alt: 'mevcut talebi açar' }
      : adim === 'LOKASYON'
        ? { baslik: 'Kaynak lokasyonu okut', alt: 'malzemenin alınacağı raf' }
        : { baslik: 'Barkod okut', alt: `lokasyon ${lokasyon}` }

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
          <h1 className="text-base font-semibold">Malzeme Talebi</h1>
          {talep && (
            <span className="truncate text-xs text-muted-foreground">
              Talep {talep.orderNo} · {talep.durum} · {talep.satirlar.length} satır
            </span>
          )}
        </div>
      </div>

      {/* Sekmeler */}
      <div className="grid grid-cols-2 gap-1 rounded-xl border p-1">
        {(['TALEP', 'SATIRLAR'] as const).map((s) => (
          <button
            key={s}
            type="button"
            disabled={s === 'SATIRLAR' && !talep}
            onClick={() => setSekme(s)}
            className={cn('h-9 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40', (sekme === s || (s === 'SATIRLAR' && sekme === 'OZET')) ? 'text-white' : 'text-muted-foreground')}
            style={sekme === s || (s === 'SATIRLAR' && sekme === 'OZET') ? { background: TERMINAL_ACCENT } : undefined}
          >
            {s === 'TALEP' ? 'Talep' : 'Satırlar'}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div key={errorKey} className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{errorMsg}</div>
      )}
      {info && <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{info}</div>}

      {/* Okutma şeridi (TALEP ve açık talepte SATIRLAR) */}
      {(sekme === 'TALEP' || (sekme === 'SATIRLAR' && !salt)) && (
        <>
          <div className="flex items-center gap-3 rounded-2xl border p-3" style={{ borderColor: TERMINAL_ACCENT, background: `${TERMINAL_ACCENT}0D` }}>
            <ScanLine className="h-6 w-6 shrink-0" style={{ color: TERMINAL_ACCENT }} />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-sm font-semibold" style={{ color: TERMINAL_ACCENT }}>{serit.baslik}</div>
              <div className="truncate text-xs text-muted-foreground">{serit.alt}</div>
            </div>
            {sekme === 'SATIRLAR' && lokasyon && (
              <button type="button" onClick={() => satirSifirla(false)} className="flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold">
                <MapPin className="h-3.5 w-3.5" /> {lokasyon} <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {manualOpen ? (
            <div className="flex w-full gap-2">
              <input
                autoFocus
                value={manualVal}
                onChange={(e) => setManualVal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitManual()}
                placeholder={sekme === 'TALEP' ? 'Talep no' : adim === 'LOKASYON' ? 'Lokasyon' : 'Stok no'}
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
        </>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> IFS ile işlem yapılıyor…
        </div>
      )}

      {/* ── TALEP ── */}
      {sekme === 'TALEP' && !loading && (
        <div className="flex flex-col gap-2 rounded-2xl border p-3">
          <div className="text-sm font-semibold">Yeni talep</div>
          <Alan etiket="Dahili Müşteri">
            <select value={musteri} onChange={(e) => setMusteri(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-2 text-base">
              <option value="">Seçin</option>
              {listeler.musteriler.map((m) => <option key={m.id} value={m.id}>{m.id} · {m.ad}</option>)}
            </select>
          </Alan>
          <Alan etiket="Varış Yeri">
            <select value={varis} onChange={(e) => setVaris(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-2 text-base">
              <option value="">Seçin</option>
              {listeler.varisYerleri.map((v) => <option key={v.id} value={v.id}>{v.id} · {v.ad}</option>)}
            </select>
          </Alan>
          <Alan etiket="Not (isteğe bağlı)">
            <input value={not} onChange={(e) => setNot(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-base outline-none focus:ring-1 focus:ring-ring" />
          </Alan>
          <button
            type="button"
            onClick={() => void yeniTalep()}
            disabled={!musteri || !varis}
            className="mt-1 flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: TERMINAL_ACCENT }}
          >
            <Plus className="h-4 w-4" /> Yeni Talep
          </button>
        </div>
      )}

      {/* ── SATIRLAR ── */}
      {sekme === 'SATIRLAR' && talep && !loading && (
        <div className="flex flex-col gap-3">
          {salt && (
            <div className="rounded-xl border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">Talep kapalı — salt okunur</div>
          )}

          {/* Birden çok stok satırı → seçtir */}
          {!salt && adaylar && (
            <div className="flex flex-col gap-2">
              <div className="text-sm font-semibold" style={{ color: TERMINAL_ACCENT }}>Hangi stok satırı?</div>
              {adaylar.map((a, i) => (
                <button key={i} type="button" onClick={() => { setSecili(a); setAdaylar(null); setAdim('MIKTAR') }} className="rounded-2xl border bg-card p-3 text-left active:opacity-70" style={{ borderColor: TERMINAL_ACCENT }}>
                  <div className="font-semibold">{a.partNo} <span className="text-xs font-normal text-muted-foreground">lot {tire(a.lot)}{a.tasimaBirimi ? ` · TB ${a.tasimaBirimi}` : ''}</span></div>
                  <div className="text-xs text-muted-foreground">kullanılabilir {fmt(a.kullanilabilir)} {a.birim}</div>
                </button>
              ))}
            </div>
          )}

          {/* Seçili stok + miktar */}
          {!salt && adim === 'MIKTAR' && secili && (
            <div className="flex flex-col gap-2 rounded-2xl border p-3" style={{ borderColor: TERMINAL_ACCENT }}>
              <div className="min-w-0">
                <div className="font-semibold">{secili.partNo}</div>
                <div className="truncate text-xs text-muted-foreground">{secili.partAdi}</div>
                <div className="text-xs text-muted-foreground">{secili.lokasyonNo} · lot {tire(secili.lot)}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Miktar etiket="Eldeki" deger={secili.eldeki} birim={secili.birim} />
                <Miktar etiket="Rezerve" deger={secili.rezerve} birim={secili.birim} />
                <Miktar etiket="Kullanılabilir" deger={secili.kullanilabilir} birim={secili.birim} vurgu />
              </div>
              <div className="flex gap-2">
                <input
                  value={miktar}
                  onChange={(e) => setMiktar(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void ekle()}
                  inputMode="decimal"
                  placeholder={`Miktar (en fazla ${fmt(secili.kullanilabilir)})`}
                  className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-3 text-base outline-none focus:ring-1 focus:ring-ring"
                />
                <button type="button" onClick={() => void ekle()} className="h-11 rounded-xl px-5 text-sm font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>
                  EKLE
                </button>
              </div>
              <button type="button" onClick={() => satirSifirla(true)} className="self-center text-xs text-muted-foreground underline underline-offset-2">vazgeç</button>
            </div>
          )}

          {/* Eklenen satırlar */}
          <div className="flex flex-col gap-2">
            <div className="text-sm font-semibold text-muted-foreground">Talep satırları</div>
            {talep.satirlar.length === 0 && (
              <div className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">Henüz satır yok</div>
            )}
            {talep.satirlar.map((s) => (
              <div key={`${s.lineNo}-${s.releaseNo}-${s.lineItemNo}`} className={cn('flex items-start justify-between gap-2 rounded-2xl border bg-card p-3', s.durum === 'Closed' && 'bg-muted/40')}>
                <div className="min-w-0">
                  <div className="font-semibold">{s.partNo}</div>
                  <div className="truncate text-xs text-muted-foreground">{s.partAdi}</div>
                  <div className="text-xs">
                    {s.rezervler.length ? s.rezervler.map((r) => `${r.locationNo} · lot ${tire(r.lotBatchNo)}`).join(', ') : '—'}
                  </div>
                  <div className="text-xs font-semibold" style={{ color: TERMINAL_ACCENT }}>
                    {s.cikis > 0 ? `${fmt(s.cikis)} ${s.birim} çıkış yapıldı` : `${fmt(s.rezerve)} ${s.birim} rezerve`} · {s.durum}
                  </div>
                </div>
                {!salt && s.cikis === 0 && s.durum !== 'Closed' && (
                  <button type="button" onClick={() => void cikar(s)} aria-label="Çıkar" className="flex shrink-0 items-center gap-1 rounded-lg border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 active:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" /> Çıkar
                  </button>
                )}
              </div>
            ))}
          </div>

          {!salt && tuketilecek.length > 0 && (
            <button type="button" onClick={() => setOnayAcik(true)} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl text-base font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>
              <Check className="h-5 w-5" /> TÜKET ({tuketilecek.length} kalem)
            </button>
          )}
        </div>
      )}

      {/* ── ÖZET ── */}
      {sekme === 'OZET' && ozet && !loading && (
        <div className="flex flex-col gap-2">
          <div className="text-sm font-semibold">Tüketim sonucu · talep {talep?.orderNo} → {ozet.talepDurumu}</div>
          {ozet.sonuclar.map((r) => (
            <div key={`${r.lineNo}-${r.releaseNo}`} className={cn('rounded-2xl border p-3 text-sm', r.ok ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-red-300 bg-red-50 text-red-800')}>
              <div className="font-semibold">{r.partNo} {r.ok ? `· ${fmt(r.miktar)} düşüldü (${r.lokasyonlar.join(', ')})` : '· BAŞARISIZ'}</div>
              {r.hata && <div className="text-xs">{r.hata}</div>}
            </div>
          ))}
          <div className="mt-1 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setOzet(null); setSekme('SATIRLAR') }} className="h-11 rounded-xl border text-sm font-semibold">Talebe dön</button>
            <button type="button" onClick={() => { setOzet(null); setTalep(null); satirSifirla(false); setSekme('TALEP') }} className="h-11 rounded-xl text-sm font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>Yeni talep</button>
          </div>
        </div>
      )}

      {/* TÜKET onayı */}
      {onayAcik && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-background p-4 shadow-lg">
            <div className="text-base font-semibold">{tuketilecek.length} kalem stoktan düşülecek</div>
            <div className="mt-1 text-sm text-muted-foreground">Bu işlem IFS&apos;te çıkış yapar, geri alınamaz.</div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setOnayAcik(false)} className="h-11 rounded-xl border text-sm font-semibold">Vazgeç</button>
              <button type="button" onClick={() => void tuketOnayla()} className="h-11 rounded-xl text-sm font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>TÜKET</button>
            </div>
          </div>
        </div>
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

function Miktar({ etiket, deger, birim, vurgu }: { etiket: string; deger: number; birim: string; vurgu?: boolean }) {
  return (
    <div className="rounded-lg border px-1 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{etiket}</div>
      <div className="text-sm font-semibold" style={vurgu ? { color: TERMINAL_ACCENT } : undefined}>
        {fmt(deger)} <span className="text-xs font-normal">{birim}</span>
      </div>
    </div>
  )
}
