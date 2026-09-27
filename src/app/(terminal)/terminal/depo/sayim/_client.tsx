'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Check, Loader2, Lock, MapPin, RefreshCw, ScanLine, Snowflake } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScanner } from '@/lib/depo/use-scanner'
import type { EtiketKaynak } from '@/lib/depo/etiket-parse'
import { TERMINAL_ACCENT } from '../../_shared'
import type { FarkDurumu, SayimRaporu, SayimRaporuOzet, SayimSatiri } from '@/lib/ifs/sayim'

type Gorunum = 'LISTE' | 'DETAY'
// Okutma ALAN BAZLI: listede rapor no; detayda önce lokasyon, sonra malzeme barkodu.
type Alan = 'RAPOR_NO' | 'LOKASYON' | 'MALZEME' | null

const fmt = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 4 })
const tire = (v: string | null) => (!v || v === '*' ? '—' : v)
const RAPOR_DISI = 'raporda yok — ofise bildirin'

const FARK: Record<FarkDurumu, { etiket: string; sinif: string }> = {
  esit: { etiket: 'EŞİT', sinif: 'bg-emerald-100 text-emerald-800' },
  fazla: { etiket: 'FAZLA', sinif: 'bg-sky-100 text-sky-800' },
  eksik: { etiket: 'EKSİK', sinif: 'bg-amber-100 text-amber-900' },
}

export function SayimClient() {
  const router = useRouter()
  const [gorunum, setGorunum] = useState<Gorunum>('LISTE')
  const [liste, setListe] = useState<SayimRaporuOzet[] | null>(null)
  const [rapor, setRapor] = useState<SayimRaporu | null>(null)
  const [lokasyon, setLokasyon] = useState<string | null>(null)
  const [adaylar, setAdaylar] = useState<SayimSatiri[] | null>(null)
  const [secili, setSecili] = useState<SayimSatiri | null>(null)
  const [miktar, setMiktar] = useState('')
  const [uyari, setUyari] = useState<string | null>(null)

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

  const listeYukle = useCallback(async () => {
    const d = await api('/api/depo/sayim')
    if (d) setListe((d.raporlar ?? []) as SayimRaporuOzet[])
  }, [api])
  useEffect(() => { if (gorunum === 'LISTE' && liste === null) void listeYukle() }, [gorunum, liste, listeYukle])

  const satirKapat = useCallback(() => { setAdaylar(null); setSecili(null); setMiktar('') }, [])

  const raporYukle = useCallback(async (no: string) => {
    const d = await api(`/api/depo/sayim/${encodeURIComponent(no)}`)
    if (!d) return null
    const r = d.rapor as SayimRaporu
    setRapor(r)
    return r
  }, [api])

  const raporAc = async (no: string) => {
    satirKapat(); setLokasyon(null); setUyari(null)
    if (await raporYukle(no)) setGorunum('DETAY')
  }

  const lokSatirlari = rapor && lokasyon ? rapor.satirlar.filter((s) => s.locationNo === lokasyon) : []
  const lokasyonlar = rapor
    ? [...new Set(rapor.satirlar.map((s) => s.locationNo))].map((l) => {
      const ss = rapor.satirlar.filter((s) => s.locationNo === l)
      return { lok: l, sayilan: ss.filter((s) => s.sayilan != null).length, toplam: ss.length }
    })
    : []

  const lokasyonSec = (v: string) => {
    if (!rapor) return
    satirKapat()
    const l = rapor.satirlar.find((s) => s.locationNo.toUpperCase() === v.toUpperCase())?.locationNo
    if (!l) { setUyari(`Lokasyon ${v} bu ${RAPOR_DISI}`); return showError(`Lokasyon ${v} raporda yok`) }
    setUyari(null)
    setLokasyon(l)
  }

  const satirSec = (s: SayimSatiri) => {
    if (s.onayli) return showError('Onaylı satır değiştirilemez')
    setAdaylar(null); setSecili(s); setMiktar('')
  }

  const malzemeOkut = async (v: string, kaynak: EtiketKaynak) => {
    if (!rapor || !lokasyon) return
    const p = new URLSearchParams({ okut: v, kaynak })
    const d = await api(`/api/depo/sayim/${encodeURIComponent(rapor.no)}/coz?${p.toString()}`)
    if (!d) return
    const partNo = String(d.partNo)
    const lot = (d.lotBatchNo as string | null) ?? null
    const eslesen = lokSatirlari.filter((s) => s.partNo === partNo && (lot == null || s.lotBatchNo === lot))
    if (!eslesen.length) {
      setUyari(`${partNo}${lot ? ` lot ${lot}` : ''} · lokasyon ${lokasyon}: bu malzeme ${RAPOR_DISI}`)
      return showError('Malzeme bu lokasyonda raporda yok')
    }
    setUyari(null)
    if (eslesen.length === 1) satirSec(eslesen[0])
    else { setSecili(null); setAdaylar(eslesen) }
  }

  const sonucYaz = async (govde: { seq: number; miktar: number } | { seq: number; ayni: true }) => {
    if (!rapor || !secili) return
    const d = await api(`/api/depo/sayim/${encodeURIComponent(rapor.no)}/say`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde),
    })
    if (!d) return
    const s = d.sonuc as { sayilan: number; fark: FarkDurumu | null }
    setInfo(`${secili.partNo} · ${secili.locationNo} sayıldı: ${fmt(s.sayilan)}${s.fark ? ` · ${FARK[s.fark].etiket}` : ''}`)
    satirKapat()
    await raporYukle(rapor.no)
  }

  const kaydet = () => {
    if (!secili) return
    const t = miktar.trim().replace(',', '.')
    const m = Number(t)
    if (!t || !Number.isFinite(m) || m < 0) return showError('Geçerli bir miktar girin (0 dahil)')
    void sonucYaz({ seq: secili.seq, miktar: m })
  }

  const alan: Alan = gorunum === 'LISTE' ? 'RAPOR_NO' : gorunum === 'DETAY' && !secili ? (lokasyon ? 'MALZEME' : 'LOKASYON') : null
  const dispatch = async (v: string, kaynak: EtiketKaynak) => {
    const s = v.trim()
    if (!s || !alan) return
    if (alan === 'RAPOR_NO') {
      if (!/^[A-Za-z0-9_-]{1,20}$/.test(s)) return showError(`Geçersiz rapor no: ${s}`)
      return void raporAc(s)
    }
    if (alan === 'LOKASYON') return lokasyonSec(s)
    return void malzemeOkut(s, kaynak)
  }
  const { inputProps } = useScanner(!!alan && !manualOpen && !loading, (v) => void dispatch(v, 'okutma'))
  const submitManual = () => {
    const v = manualVal.trim()
    if (!v) return
    setManualVal(''); setManualOpen(false)
    void dispatch(v, 'elle')
  }

  const geri = () => {
    if (gorunum === 'LISTE') return router.push('/terminal/depo')
    if (secili || adaylar) return satirKapat()
    if (lokasyon) { setLokasyon(null); setUyari(null); return }
    setGorunum('LISTE'); setRapor(null); setUyari(null); setListe(null)
  }

  const ALAN_METNI: Record<Exclude<Alan, null>, [string, string, string]> = {
    RAPOR_NO: ['Sayım raporu no okut', 'ya da listeden seçin', 'Rapor no'],
    LOKASYON: ['Lokasyon okut', 'ya da aşağıdan seçin', 'Lokasyon'],
    MALZEME: ['Malzeme barkodu okut', `lokasyon ${lokasyon ?? ''} · parça ve lot eşleşmeli`, 'Stok no'],
  }

  return (
    <div className="flex flex-1 flex-col gap-3 py-2">
      <input {...inputProps} />

      <div className="flex items-center gap-2 pt-1">
        <button type="button" onClick={geri} aria-label="Geri" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors active:bg-muted/70">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-col leading-tight">
          <h1 className="text-base font-semibold">Sayım</h1>
          {rapor && gorunum === 'DETAY' && (
            <span className="truncate text-xs text-muted-foreground">Rapor {rapor.no} · {rapor.ambar || '—'} · {rapor.sayilan}/{rapor.toplam} sayıldı{rapor.dondurulmus ? ' · dondurulmuş' : ''}</span>
          )}
        </div>
      </div>

      {errorMsg && <div key={errorKey} className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{errorMsg}</div>}
      {info && <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{info}</div>}
      {uyari && (
        <div className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0" /><span>{uyari}</span>
        </div>
      )}

      {alan && (
        <>
          <div className="flex items-center gap-3 rounded-2xl border p-3" style={{ borderColor: TERMINAL_ACCENT, background: `${TERMINAL_ACCENT}0D` }}>
            <ScanLine className="h-6 w-6 shrink-0" style={{ color: TERMINAL_ACCENT }} />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-sm font-semibold" style={{ color: TERMINAL_ACCENT }}>{ALAN_METNI[alan][0]}</div>
              <div className="truncate text-xs text-muted-foreground">{ALAN_METNI[alan][1]}</div>
            </div>
          </div>
          {manualOpen ? (
            <div className="flex w-full gap-2">
              <input autoFocus value={manualVal} onChange={(e) => setManualVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitManual()}
                placeholder={ALAN_METNI[alan][2]}
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
            <div className="text-sm font-semibold text-muted-foreground">Açık sayım raporları</div>
            <button type="button" onClick={() => void listeYukle()} aria-label="Yenile" className="flex h-8 w-8 items-center justify-center rounded-lg border"><RefreshCw className="h-4 w-4" /></button>
          </div>
          {liste === null ? null : liste.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">Sayılacak rapor yok</div>
          ) : (
            liste.map((r) => {
              const oran = r.toplam ? Math.min(100, Math.round((r.sayilan / r.toplam) * 100)) : 0
              return (
                <button key={r.no} type="button" onClick={() => void raporAc(r.no)} className="flex flex-col gap-1.5 rounded-2xl border bg-card p-3 text-left active:opacity-70" style={{ borderColor: TERMINAL_ACCENT }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">Rapor {r.no}</span>
                    {r.dondurulmus && <span className="flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800"><Snowflake className="h-3 w-3" /> DONDURULMUŞ</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">Ambar {r.ambar || '—'}</div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${oran}%`, background: TERMINAL_ACCENT }} /></div>
                  <div className="text-[11px] text-muted-foreground">{r.sayilan}/{r.toplam} sayıldı</div>
                </button>
              )
            })
          )}
        </div>
      )}

      {/* DETAY — lokasyon seçimi */}
      {gorunum === 'DETAY' && rapor && !lokasyon && !loading && (
        <div className="flex flex-col gap-2">
          <div className="text-sm font-semibold text-muted-foreground">Lokasyonlar</div>
          <div className="grid grid-cols-2 gap-2">
            {lokasyonlar.map((l) => (
              <button key={l.lok} type="button" onClick={() => lokasyonSec(l.lok)} className="flex flex-col gap-0.5 rounded-2xl border bg-card p-3 text-left active:opacity-70"
                style={{ borderColor: l.sayilan >= l.toplam ? undefined : TERMINAL_ACCENT }}>
                <span className="flex items-center gap-1 font-semibold"><MapPin className="h-3.5 w-3.5" /> {l.lok}</span>
                <span className="text-[11px] text-muted-foreground">{l.sayilan}/{l.toplam} sayıldı</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* DETAY — lokasyondaki satırlar */}
      {gorunum === 'DETAY' && rapor && lokasyon && !loading && (
        <div className="flex flex-col gap-3">
          {adaylar && (
            <div className="flex flex-col gap-2">
              <div className="text-sm font-semibold" style={{ color: TERMINAL_ACCENT }}>Hangi satır?</div>
              {adaylar.map((s) => (
                <button key={s.seq} type="button" onClick={() => satirSec(s)} className="rounded-2xl border bg-card p-3 text-left" style={{ borderColor: TERMINAL_ACCENT }}>
                  <div className="font-semibold">{s.partNo} <span className="text-xs font-normal text-muted-foreground">lot {tire(s.lotBatchNo)}{s.handlingUnitId ? ` · TB ${s.handlingUnitId}` : ''}</span></div>
                  {s.partAdi && <div className="truncate text-xs text-muted-foreground">{s.partAdi}</div>}
                </button>
              ))}
            </div>
          )}

          {secili && (
            <div className="flex flex-col gap-2 rounded-2xl border p-3" style={{ borderColor: TERMINAL_ACCENT }}>
              <div className="font-semibold">{secili.partNo} <span className="text-xs font-normal text-muted-foreground">lot {tire(secili.lotBatchNo)} · {secili.locationNo}{secili.handlingUnitId ? ` · TB ${secili.handlingUnitId}` : ''}</span></div>
              {secili.partAdi && <div className="truncate text-xs text-muted-foreground">{secili.partAdi}</div>}
              {secili.sayilan != null && <div className="text-xs text-muted-foreground">önceki sayım {fmt(secili.sayilan)} — yeni değer üzerine yazar</div>}
              <div className="flex gap-2">
                <input autoFocus value={miktar} onChange={(e) => setMiktar(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && kaydet()} inputMode="decimal" placeholder="Sayılan miktar"
                  className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-3 text-base outline-none" />
                <button type="button" onClick={kaydet} className="h-11 rounded-xl px-5 text-sm font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>KAYDET</button>
              </div>
              {rapor.dondurulmus && (
                <button type="button" onClick={() => void sonucYaz({ seq: secili.seq, ayni: true })}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold" style={{ borderColor: TERMINAL_ACCENT, color: TERMINAL_ACCENT }}>
                  <Check className="h-4 w-4" /> Sistemdekiyle aynı
                </button>
              )}
              <button type="button" onClick={satirKapat} className="self-center text-xs text-muted-foreground underline">vazgeç</button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-sm font-semibold text-muted-foreground"><MapPin className="h-4 w-4" /> {lokasyon} · {lokSatirlari.filter((s) => s.sayilan != null).length}/{lokSatirlari.length} sayıldı</div>
            <button type="button" onClick={() => { setLokasyon(null); satirKapat(); setUyari(null) }} className="text-xs text-muted-foreground underline">lokasyon değiştir</button>
          </div>
          {lokSatirlari.map((s) => (
            <button key={s.seq} type="button" onClick={() => satirSec(s)} disabled={s.onayli}
              className={cn('flex flex-col gap-1 rounded-2xl border bg-card p-3 text-left', s.onayli ? 'opacity-60' : 'active:opacity-70', secili?.seq === s.seq && 'ring-2')}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{s.partNo}</span>
                {s.onayli ? (
                  <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"><Lock className="h-3 w-3" /> ONAYLI</span>
                ) : s.fark ? (
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', FARK[s.fark].sinif)}>{FARK[s.fark].etiket}</span>
                ) : s.sayilan == null ? (
                  <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">SAYILMADI</span>
                ) : null}
              </div>
              {s.partAdi && <div className="truncate text-xs text-muted-foreground">{s.partAdi}</div>}
              <div className="text-xs text-muted-foreground">
                lot {tire(s.lotBatchNo)}{s.serialNo !== '*' ? ` · seri ${s.serialNo}` : ''}{s.handlingUnitId ? ` · TB ${s.handlingUnitId}` : ''}
                {s.sayilan != null && <> · sayılan <b className="text-foreground">{fmt(s.sayilan)}</b></>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
