'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Loader2, MapPin, RefreshCw, ScanLine, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScanner } from '@/lib/depo/use-scanner'
import type { EtiketKaynak } from '@/lib/depo/etiket-parse'
import { TERMINAL_ACCENT } from '../../_shared'
import type { SeciliStok, Talep, TalepMalzeme, TalepOzet, TalepStokSatiri } from '@/lib/ifs/transfer-talebi'
import type { StokBilgisiSatir } from '@/lib/ifs/stok-bilgisi'

type Gorunum = 'LISTE' | 'DETAY' | 'OZET'
type Sekme = 'ISTENEN' | 'EKLENEN'
// Okutma ALAN BAZLI — değer o an beklenen alana gider.
type Alan = 'TALEP_NO' | 'LOKASYON' | 'MALZEME' | null

const fmt = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 3 })
const tire = (v: string) => (!v || v === '*' ? '—' : v)
const kimlik = (s: StokBilgisiSatir): TalepStokSatiri => ({
  partNo: s.partNo, locationNo: s.lokasyonNo, lotBatchNo: s.lot || '*', serialNo: s.seri || '*', engChgLevel: s.muhSeviye || '*',
  waivDevRejNo: s.waivDevRejNo || '*', configurationId: s.konfigurasyon || '*', activitySeq: s.aktiviteSira, handlingUnitId: s.tasimaBirimi,
})

export function TransferTalebiClient() {
  const router = useRouter()
  const [gorunum, setGorunum] = useState<Gorunum>('LISTE')
  const [sekme, setSekme] = useState<Sekme>('ISTENEN')
  const [liste, setListe] = useState<TalepOzet[] | null>(null)
  const [talep, setTalep] = useState<Talep | null>(null)
  const [satir, setSatir] = useState<TalepMalzeme | null>(null)
  const [lokasyon, setLokasyon] = useState('')
  const [adaylar, setAdaylar] = useState<StokBilgisiSatir[] | null>(null)
  const [secili, setSecili] = useState<StokBilgisiSatir | null>(null)
  const [miktar, setMiktar] = useState('')
  const [onayAcik, setOnayAcik] = useState(false)
  const [ozet, setOzet] = useState<{ no: number; durum: string; hedef: string; kalem: number } | null>(null)

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
      if (!res.ok || !data?.ok) {
        const eks = (data?.eksikler ?? []) as TalepMalzeme[]
        showError(eks.length ? `${data?.error}: ${eks.map((e) => `${e.partNo} kalan ${fmt(e.kalan)}`).join(', ')}` : data?.error ?? 'İşlem başarısız')
        return null
      }
      return data
    } catch {
      showError('Bağlantı hatası — tekrar deneyin')
      return null
    } finally {
      setLoading(false)
    }
  }, [showError])
  const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

  const listeYukle = useCallback(async () => {
    const d = await api('/api/depo/transfer-talebi')
    if (d) setListe((d.talepler ?? []) as TalepOzet[])
  }, [api])
  useEffect(() => { if (gorunum === 'LISTE' && liste === null) void listeYukle() }, [gorunum, liste, listeYukle])

  const satirKapat = useCallback(() => {
    setSatir(null); setLokasyon(''); setAdaylar(null); setSecili(null); setMiktar('')
  }, [])

  const talepAc = useCallback(async (no: number, gorunumeGec = true) => {
    const d = await api(`/api/depo/transfer-talebi/${no}`)
    if (!d) return
    setTalep(d.talep as Talep)
    if (gorunumeGec) { satirKapat(); setSekme('ISTENEN'); setGorunum('DETAY') }
  }, [api, satirKapat])

  const lokasyonOkut = async (v: string) => {
    if (!satir || !talep) return
    if (v === talep.hedefLok) return showError(`Hedef lokasyon ${v} — kaynak farklı olmalı`)
    const d = await api(`/api/depo/transfer-talebi/stok?lokasyon=${encodeURIComponent(v)}&partNo=${encodeURIComponent(satir.partNo)}`)
    if (!d) return
    if (!Number(d.toplam)) return showError(`${v} lokasyonunda ${satir.partNo} yok`)
    setLokasyon(v)
  }
  const malzemeOkut = async (v: string, kaynak: EtiketKaynak) => {
    if (!satir) return
    const p = new URLSearchParams({ lokasyon, okut: v, kaynak, partNo: satir.partNo })
    const d = await api(`/api/depo/transfer-talebi/stok?${p.toString()}`)
    if (!d) return
    const s = (d.satirlar ?? []) as StokBilgisiSatir[]
    if (!s.length) return showError(d.baskaParca ? `Okutulan malzeme ${satir.partNo} değil` : `${lokasyon} lokasyonunda kullanılabilir bulunamadı: ${v}`)
    const sec = (x: StokBilgisiSatir) => { setSecili(x); setAdaylar(null); setMiktar(String(Math.min(satir.kalan, x.kullanilabilir))) }
    if (s.length === 1) sec(s[0])
    else { setAdaylar(s); setSecili(null) }
  }

  const ekle = async () => {
    if (!talep || !satir || !secili) return
    const m = Number(miktar.replace(',', '.'))
    const ust = Math.min(satir.kalan, secili.kullanilabilir)
    if (!(m > 0) || m > ust) return showError(`Miktar 0 ile ${fmt(ust)} arasında olmalı`)
    const d = await api(`/api/depo/transfer-talebi/${talep.no}/bagla`, json({
      satir: { partNo: satir.partNo, configurationId: satir.configurationId, activitySeq: satir.activitySeq }, stok: kimlik(secili), miktar: m,
    }))
    if (!d) return
    setInfo(`${secili.partNo} · ${fmt(m)} ${satir.birim} bağlandı (${secili.lokasyonNo})`)
    satirKapat()
    await talepAc(talep.no, false)
  }

  const kaldir = async (s: SeciliStok) => {
    if (!talep) return
    const d = await api(`/api/depo/transfer-talebi/${talep.no}/kaldir`, json({ taskId: s.taskId, lineNo: s.lineNo }))
    if (!d) return
    setInfo(`${s.partNo} · ${fmt(s.miktar)} kaldırıldı`)
    await talepAc(talep.no, false)
  }

  const transfer = async () => {
    if (!talep) return
    setOnayAcik(false)
    const d = await api(`/api/depo/transfer-talebi/${talep.no}/transfer`, { method: 'POST' })
    if (!d) return
    setOzet({ no: talep.no, durum: String(d.durum ?? ''), hedef: talep.hedefLok, kalem: talep.seciliStoklar.length })
    setListe(null)
    setGorunum('OZET')
  }

  const islenebilir = talep?.durum === 'Approved' || talep?.durum === 'Prepared'
  const tamam = !!talep && talep.malzemeler.length > 0 && talep.malzemeler.every((m) => m.kalan === 0)
  const alan: Alan = (() => {
    if (gorunum === 'LISTE') return 'TALEP_NO'
    if (gorunum === 'DETAY' && sekme === 'ISTENEN' && satir && !onayAcik) return lokasyon ? 'MALZEME' : 'LOKASYON'
    return null
  })()
  const dispatch = async (v: string, kaynak: EtiketKaynak) => {
    const s = v.trim()
    if (!s || !alan) return
    if (alan === 'TALEP_NO') {
      if (!/^\d+$/.test(s)) return showError(`Geçersiz talep no: ${s}`)
      return void talepAc(Number(s))
    }
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
    TALEP_NO: { baslik: 'Talep no okut', alt: 'ya da listeden seçin' },
    LOKASYON: { baslik: 'Kaynak lokasyonu okut', alt: `${satir?.partNo ?? ''} alınacak raf` },
    MALZEME: { baslik: 'Malzeme barkodu okut', alt: `${satir?.partNo ?? ''} · lokasyon ${lokasyon}` },
  }

  return (
    <div className="flex flex-1 flex-col gap-3 py-2">
      <input {...inputProps} />

      <div className="flex items-center gap-2 pt-1">
        <button type="button" onClick={() => (gorunum === 'LISTE' ? router.push('/terminal/depo') : (setGorunum('LISTE'), setTalep(null), satirKapat(), setListe(null)))} aria-label="Geri"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors active:bg-muted/70">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-col leading-tight">
          <h1 className="text-base font-semibold">Transfer Talebi</h1>
          {talep && gorunum === 'DETAY' && (
            <span className="truncate text-xs text-muted-foreground">Talep {talep.no} · {talep.durum} · → {talep.hedefLok}{talep.isEmriNo ? ` · İE ${talep.isEmriNo}` : ''}</span>
          )}
        </div>
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
              <button type="button" onClick={() => { setLokasyon(''); setAdaylar(null); setSecili(null) }} className="flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold">
                <MapPin className="h-3.5 w-3.5" /> {lokasyon} <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {manualOpen ? (
            <div className="flex w-full gap-2">
              <input autoFocus value={manualVal} onChange={(e) => setManualVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitManual()}
                inputMode={alan === 'TALEP_NO' ? 'numeric' : undefined} placeholder={alan === 'TALEP_NO' ? 'Talep no' : alan === 'MALZEME' ? 'Stok no' : 'Lokasyon'}
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
            <div className="text-sm font-semibold text-muted-foreground">Bekleyen talepler</div>
            <button type="button" onClick={() => void listeYukle()} aria-label="Yenile" className="flex h-8 w-8 items-center justify-center rounded-lg border"><RefreshCw className="h-4 w-4" /></button>
          </div>
          {liste === null ? null : liste.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">Bekleyen transfer talebi yok</div>
          ) : (
            liste.map((t) => (
              <button key={t.no} type="button" onClick={() => void talepAc(t.no)} className="flex flex-col gap-1 rounded-2xl border bg-card p-3 text-left active:opacity-70" style={{ borderColor: TERMINAL_ACCENT }}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Talep {t.no}{t.isEmriNo ? <span className="text-xs font-normal text-muted-foreground"> · İE {t.isEmriNo}</span> : null}</span>
                  <span className="flex items-center gap-1 text-sm font-semibold"><MapPin className="h-4 w-4" /> {t.hedefLok}</span>
                </div>
                <div className="text-xs text-muted-foreground">{t.kalemSayisi} kalem · kalan {fmt(t.kalanToplam)} · {t.durum}{t.not ? ` · ${t.not}` : ''}</div>
              </button>
            ))
          )}
        </div>
      )}

      {/* DETAY */}
      {gorunum === 'DETAY' && talep && !loading && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-1 rounded-xl border p-1">
            {(['ISTENEN', 'EKLENEN'] as const).map((s) => (
              <button key={s} type="button" onClick={() => { setSekme(s); satirKapat() }}
                className={cn('h-9 rounded-lg text-sm font-semibold', sekme === s ? 'text-white' : 'text-muted-foreground')} style={sekme === s ? { background: TERMINAL_ACCENT } : undefined}>
                {s === 'ISTENEN' ? `İstenen (${talep.malzemeler.length})` : `Eklenen (${talep.seciliStoklar.length})`}
              </button>
            ))}
          </div>
          {!islenebilir && <div className="rounded-xl border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">Talep {talep.durum} — salt okunur</div>}

          {sekme === 'ISTENEN' && (
            <div className="flex flex-col gap-2">
              {talep.malzemeler.map((m, i) => {
                const aktif = satir?.partNo === m.partNo && satir.configurationId === m.configurationId && satir.activitySeq === m.activitySeq
                return (
                  <button key={i} type="button" disabled={!islenebilir || m.kalan === 0} onClick={() => { satirKapat(); setSatir(m) }}
                    className={cn('flex flex-col gap-1 rounded-2xl border bg-card p-3 text-left disabled:opacity-60', aktif && 'ring-2')} style={aktif ? { borderColor: TERMINAL_ACCENT } : undefined}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{m.partNo}</span>
                      {m.kalan === 0 ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">TAMAM</span> : null}
                    </div>
                    {m.partAdi && <div className="truncate text-xs text-muted-foreground">{m.partAdi}</div>}
                    <div className="grid grid-cols-3 gap-1 text-center text-xs">
                      <div><div className="text-muted-foreground">İstenen</div><b>{fmt(m.istenen)} {m.birim}</b></div>
                      <div><div className="text-muted-foreground">Bağlanan</div><b>{fmt(m.baglanan)}</b></div>
                      <div><div className="text-muted-foreground">Kalan</div><b style={{ color: m.kalan ? TERMINAL_ACCENT : undefined }}>{fmt(m.kalan)}</b></div>
                    </div>
                  </button>
                )
              })}

              {satir && adaylar && (
                <div className="flex flex-col gap-2">
                  <div className="text-sm font-semibold" style={{ color: TERMINAL_ACCENT }}>Hangi stok satırı?</div>
                  {adaylar.map((a, i) => (
                    <button key={i} type="button" onClick={() => { setSecili(a); setAdaylar(null); setMiktar(String(Math.min(satir.kalan, a.kullanilabilir))) }} className="rounded-2xl border bg-card p-3 text-left" style={{ borderColor: TERMINAL_ACCENT }}>
                      <div className="font-semibold">{a.partNo} <span className="text-xs font-normal text-muted-foreground">lot {tire(a.lot)}{a.tasimaBirimi ? ` · palet ${a.tasimaBirimi}` : ''}</span></div>
                      <div className="text-xs text-muted-foreground">kullanılabilir {fmt(a.kullanilabilir)} {a.birim}</div>
                    </button>
                  ))}
                </div>
              )}

              {satir && secili && (
                <div className="flex flex-col gap-2 rounded-2xl border p-3" style={{ borderColor: TERMINAL_ACCENT }}>
                  <div className="text-xs text-muted-foreground">{secili.lokasyonNo} · lot {tire(secili.lot)} · kullanılabilir {fmt(secili.kullanilabilir)} {secili.birim} · kalan {fmt(satir.kalan)}</div>
                  <div className="flex gap-2">
                    <input value={miktar} onChange={(e) => setMiktar(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void ekle()} inputMode="decimal"
                      className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-3 text-base outline-none" />
                    <button type="button" onClick={() => void ekle()} className="h-11 rounded-xl px-5 text-sm font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>EKLE</button>
                  </div>
                </div>
              )}
              {satir && <button type="button" onClick={satirKapat} className="self-center text-xs text-muted-foreground underline">vazgeç</button>}
            </div>
          )}

          {sekme === 'EKLENEN' && (
            <div className="flex flex-col gap-2">
              {talep.seciliStoklar.length === 0 && <div className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">Henüz stok bağlanmadı</div>}
              {talep.seciliStoklar.map((s) => (
                <div key={`${s.taskId}-${s.lineNo}`} className="flex items-start justify-between gap-2 rounded-2xl border bg-card p-3">
                  <div className="min-w-0">
                    <div className="font-semibold">{s.partNo}</div>
                    <div className="text-xs">{s.locationNo} · lot {tire(s.lotBatchNo)}{s.handlingUnitId ? ` · palet ${s.handlingUnitId}` : ''}</div>
                    <div className="text-xs font-semibold" style={{ color: TERMINAL_ACCENT }}>{fmt(s.miktar)} · görev {s.taskId}/{s.lineNo}</div>
                  </div>
                  {talep.durum === 'Prepared' && (
                    <button type="button" onClick={() => void kaldir(s)} className="flex shrink-0 items-center gap-1 rounded-lg border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 active:bg-red-50">
                      <Trash2 className="h-3.5 w-3.5" /> Kaldır
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {islenebilir && (
            <button type="button" onClick={() => setOnayAcik(true)} disabled={!tamam}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl text-base font-semibold text-white disabled:opacity-40" style={{ background: TERMINAL_ACCENT }}>
              <Check className="h-5 w-5" /> TRANSFER ET
            </button>
          )}
          {islenebilir && !tamam && <div className="-mt-2 text-center text-xs text-muted-foreground">Tüm kalanlar 0 olunca aktif olur</div>}
        </div>
      )}

      {/* ÖZET */}
      {gorunum === 'OZET' && ozet && !loading && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border p-5 text-center" style={{ borderColor: TERMINAL_ACCENT }}>
          <div className="text-sm text-muted-foreground">Talep {ozet.no}</div>
          <div className="text-2xl font-bold" style={{ color: TERMINAL_ACCENT }}>{ozet.durum === 'Transfered' ? 'Transfer edildi' : ozet.durum}</div>
          <div className="text-sm">{ozet.kalem} stok satırı → {ozet.hedef}</div>
          <button type="button" onClick={() => { setOzet(null); setTalep(null); setGorunum('LISTE') }} className="h-11 w-full rounded-xl text-sm font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>Taleplere dön</button>
        </div>
      )}

      {onayAcik && talep && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-background p-4 shadow-lg">
            <div className="text-base font-semibold">Talep {talep.no}: {talep.seciliStoklar.length} stok satırı {talep.hedefLok}&apos;e taşınacak</div>
            <div className="mt-1 text-sm text-muted-foreground">Stok IFS&apos;te hemen taşınır.</div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setOnayAcik(false)} className="h-11 rounded-xl border text-sm font-semibold">Vazgeç</button>
              <button type="button" onClick={() => void transfer()} className="h-11 rounded-xl text-sm font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>TRANSFER ET</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
