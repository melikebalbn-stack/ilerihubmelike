'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Ban, Check, Loader2, MapPin, Plus, ScanLine, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScanner } from '@/lib/depo/use-scanner'
import type { EtiketKaynak } from '@/lib/depo/etiket-parse'
import { TERMINAL_ACCENT } from '../../_shared'
import type { Fis, FisOzet, FisSatir, TasimaStokSatiri } from '@/lib/ifs/toplu-tasima'
import type { StokBilgisiSatir } from '@/lib/ifs/stok-bilgisi'

type Sekme = 'FIS' | 'SATIRLAR' | 'OZET'
// Okutma ALAN BAZLI — değer o an beklenen alana gider.
type Alan = 'FIS_NO' | 'HEDEF_LOK' | 'LOKASYON' | 'MALZEME' | null
type Eksik = { partNo: string; locationNo: string; lotBatchNo: string; gerekli: number; mevcut: number }

const fmt = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 3 })
const tire = (v: string) => (!v || v === '*' ? '—' : v)
const kimlik = (s: StokBilgisiSatir): TasimaStokSatiri => ({
  partNo: s.partNo, locationNo: s.lokasyonNo, lotBatchNo: s.lot || '*', serialNo: s.seri || '*', engChgLevel: s.muhSeviye || '*',
  waivDevRejNo: s.waivDevRejNo || '*', configurationId: s.konfigurasyon || '*', activitySeq: s.aktiviteSira, handlingUnitId: s.tasimaBirimi,
})
const satirKimlik = (s: FisSatir): TasimaStokSatiri => ({
  partNo: s.partNo, locationNo: s.locationNo, lotBatchNo: s.lotBatchNo, serialNo: s.serialNo, engChgLevel: s.engChgLevel,
  waivDevRejNo: s.waivDevRejNo, configurationId: s.configurationId, activitySeq: s.activitySeq, handlingUnitId: s.handlingUnitId,
})

export function TopluTasimaClient() {
  const router = useRouter()
  const [sekme, setSekme] = useState<Sekme>('FIS')
  const [fisler, setFisler] = useState<FisOzet[] | null>(null)
  const [fis, setFis] = useState<Fis | null>(null)
  const [yeniMod, setYeniMod] = useState(false)
  const [not, setNot] = useState('')
  const [lokasyon, setLokasyon] = useState('')
  const [adaylar, setAdaylar] = useState<StokBilgisiSatir[] | null>(null)
  const [secili, setSecili] = useState<StokBilgisiSatir | null>(null)
  const [miktar, setMiktar] = useState('')
  const [onay, setOnay] = useState<'TRANSFER' | 'IPTAL' | null>(null)
  const [eksikler, setEksikler] = useState<Eksik[] | null>(null)
  const [ozet, setOzet] = useState<{ no: number; durum: string; kalem: number; hedef: string } | null>(null)

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
    const t = setTimeout(() => setInfo(null), 3000)
    return () => clearTimeout(t)
  }, [info])

  const api = useCallback(async (url: string, init?: RequestInit): Promise<Record<string, unknown> | null> => {
    setLoading(true)
    try {
      const res = await fetch(url, init)
      const data = await res.json().catch(() => null)
      if (res.status === 409 && data?.eksikler) { setEksikler(data.eksikler as Eksik[]); return null }
      if (!res.ok || !data?.ok) { showError(data?.error ?? 'İşlem başarısız'); return null }
      return data
    } catch {
      showError('Bağlantı hatası — tekrar deneyin')
      return null
    } finally {
      setLoading(false)
    }
  }, [showError])
  const json = (method: string, body: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

  const listeYukle = useCallback(async () => {
    const d = await api('/api/depo/toplu-tasima')
    if (d) setFisler((d.fisler ?? []) as FisOzet[])
  }, [api])
  useEffect(() => { if (sekme === 'FIS' && fisler === null) void listeYukle() }, [sekme, fisler, listeYukle])

  const satirSifirla = useCallback((lokasyonuKoru: boolean) => {
    setAdaylar(null); setSecili(null); setMiktar('')
    if (!lokasyonuKoru) setLokasyon('')
  }, [])
  const secimSifirla = () => { setSecili(null); setMiktar('') }

  const fisAc = useCallback(async (no: number, sekmeyeGec = true) => {
    const d = await api(`/api/depo/toplu-tasima/${no}`)
    if (!d) return
    setFis(d.fis as Fis)
    setEksikler(null)
    if (sekmeyeGec) { satirSifirla(false); setSekme('SATIRLAR') }
  }, [api, satirSifirla])

  const yeniFis = async (hedef: string) => {
    const d = await api('/api/depo/toplu-tasima', json('POST', { varisLok: hedef, not: not.trim() || undefined }))
    if (!d) return
    setYeniMod(false); setNot(''); setFisler(null)
    setInfo(`Fiş ${d.no} oluşturuldu → ${hedef}`)
    await fisAc(Number(d.no))
  }

  // Lokasyon okutulunca oradaki kullanılabilir stok satırları kart olarak listelenir (barkod ZORUNLU değil);
  // tek satırsa otomatik seçilir. `otomatik` false → yalnız liste yenilenir (EKLE sonrası).
  const lokasyonOkut = async (v: string, otomatik = true) => {
    if (fis && v === fis.varisLok) return showError(`Hedef lokasyon ${v} — kaynak farklı olmalı`)
    const d = await api(`/api/depo/toplu-tasima/stok?lokasyon=${encodeURIComponent(v)}`)
    if (!d) return
    if (!Number(d.toplam)) return showError(`Lokasyonda stok yok: ${v}`)
    const s = (d.satirlar ?? []) as StokBilgisiSatir[]
    setLokasyon(v)
    setAdaylar(s)
    if (!s.length) return showError(`${v} lokasyonunda kullanılabilir stok yok (rezerveli)`)
    if (otomatik && s.length === 1) setSecili(s[0])
  }
  const malzemeOkut = async (v: string, kaynak: EtiketKaynak) => {
    const p = new URLSearchParams({ lokasyon, okut: v, kaynak })
    const d = await api(`/api/depo/toplu-tasima/stok?${p.toString()}`)
    if (!d) return
    const s = (d.satirlar ?? []) as StokBilgisiSatir[]
    if (!s.length) return showError(`${lokasyon} lokasyonunda kullanılabilir bulunamadı: ${v}`)
    // Barkod isteğe bağlı: okutulan parça/lot listelenen satırlardan birine uymalı.
    if (s.length === 1) setSecili(s[0])
    else { setAdaylar(s); setSecili(null) }
  }

  const ekle = async () => {
    if (!fis || !secili) return
    const m = Number(miktar.replace(',', '.'))
    if (!(m > 0)) return showError('Miktar girin')
    if (m > secili.kullanilabilir) return showError(`En fazla ${fmt(secili.kullanilabilir)} ${secili.birim}`)
    const d = await api(`/api/depo/toplu-tasima/${fis.no}/satir`, json('POST', { stok: kimlik(secili), miktar: m }))
    if (!d) return
    setInfo(`${secili.partNo} · ${fmt(m)} ${secili.birim} eklendi`)
    secimSifirla()
    await fisAc(fis.no, false)
    await lokasyonOkut(lokasyon, false)
  }

  const sil = async (s: FisSatir) => {
    if (!fis) return
    const d = await api(`/api/depo/toplu-tasima/${fis.no}/satir`, json('DELETE', { stok: satirKimlik(s) }))
    if (!d) return
    setInfo(`${s.partNo} fişten silindi`)
    await fisAc(fis.no, false)
  }

  const onayla = async () => {
    if (!fis || !onay) return
    const tur = onay
    setOnay(null)
    const d = await api(`/api/depo/toplu-tasima/${fis.no}/${tur === 'TRANSFER' ? 'transfer' : 'iptal'}`, { method: 'POST' })
    if (!d) return
    setOzet({ no: fis.no, durum: String(d.durum ?? ''), kalem: fis.satirlar.length, hedef: fis.varisLok })
    setFisler(null)
    setSekme('OZET')
  }

  const acik = fis?.durum === 'Yeni'
  const alan: Alan = (() => {
    if (sekme === 'FIS') return yeniMod ? 'HEDEF_LOK' : 'FIS_NO'
    if (sekme === 'SATIRLAR' && acik && !onay && !eksikler) return lokasyon ? 'MALZEME' : 'LOKASYON'
    return null
  })()
  const dispatch = async (v: string, kaynak: EtiketKaynak) => {
    const s = v.trim()
    if (!s || !alan) return
    if (alan === 'FIS_NO') {
      if (!/^\d+$/.test(s)) return showError(`Geçersiz fiş no: ${s}`)
      return void fisAc(Number(s))
    }
    if (alan === 'HEDEF_LOK') return void yeniFis(s)
    if (alan === 'LOKASYON') return void lokasyonOkut(s)
    return void malzemeOkut(s, kaynak)
  }
  const { inputProps } = useScanner(!!alan && !manualOpen && !loading, (v) => void dispatch(v, 'okutma'))
  const submitManual = () => {
    const v = manualVal.trim()
    if (!v) return
    setManualVal(''); setManualOpen(false)
    void dispatch(v, 'elle')
  }

  const serit: Record<Exclude<Alan, null>, { baslik: string; alt: string }> = {
    FIS_NO: { baslik: 'Fiş no okut', alt: 'mevcut fişi açar' },
    HEDEF_LOK: { baslik: 'Hedef lokasyonu okut', alt: 'yeni fiş bu lokasyona taşır' },
    LOKASYON: { baslik: 'Kaynak lokasyonu okut', alt: `hedef ${fis?.varisLok ?? ''}` },
    MALZEME: { baslik: 'Barkod okut (isteğe bağlı)', alt: `lokasyon ${lokasyon} · ya da aşağıdan stok satırını seç` },
  }

  return (
    <div className="flex flex-1 flex-col gap-3 py-2">
      <input {...inputProps} />

      <div className="flex items-center gap-2 pt-1">
        <button type="button" onClick={() => router.push('/terminal/depo')} aria-label="Geri" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors active:bg-muted/70">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-col leading-tight">
          <h1 className="text-base font-semibold">Toplu Taşıma</h1>
          {fis && <span className="truncate text-xs text-muted-foreground">Fiş {fis.no} · {fis.durum} · → {fis.varisLok} · {fis.satirlar.length} kalem</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl border p-1">
        {(['FIS', 'SATIRLAR'] as const).map((s) => {
          const aktif = sekme === s || (s === 'SATIRLAR' && sekme === 'OZET')
          return (
            <button key={s} type="button" disabled={s === 'SATIRLAR' && !fis} onClick={() => setSekme(s)}
              className={cn('h-9 rounded-lg text-sm font-semibold disabled:opacity-40', aktif ? 'text-white' : 'text-muted-foreground')} style={aktif ? { background: TERMINAL_ACCENT } : undefined}>
              {s === 'FIS' ? 'Fiş' : 'Satırlar'}
            </button>
          )
        })}
      </div>

      {errorMsg && <div key={errorKey} className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{errorMsg}</div>}
      {info && <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{info}</div>}

      {alan && (
        <>
          <div className="flex items-center gap-3 rounded-2xl border p-3" style={{ borderColor: TERMINAL_ACCENT, background: `${TERMINAL_ACCENT}0D` }}>
            <ScanLine className="h-6 w-6 shrink-0" style={{ color: TERMINAL_ACCENT }} />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-sm font-semibold" style={{ color: TERMINAL_ACCENT }}>{serit[alan].baslik}</div>
              <div className="truncate text-xs text-muted-foreground">{serit[alan].alt}</div>
            </div>
            {alan === 'MALZEME' && (
              <button type="button" onClick={() => satirSifirla(false)} className="flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold">
                <MapPin className="h-3.5 w-3.5" /> {lokasyon} <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {manualOpen ? (
            <div className="flex w-full gap-2">
              <input autoFocus value={manualVal} onChange={(e) => setManualVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitManual()}
                inputMode={alan === 'FIS_NO' ? 'numeric' : undefined}
                placeholder={alan === 'FIS_NO' ? 'Fiş no' : alan === 'MALZEME' ? 'Stok no' : 'Lokasyon'}
                className="h-11 flex-1 rounded-xl border bg-background px-3 text-base outline-none focus:ring-1 focus:ring-ring" />
              <button type="button" onClick={submitManual} className="h-11 rounded-xl px-4 text-sm font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>Getir</button>
            </div>
          ) : (
            <button type="button" onClick={() => setManualOpen(true)} className="self-center text-sm text-muted-foreground underline underline-offset-2">veya elle gir</button>
          )}
        </>
      )}

      {loading && <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> IFS ile işlem yapılıyor…</div>}

      {/* FİŞ */}
      {sekme === 'FIS' && !loading && (
        <div className="flex flex-col gap-2">
          {yeniMod ? (
            <div className="flex flex-col gap-2 rounded-2xl border p-3" style={{ borderColor: TERMINAL_ACCENT }}>
              <div className="text-sm font-semibold">Yeni fiş — hedef lokasyonu okutun</div>
              <input value={not} onChange={(e) => setNot(e.target.value)} placeholder="Not (isteğe bağlı)" className="h-10 rounded-lg border bg-background px-3 text-base outline-none" />
              <button type="button" onClick={() => setYeniMod(false)} className="self-center text-xs text-muted-foreground underline">vazgeç</button>
            </div>
          ) : (
            <button type="button" onClick={() => setYeniMod(true)} className="flex h-12 items-center justify-center gap-2 rounded-2xl text-base font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>
              <Plus className="h-5 w-5" /> Yeni Fiş
            </button>
          )}
          <div className="mt-1 text-sm font-semibold text-muted-foreground">Açık fişler</div>
          {fisler === null ? null : fisler.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">Açık fiş yok</div>
          ) : (
            fisler.map((f) => (
              <button key={f.no} type="button" onClick={() => void fisAc(f.no)} className="flex items-center justify-between rounded-2xl border bg-card p-3 text-left active:opacity-70" style={{ borderColor: TERMINAL_ACCENT }}>
                <span className="min-w-0">
                  <span className="font-semibold">Fiş {f.no}</span>
                  <span className="block truncate text-xs text-muted-foreground">{f.tarih}{f.not ? ` · ${f.not}` : ''}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-sm font-semibold"><MapPin className="h-4 w-4" /> {f.varisLok}</span>
              </button>
            ))
          )}
        </div>
      )}

      {/* SATIRLAR */}
      {sekme === 'SATIRLAR' && fis && !loading && (
        <div className="flex flex-col gap-3">
          {!acik && <div className="rounded-xl border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">Fiş {fis.durum} — salt okunur</div>}

          {eksikler && (
            <div className="flex flex-col gap-1 rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              <div className="font-semibold">Transfer yapılmadı — kullanılabilir stok yetersiz</div>
              {eksikler.map((e, i) => (
                <div key={i}>{e.partNo} · {e.locationNo} · lot {tire(e.lotBatchNo)}: gerekli {fmt(e.gerekli)}, mevcut {fmt(e.mevcut)}</div>
              ))}
              <button type="button" onClick={() => setEksikler(null)} className="self-end text-xs underline">kapat</button>
            </div>
          )}

          {acik && adaylar && !secili && adaylar.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="text-sm font-semibold" style={{ color: TERMINAL_ACCENT }}>{lokasyon} · stok satırını seç</div>
              {adaylar.map((a, i) => (
                <button key={i} type="button" onClick={() => { setSecili(a); setMiktar('') }} className="rounded-2xl border bg-card p-3 text-left" style={{ borderColor: TERMINAL_ACCENT }}>
                  <div className="font-semibold">{a.partNo} <span className="text-xs font-normal text-muted-foreground">lot {tire(a.lot)}{a.tasimaBirimi ? ` · palet ${a.tasimaBirimi}` : ''}</span></div>
                  {a.partAdi && <div className="truncate text-xs text-muted-foreground">{a.partAdi}</div>}
                  <div className="text-xs text-muted-foreground">kullanılabilir {fmt(a.kullanilabilir)} {a.birim}</div>
                </button>
              ))}
            </div>
          )}

          {acik && secili && (
            <div className="flex flex-col gap-2 rounded-2xl border p-3" style={{ borderColor: TERMINAL_ACCENT }}>
              <div>
                <div className="font-semibold">{secili.partNo}</div>
                <div className="truncate text-xs text-muted-foreground">{secili.partAdi} · {secili.lokasyonNo} · lot {tire(secili.lot)}{secili.tasimaBirimi ? ` · palet ${secili.tasimaBirimi}` : ''}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Miktar etiket="Eldeki" deger={secili.eldeki} birim={secili.birim} />
                <Miktar etiket="Rezerve" deger={secili.rezerve} birim={secili.birim} />
                <Miktar etiket="Kullanılabilir" deger={secili.kullanilabilir} birim={secili.birim} vurgu />
              </div>
              <div className="flex gap-2">
                <input value={miktar} onChange={(e) => setMiktar(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void ekle()} inputMode="decimal"
                  placeholder={`Miktar (en fazla ${fmt(secili.kullanilabilir)})`} className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-3 text-base outline-none" />
                <button type="button" onClick={() => void ekle()} className="h-11 rounded-xl px-5 text-sm font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>EKLE</button>
              </div>
              <button type="button" onClick={secimSifirla} className="self-center text-xs text-muted-foreground underline">vazgeç</button>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="text-sm font-semibold text-muted-foreground">Fiş satırları → {fis.varisLok}</div>
            {fis.satirlar.length === 0 && <div className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">Henüz satır yok</div>}
            {fis.satirlar.map((s, i) => (
              <div key={i} className="flex items-start justify-between gap-2 rounded-2xl border bg-card p-3">
                <div className="min-w-0">
                  <div className="font-semibold">{s.partNo}</div>
                  <div className="truncate text-xs text-muted-foreground">{s.partAdi}</div>
                  <div className="text-xs">{s.locationNo} · lot {tire(s.lotBatchNo)}{s.handlingUnitId ? ` · palet ${s.handlingUnitId}` : ''}</div>
                  <div className="text-xs font-semibold" style={{ color: TERMINAL_ACCENT }}>{fmt(s.miktar)}</div>
                </div>
                {acik && (
                  <button type="button" onClick={() => void sil(s)} className="flex shrink-0 items-center gap-1 rounded-lg border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 active:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" /> Sil
                  </button>
                )}
              </div>
            ))}
          </div>

          {acik && (
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => setOnay('IPTAL')} className="flex h-12 items-center justify-center gap-1 rounded-2xl border border-red-300 text-sm font-semibold text-red-700">
                <Ban className="h-4 w-4" /> İptal
              </button>
              <button type="button" onClick={() => setOnay('TRANSFER')} disabled={!fis.satirlar.length} className="col-span-2 flex h-12 items-center justify-center gap-2 rounded-2xl text-base font-semibold text-white disabled:opacity-40" style={{ background: TERMINAL_ACCENT }}>
                <Check className="h-5 w-5" /> TRANSFER ET
              </button>
            </div>
          )}
        </div>
      )}

      {/* ÖZET */}
      {sekme === 'OZET' && ozet && !loading && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border p-5 text-center" style={{ borderColor: TERMINAL_ACCENT }}>
          <div className="text-sm text-muted-foreground">Fiş {ozet.no}</div>
          <div className="text-2xl font-bold" style={{ color: ozet.durum === 'TransferEdildi' ? TERMINAL_ACCENT : undefined }}>{ozet.durum === 'TransferEdildi' ? 'Transfer edildi' : ozet.durum === 'IptalEdildi' ? 'İptal edildi' : ozet.durum}</div>
          {ozet.durum === 'TransferEdildi' && <div className="text-sm">{ozet.kalem} kalem → {ozet.hedef}</div>}
          <div className="grid w-full grid-cols-2 gap-2">
            <button type="button" onClick={() => { setOzet(null); setFis(null); setSekme('FIS') }} className="h-11 rounded-xl border text-sm font-semibold">Fişlere dön</button>
            <button type="button" onClick={() => { setOzet(null); setFis(null); setYeniMod(true); setSekme('FIS') }} className="h-11 rounded-xl text-sm font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>Yeni fiş</button>
          </div>
        </div>
      )}

      {onay && fis && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-background p-4 shadow-lg">
            <div className="text-base font-semibold">
              {onay === 'TRANSFER' ? `${fis.satirlar.length} kalem ${fis.varisLok}'e taşınacak` : `Fiş ${fis.no} iptal edilecek`}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">{onay === 'TRANSFER' ? 'Stok IFS\'te hemen taşınır.' : 'İptal edilen fiş listede görünmez.'}</div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setOnay(null)} className="h-11 rounded-xl border text-sm font-semibold">Vazgeç</button>
              <button type="button" onClick={() => void onayla()} className={cn('h-11 rounded-xl text-sm font-semibold text-white', onay === 'IPTAL' && 'bg-red-600')} style={onay === 'TRANSFER' ? { background: TERMINAL_ACCENT } : undefined}>
                {onay === 'TRANSFER' ? 'TRANSFER ET' : 'İPTAL ET'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
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
