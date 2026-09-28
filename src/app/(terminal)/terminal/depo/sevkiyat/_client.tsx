'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Check, Loader2, MapPin, RefreshCw, ScanLine, Trash2, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScanner } from '@/lib/depo/use-scanner'
import type { EtiketKaynak } from '@/lib/depo/etiket-parse'
import { TERMINAL_ACCENT } from '../../_shared'
import type { RezervSatiri, Sevkiyat, SevkiyatOzet } from '@/lib/ifs/sevkiyat'
import type { GeriAlinabilir, OkutmaAdayi, OkutmaKaydi } from '@/lib/depo/sevkiyat-okutma'

type Gorunum = 'LISTE' | 'DETAY' | 'OZET'
// Okutma ALAN BAZLI: listede sevkiyat no, detayda malzeme barkodu.
type Alan = 'SEVKIYAT_NO' | 'MALZEME' | null

const fmt = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 3 })
const tire = (v: string | null) => (!v || v === '*' ? '—' : v)

export function SevkiyatClient() {
  const router = useRouter()
  const [gorunum, setGorunum] = useState<Gorunum>('LISTE')
  const [liste, setListe] = useState<SevkiyatOzet[] | null>(null)
  const [sevkiyat, setSevkiyat] = useState<Sevkiyat | null>(null)
  const [okutulan, setOkutulan] = useState<OkutmaKaydi[]>([])
  const [eksikRezerv, setEksikRezerv] = useState<{ partNo: string; eksik: number }[]>([])
  const [lokasyonlar, setLokasyonlar] = useState<string[]>([])
  const [sevkLok, setSevkLok] = useState('')
  const [adaylar, setAdaylar] = useState<OkutmaAdayi[] | null>(null)
  const [secili, setSecili] = useState<OkutmaAdayi | null>(null)
  const [barkodId, setBarkodId] = useState<number | null>(null)
  const [miktar, setMiktar] = useState('')
  const [onayAcik, setOnayAcik] = useState(false)
  // Toplamayı geri al: sevk lokasyonundaki toplanmış satırlar + dönüş hedefleri; açık onay penceresi.
  const [geriAlinabilir, setGeriAlinabilir] = useState<GeriAlinabilir[]>([])
  const [geriAl, setGeriAl] = useState<{ rezerv: RezervSatiri; lokasyon: string; miktar: number; birim: string } | null>(null)
  const [ozet, setOzet] = useState<{ id: number; yontem: string; ok: number; hata: number; toplanan: number; istenen: number } | null>(null)

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
    const d = await api('/api/depo/sevkiyat')
    if (d) setListe((d.sevkiyatlar ?? []) as SevkiyatOzet[])
  }, [api])
  useEffect(() => { if (gorunum === 'LISTE' && liste === null) void listeYukle() }, [gorunum, liste, listeYukle])
  useEffect(() => {
    void (async () => {
      const d = await api('/api/depo/sevkiyat/lokasyonlar')
      if (!d) return
      const l = (d.lokasyonlar ?? []) as string[]
      setLokasyonlar(l)
      if (l.length === 1) setSevkLok(l[0])
    })()
  }, [api])

  const okutmaKapat = useCallback(() => { setAdaylar(null); setSecili(null); setBarkodId(null); setMiktar('') }, [])

  const detayYukle = useCallback(async (id: number) => {
    const d = await api(`/api/depo/sevkiyat/${id}`)
    if (!d) return false
    setSevkiyat(d.sevkiyat as Sevkiyat)
    setOkutulan((d.okutmalar ?? []) as OkutmaKaydi[])
    setGeriAlinabilir((d.geriAlinabilir ?? []) as GeriAlinabilir[])
    return true
  }, [api])

  const sevkiyatAc = useCallback(async (id: number) => {
    okutmaKapat()
    // Açılışta otomatik hazırla: rezervsizse rezerv, toplama listesi yoksa liste.
    const h = await api(`/api/depo/sevkiyat/${id}/hazirla`, { method: 'POST' })
    if (!h) return
    setEksikRezerv((h.eksikRezerv ?? []) as { partNo: string; eksik: number }[])
    if (h.rezervYapildi || h.listeYapildi) setInfo(`Sevkiyat ${id} hazırlandı${h.rezervYapildi ? ' · rezerv' : ''}${h.listeYapildi ? ' · toplama listesi' : ''}`)
    if (await detayYukle(id)) setGorunum('DETAY')
  }, [api, detayYukle, okutmaKapat])

  const malzemeOkut = async (v: string, kaynak: EtiketKaynak) => {
    if (!sevkiyat) return
    const p = new URLSearchParams({ okut: v, kaynak })
    const d = await api(`/api/depo/sevkiyat/${sevkiyat.id}/coz?${p.toString()}`)
    if (!d) return
    const a = (d.adaylar ?? []) as OkutmaAdayi[]
    setBarkodId((d.barkodId as number | null) ?? null)
    if (!a.length) return showError(`${String(d.partNo)}${d.lotBatchNo ? ` lot ${String(d.lotBatchNo)}` : ''} bu sevkiyatın açık rezervleriyle eşleşmiyor`)
    const sec = (x: OkutmaAdayi) => { setSecili(x); setAdaylar(null); setMiktar(String(x.kalan)) }
    if (a.length === 1) sec(a[0])
    else { setAdaylar(a); setSecili(null) }
  }

  const ekle = async () => {
    if (!sevkiyat || !secili) return
    const m = Number(miktar.replace(',', '.'))
    if (!(m > 0) || m > secili.kalan) return showError(`Miktar 0 ile ${fmt(secili.kalan)} arasında olmalı`)
    const d = await api(`/api/depo/sevkiyat/${sevkiyat.id}/okut`, json('POST', { keyref: secili.rezerv.keyref, barkodId, miktar: m }))
    if (!d) return
    setInfo(`${secili.rezerv.partNo} · ${fmt(m)} okutuldu (${secili.rezerv.locationNo})`)
    okutmaKapat()
    await detayYukle(sevkiyat.id)
  }

  const sil = async (o: OkutmaKaydi) => {
    if (!sevkiyat) return
    const d = await api(`/api/depo/sevkiyat/${sevkiyat.id}/okut`, json('DELETE', { okutmaId: o.id }))
    if (!d) return
    await detayYukle(sevkiyat.id)
  }

  const bitir = async () => {
    if (!sevkiyat) return
    setOnayAcik(false)
    const d = await api(`/api/depo/sevkiyat/${sevkiyat.id}/bitir`, json('POST', { sevkLok }))
    if (!d) return
    const son = d.sevkiyat as Sevkiyat | null
    const sonuclar = (d.sonuclar ?? []) as { ok: boolean }[]
    setOzet({
      id: sevkiyat.id, yontem: String(d.yontem ?? ''), ok: sonuclar.filter((x) => x.ok).length, hata: sonuclar.filter((x) => !x.ok).length,
      toplanan: son?.toplananToplam ?? 0, istenen: son?.istenenToplam ?? sevkiyat.istenenToplam,
    })
    setListe(null)
    setGorunum('OZET')
  }

  // Barkodsuz yol: rezerv satırına ("Git → lok") dokununca doğrudan seçilir; kalan = rezerve − toplanan − Hub'da bekleyen.
  // Sunucu (okut) kalanı yeniden doğrular.
  const rezervSec = (r: RezervSatiri) => {
    const kalan = r.rezerve - r.toplanan - okutulan.filter((o) => o.satirAnahtari === r.keyref).reduce((t, o) => t + o.miktar, 0)
    if (!(kalan > 0)) return showError(`${r.partNo} · ${r.locationNo}: okutulacak kalan yok`)
    setBarkodId(null); setAdaylar(null); setSecili({ rezerv: r, kalan }); setMiktar(String(kalan))
  }

  // Satır başına okutulan (Hub, raporlanmamış) — rezerv satırı parça eşleşmesiyle.
  const okutulanParca = (partNo: string) => okutulan.filter((o) => o.partNo === partNo).reduce((t, o) => t + o.miktar, 0)
  const acikRezervler = (partNo: string): RezervSatiri[] =>
    sevkiyat?.rezervler.filter((r) => r.partNo === partNo && r.locationNo !== sevkiyat.sevkLok && r.rezerve > r.toplanan) ?? []
  const okutulanToplam = okutulan.reduce((t, o) => t + o.miktar, 0)
  const eksikVar = !!sevkiyat && sevkiyat.satirlar.some((s) => s.toplanan + okutulanParca(s.partNo) < s.istenen)

  const geriAlYap = async () => {
    if (!sevkiyat || !geriAl) return
    const lok = geriAl.lokasyon.trim()
    if (!lok) return showError('Geri alınacak lokasyonu girin')
    const g = geriAl
    setGeriAl(null)
    const d = await api(`/api/depo/sevkiyat/${sevkiyat.id}/geri-al`, json('POST', { keyref: g.rezerv.keyref, miktar: g.miktar, hedefLok: lok }))
    if (!d) return
    setInfo(`${g.rezerv.partNo} · ${fmt(g.miktar)} ${g.birim} ${lok}'a geri alındı`)
    await detayYukle(sevkiyat.id)
  }

  const alan: Alan = gorunum === 'LISTE' ? 'SEVKIYAT_NO' : gorunum === 'DETAY' && !onayAcik && !geriAl ? 'MALZEME' : null
  const dispatch = async (v: string, kaynak: EtiketKaynak) => {
    const s = v.trim()
    if (!s || !alan) return
    if (alan === 'SEVKIYAT_NO') {
      if (!/^\d+$/.test(s)) return showError(`Geçersiz sevkiyat no: ${s}`)
      return void sevkiyatAc(Number(s))
    }
    return void malzemeOkut(s, kaynak)
  }
  const { inputProps } = useScanner(!!alan && !manualOpen && !loading, (v) => void dispatch(v, 'okutma'))
  const submitManual = () => {
    const v = manualVal.trim()
    if (!v) return
    setManualVal(''); setManualOpen(false)
    void dispatch(v, 'elle')
  }

  return (
    <div className="flex flex-1 flex-col gap-3 py-2">
      <input {...inputProps} />

      <div className="flex items-center gap-2 pt-1">
        <button type="button" onClick={() => (gorunum === 'LISTE' ? router.push('/terminal/depo') : (setGorunum('LISTE'), setSevkiyat(null), okutmaKapat(), setListe(null)))}
          aria-label="Geri" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors active:bg-muted/70">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-col leading-tight">
          <h1 className="text-base font-semibold">Sevkiyat</h1>
          {sevkiyat && gorunum === 'DETAY' && <span className="truncate text-xs text-muted-foreground">No {sevkiyat.id} · {sevkiyat.aliciAdi || sevkiyat.aliciNo}</span>}
        </div>
      </div>

      {errorMsg && <div key={errorKey} className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{errorMsg}</div>}
      {info && <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{info}</div>}

      {alan && (
        <>
          <div className="flex items-center gap-3 rounded-2xl border p-3" style={{ borderColor: TERMINAL_ACCENT, background: `${TERMINAL_ACCENT}0D` }}>
            <ScanLine className="h-6 w-6 shrink-0" style={{ color: TERMINAL_ACCENT }} />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-sm font-semibold" style={{ color: TERMINAL_ACCENT }}>{alan === 'SEVKIYAT_NO' ? 'Sevkiyat no okut' : 'Malzeme barkodu okut'}</div>
              <div className="truncate text-xs text-muted-foreground">{alan === 'SEVKIYAT_NO' ? 'ya da listeden seçin' : 'parça ve lot rezervle eşleşmeli · barkod yoksa "Git →" satırına dokun'}</div>
            </div>
          </div>
          {manualOpen ? (
            <div className="flex w-full gap-2">
              <input autoFocus value={manualVal} onChange={(e) => setManualVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitManual()}
                inputMode={alan === 'SEVKIYAT_NO' ? 'numeric' : undefined} placeholder={alan === 'SEVKIYAT_NO' ? 'Sevkiyat no' : 'Stok no'}
                className="h-11 flex-1 rounded-xl border bg-background px-3 text-base outline-none focus:ring-1 focus:ring-ring" />
              <button type="button" onClick={submitManual} className="h-11 rounded-xl px-4 text-sm font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>Getir</button>
            </div>
          ) : (
            <button type="button" onClick={() => setManualOpen(true)} className="self-center text-sm text-muted-foreground underline underline-offset-2">veya elle gir</button>
          )}
        </>
      )}

      {loading && <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> IFS ile işlem yapılıyor…</div>}

      {/* LİSTE */}
      {gorunum === 'LISTE' && !loading && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-muted-foreground">Bekleyen sevkiyatlar</div>
            <button type="button" onClick={() => void listeYukle()} aria-label="Yenile" className="flex h-8 w-8 items-center justify-center rounded-lg border"><RefreshCw className="h-4 w-4" /></button>
          </div>
          {liste === null ? null : liste.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">Bekleyen sevkiyat yok</div>
          ) : (
            liste.map((s) => {
              const oran = s.istenenToplam ? Math.min(100, Math.round((s.toplananToplam / s.istenenToplam) * 100)) : 0
              return (
                <button key={s.id} type="button" onClick={() => void sevkiyatAc(s.id)} className="flex flex-col gap-1.5 rounded-2xl border bg-card p-3 text-left active:opacity-70" style={{ borderColor: TERMINAL_ACCENT }}>
                  <div className="flex items-center justify-between"><span className="font-semibold">Sevkiyat {s.id}</span><span className="text-xs text-muted-foreground">{s.satirSayisi} satır</span></div>
                  <div className="truncate text-xs text-muted-foreground">{s.aliciAdi || s.aliciNo}</div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${oran}%`, background: TERMINAL_ACCENT }} /></div>
                  <div className="text-[11px] text-muted-foreground">toplanan {fmt(s.toplananToplam)} / {fmt(s.istenenToplam)}</div>
                </button>
              )
            })
          )}
        </div>
      )}

      {/* DETAY */}
      {gorunum === 'DETAY' && sevkiyat && !loading && (
        <div className="flex flex-col gap-3">
          {eksikRezerv.length > 0 && (
            <div className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Rezerv yetersiz: {eksikRezerv.map((e) => `${e.partNo} eksik ${fmt(e.eksik)}`).join(', ')}</span>
            </div>
          )}

          {adaylar && (
            <div className="flex flex-col gap-2">
              <div className="text-sm font-semibold" style={{ color: TERMINAL_ACCENT }}>Hangi rezerv satırı?</div>
              {adaylar.map((a, i) => (
                <button key={i} type="button" onClick={() => { setSecili(a); setAdaylar(null); setMiktar(String(a.kalan)) }} className="rounded-2xl border bg-card p-3 text-left" style={{ borderColor: TERMINAL_ACCENT }}>
                  <div className="font-semibold">{a.rezerv.partNo} <span className="text-xs font-normal text-muted-foreground">lot {tire(a.rezerv.lotBatchNo)}</span></div>
                  <div className="text-xs text-muted-foreground">Git → {a.rezerv.locationNo} · kalan {fmt(a.kalan)}</div>
                </button>
              ))}
            </div>
          )}

          {secili && (
            <div className="flex flex-col gap-2 rounded-2xl border p-3" style={{ borderColor: TERMINAL_ACCENT }}>
              <div className="font-semibold">{secili.rezerv.partNo} <span className="text-xs font-normal text-muted-foreground">lot {tire(secili.rezerv.lotBatchNo)} · {secili.rezerv.locationNo}</span></div>
              <div className="text-xs text-muted-foreground">kalan {fmt(secili.kalan)}</div>
              <div className="flex gap-2">
                <input value={miktar} onChange={(e) => setMiktar(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void ekle()} inputMode="decimal"
                  className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-3 text-base outline-none" />
                <button type="button" onClick={() => void ekle()} className="h-11 rounded-xl px-5 text-sm font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>EKLE</button>
              </div>
              <button type="button" onClick={okutmaKapat} className="self-center text-xs text-muted-foreground underline">vazgeç</button>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {sevkiyat.satirlar.map((s) => {
              const ok = okutulanParca(s.partNo)
              const rez = acikRezervler(s.partNo)
              return (
                <div key={s.lineNo} className="flex flex-col gap-1 rounded-2xl border bg-card p-3">
                  <div className="flex items-center justify-between"><span className="font-semibold">{s.partNo}</span>{s.toplanan >= s.istenen && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">TOPLANDI</span>}</div>
                  {s.partAdi && <div className="truncate text-xs text-muted-foreground">{s.partAdi}</div>}
                  <div className="grid grid-cols-3 gap-1 text-center text-xs">
                    <div><div className="text-muted-foreground">İstenen</div><b>{fmt(s.istenen)} {s.birim}</b></div>
                    <div><div className="text-muted-foreground">Okutulan</div><b style={{ color: TERMINAL_ACCENT }}>{fmt(ok)}</b></div>
                    <div><div className="text-muted-foreground">Toplanan</div><b>{fmt(s.toplanan)}</b></div>
                  </div>
                  {rez.map((r, i) => (
                    <button key={i} type="button" onClick={() => rezervSec(r)} className="flex items-center gap-1 rounded-lg border px-2 py-1.5 text-left text-xs font-semibold active:bg-muted/70">
                      <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: TERMINAL_ACCENT }} /> Git → {r.locationNo} <span className="font-normal text-muted-foreground">· lot {tire(r.lotBatchNo)} · rezerve {fmt(r.rezerve - r.toplanan)}</span>
                    </button>
                  ))}
                  {/* Toplanmış (raporlanmış) satırlar — sevk lokasyonundan rezerv lokasyonuna geri al */}
                  {geriAlinabilir.filter((g) => g.rezerv.partNo === s.partNo).flatMap((g) =>
                    (g.hedefler.length ? g.hedefler : [{ lokasyon: '', miktar: g.rezerv.toplanan }]).map((h, j) => (
                      <div key={`${g.rezerv.keyref}-${j}`} className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50/60 px-2 py-1.5 text-xs">
                        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
                        <span className="min-w-0 flex-1">
                          Toplandı <b>{fmt(h.miktar)} {s.birim}</b> · {g.rezerv.locationNo}{h.lokasyon ? ` ← ${h.lokasyon}` : ''} · lot {tire(g.rezerv.lotBatchNo)}
                        </span>
                        <button type="button" onClick={() => setGeriAl({ rezerv: g.rezerv, lokasyon: h.lokasyon, miktar: h.miktar, birim: s.birim })}
                          className="flex shrink-0 items-center gap-1 rounded-lg border border-red-300 bg-background px-2 py-1 font-semibold text-red-700 active:bg-red-50">
                          <Undo2 className="h-3.5 w-3.5" /> Geri Al
                        </button>
                      </div>
                    )),
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-sm font-semibold text-muted-foreground">Okutulanlar ({okutulan.length})</div>
            {okutulan.length === 0 && <div className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">Henüz okutma yok</div>}
            {okutulan.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2 rounded-xl border p-2">
                <div className="min-w-0 text-sm"><b>{o.partNo}</b> <span className="text-xs text-muted-foreground">· {o.lokasyon} · lot {tire(o.lotBatchNo)}{o.barkodId ? ` · barkod ${o.barkodId}` : ''}</span></div>
                <div className="flex shrink-0 items-center gap-2">
                  <b className="text-sm" style={{ color: TERMINAL_ACCENT }}>{fmt(o.miktar)}</b>
                  <button type="button" onClick={() => void sil(o)} aria-label="Sil" className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-300 text-red-700"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>

          {lokasyonlar.length > 1 && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Sevk lokasyonu</span>
              <select value={sevkLok} onChange={(e) => setSevkLok(e.target.value)} className="h-10 rounded-lg border bg-background px-2 text-base">
                <option value="">Seçin</option>
                {lokasyonlar.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
          )}
          <button type="button" onClick={() => setOnayAcik(true)} disabled={!okutulan.length || !sevkLok}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl text-base font-semibold text-white disabled:opacity-40" style={{ background: TERMINAL_ACCENT }}>
            <Check className="h-5 w-5" /> TOPLAMAYI BİTİR
          </button>
        </div>
      )}

      {/* ÖZET */}
      {gorunum === 'OZET' && ozet && !loading && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border p-5 text-center" style={{ borderColor: TERMINAL_ACCENT }}>
          <div className="text-sm text-muted-foreground">Sevkiyat {ozet.id}</div>
          <div className="text-2xl font-bold" style={{ color: ozet.hata ? undefined : TERMINAL_ACCENT }}>{ozet.hata ? 'Kısmen raporlandı' : 'Toplama raporlandı'}</div>
          <div className="text-sm">toplanan {fmt(ozet.toplanan)} / {fmt(ozet.istenen)}{ozet.hata ? ` · ${ozet.hata} satır hatalı` : ''}</div>
          <button type="button" onClick={() => { setOzet(null); setSevkiyat(null); setGorunum('LISTE') }} className="h-11 w-full rounded-xl text-sm font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>Sevkiyatlara dön</button>
        </div>
      )}

      {geriAl && sevkiyat && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={() => setGeriAl(null)}>
          <div className="w-full max-w-md rounded-2xl bg-background p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-semibold">
              {fmt(geriAl.miktar)} {geriAl.birim} sevk lokasyonundan ({geriAl.rezerv.locationNo}) {geriAl.lokasyon || '…'}&apos;a geri alınacak
            </div>
            <div className="mt-1 text-sm text-muted-foreground">{geriAl.rezerv.partNo} · lot {tire(geriAl.rezerv.lotBatchNo)} · rezervi de düşer. Sevkiyat iptal edilmez.</div>
            {/* Terminalden okutulmamış (IFS'te toplanmış) satır: dönüş lokasyonu Hub'da yok → elle girilir */}
            {!geriAlinabilir.some((g) => g.rezerv.keyref === geriAl.rezerv.keyref && g.hedefler.length) && (
              <input autoFocus value={geriAl.lokasyon} onChange={(e) => setGeriAl({ ...geriAl, lokasyon: e.target.value })} placeholder="Geri alınacak lokasyon"
                className="mt-3 h-11 w-full rounded-xl border bg-background px-3 text-base outline-none focus:ring-1 focus:ring-ring" />
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setGeriAl(null)} className="h-11 rounded-xl border text-sm font-semibold">Vazgeç</button>
              <button type="button" onClick={() => void geriAlYap()} disabled={!geriAl.lokasyon.trim()} className="h-11 rounded-xl bg-red-600 text-sm font-semibold text-white disabled:opacity-40">GERİ AL</button>
            </div>
          </div>
        </div>
      )}

      {onayAcik && sevkiyat && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-background p-4 shadow-lg">
            <div className="text-base font-semibold">{new Set(okutulan.map((o) => o.satirAnahtari)).size} satır, toplam {fmt(okutulanToplam)}; sevk lok {sevkLok}</div>
            {eksikVar && (
              <div className={cn('mt-2 flex gap-2 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-900')}>
                <AlertTriangle className="h-4 w-4 shrink-0" /> Eksik satırların kalan rezervi IFS&apos;te düşer.
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setOnayAcik(false)} className="h-11 rounded-xl border text-sm font-semibold">Vazgeç</button>
              <button type="button" onClick={() => void bitir()} className="h-11 rounded-xl text-sm font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>BİTİR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
