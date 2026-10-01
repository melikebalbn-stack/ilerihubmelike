'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, ChevronDown, ChevronUp, Loader2, MapPin, Plus, RefreshCw, ScanLine, Undo2, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScanner } from '@/lib/depo/use-scanner'
import { miktarOku, rezerveMesaji } from '@/lib/depo/miktar'
import type { EtiketKaynak } from '@/lib/depo/etiket-parse'
import { TERMINAL_ACCENT } from '../../_shared'
import type { StokKimligi, TalepDetay, TalepListeleri, TalepOzet, TalepSatir, TuketSatirSonuc } from '@/lib/ifs/malzeme-talebi'
import type { StokBilgisiSatir, StokYeri } from '@/lib/ifs/stok-bilgisi'

/**
 * Malzeme Talebi (sarf çıkışı). Talepler IFS'te açılır (malzeme + istenen miktar); terminal bekleyen talepleri
 * listeler, operatör talep SATIRINI seçip rafı okutur → yalnız o malzemenin stok satırları gelir → talep satırına
 * rezerv (yeni satır açılmaz). Stok yoksa kırmızı "STOKTA YOK" paneli. TÜKET rezervli satırları stoktan düşer.
 * Satırı olmayan (terminalden yeni açılmış) talepte eski serbest akış: lokasyondaki stoktan yeni satır + rezerv.
 */

type Sekme = 'TALEP' | 'SATIRLAR' | 'OZET'

const fmt = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 3 })
const tire = (v: string) => (!v || v === '*' ? '—' : v)
const tarih = (v: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : v
}
const ayniSatir = (a: TalepSatir | null, b: TalepSatir) =>
  !!a && a.lineNo === b.lineNo && a.releaseNo === b.releaseNo && a.lineItemNo === b.lineItemNo

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
  const [liste, setListe] = useState<TalepOzet[] | null>(null)
  const [talep, setTalep] = useState<TalepDetay | null>(null)
  const [yerler, setYerler] = useState<Record<string, StokYeri[]>>({})
  const [listeler, setListeler] = useState<TalepListeleri>({ musteriler: [], varisYerleri: [] })
  const [yeniAcik, setYeniAcik] = useState(false)
  const [musteri, setMusteri] = useState('')
  const [varis, setVaris] = useState('')
  const [not, setNot] = useState('')

  // Seçili talep satırı (talep akışı) — serbest akışta null.
  const [aktif, setAktif] = useState<TalepSatir | null>(null)
  const [lokasyon, setLokasyon] = useState('')
  const [adaylar, setAdaylar] = useState<StokBilgisiSatir[] | null>(null)
  const [secili, setSecili] = useState<StokBilgisiSatir | null>(null)
  const [miktar, setMiktar] = useState('')
  const [stoktaYok, setStoktaYok] = useState<string | null>(null)

  const [onayAcik, setOnayAcik] = useState(false)
  const [ozet, setOzet] = useState<{ sonuclar: TuketSatirSonuc[]; talepDurumu: string } | null>(null)

  const [loading, setLoading] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualVal, setManualVal] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [errorKey, setErrorKey] = useState(0)
  const [info, setInfo] = useState<string | null>(null)

  const titret = () => { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(200) }
  const showError = useCallback((msg: string) => {
    setErrorMsg(msg)
    setErrorKey((k) => k + 1)
    titret()
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

  const api = useCallback(async (url: string, init?: RequestInit): Promise<Record<string, unknown> | null> => {
    setLoading(true)
    try {
      const res = await fetch(url, init)
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        showError(data?.error ?? 'İşlem başarısız')
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

  const listeYukle = useCallback(async () => {
    const d = await api('/api/depo/malzeme-talebi')
    if (d) setListe((d.talepler ?? []) as TalepOzet[])
  }, [api])
  useEffect(() => { if (sekme === 'TALEP' && liste === null) void listeYukle() }, [sekme, liste, listeYukle])

  // Değer listeleri (yeni talep) — tek müşteri varsa otomatik seç.
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
  const serbest = !!talep && talep.satirlar.length === 0
  const acikSatirlar = talep?.satirlar.filter((s) => s.kalan > 0 && s.durum !== 'Closed') ?? []

  const secimSifirla = useCallback(() => {
    setLokasyon(''); setAdaylar(null); setSecili(null); setMiktar(''); setStoktaYok(null)
  }, [])

  const talepYukle = useCallback(async (no: string, sekmeyeGec = true): Promise<TalepDetay | null> => {
    const v = no.trim()
    if (!v) return null
    const d = await api(`/api/depo/malzeme-talebi?orderNo=${encodeURIComponent(v)}`)
    if (!d) return null
    const t = d.talep as TalepDetay
    setTalep(t)
    setYerler((d.yerler ?? {}) as Record<string, StokYeri[]>)
    if (sekmeyeGec) {
      secimSifirla()
      // Tek açık satır varsa doğrudan seçili gelir.
      const acik = t.satirlar.filter((s) => s.kalan > 0 && s.durum !== 'Closed')
      setAktif(acik.length === 1 ? acik[0] : null)
      setSekme('SATIRLAR')
    }
    return t
  }, [api, secimSifirla])

  const yeniTalep = async () => {
    if (!musteri || !varis) return showError('Dahili müşteri ve varış yeri seçin')
    const d = await api('/api/depo/malzeme-talebi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intCustomerNo: musteri, destinationId: varis, not: not.trim() || undefined }),
    })
    if (!d) return
    setNot(''); setYeniAcik(false)
    setInfo(`Talep ${d.orderNo} oluşturuldu`)
    await talepYukle(String(d.orderNo))
  }

  const satirSec = (s: TalepSatir) => {
    secimSifirla()
    setAktif(s)
  }

  const stokSec = (s: TalepSatir | null, x: StokBilgisiSatir) => {
    setSecili(x)
    setMiktar(String(s ? Math.min(s.kalan, x.kullanilabilir) : ''))
  }

  /** Talep satırı için: lokasyondaki YALNIZ bu malzemenin kullanılabilir stok satırları. Yoksa kırmızı panel. */
  const lokasyonSatirIcin = async (s: TalepSatir, v: string): Promise<boolean> => {
    const d = await api(`/api/depo/malzeme-talebi/stok?lokasyon=${encodeURIComponent(v)}&partNo=${encodeURIComponent(s.partNo)}`)
    if (!d) return false
    const satirlar = (d.satirlar ?? []) as StokBilgisiSatir[]
    setLokasyon(v)
    setSecili(null)
    if (!Number(d.toplam)) {
      setAdaylar([]); setStoktaYok(`${s.partNo} · ${v} lokasyonunda stokta yok`); titret()
      return false
    }
    if (!satirlar.length) {
      setAdaylar([]); setStoktaYok(`${s.partNo} · ${v} lokasyonunda kullanılabilir miktar yok (tamamı rezerveli)`); titret()
      return false
    }
    setStoktaYok(null)
    setAdaylar(satirlar)
    if (satirlar.length === 1) stokSec(s, satirlar[0])
    return true
  }

  /** Satır seçilmeden raf okutuldu: açık satırlardan bu lokasyonda stoğu olanı bul. */
  const lokasyonSatirsiz = async (v: string) => {
    if (!acikSatirlar.length) return showError('Talepte rezerve edilecek kalan yok')
    if (acikSatirlar.length === 1) {
      setAktif(acikSatirlar[0])
      return void lokasyonSatirIcin(acikSatirlar[0], v)
    }
    setLoading(true)
    try {
      const parcalar = [...new Set(acikSatirlar.map((s) => s.partNo))]
      const sonuc = await Promise.all(parcalar.map(async (p) => {
        const res = await fetch(`/api/depo/malzeme-talebi/stok?lokasyon=${encodeURIComponent(v)}&partNo=${encodeURIComponent(p)}`)
        const data = await res.json().catch(() => null)
        return res.ok && data?.ok && Array.isArray(data.satirlar) && data.satirlar.length ? p : null
      }))
      const bulunan = sonuc.filter((p): p is string => !!p)
      if (!bulunan.length) {
        setLokasyon(v); setAdaylar([]); setStoktaYok(`${v} lokasyonunda talepteki malzemelerden hiçbiri yok`); titret()
        return
      }
      const eslesen = acikSatirlar.filter((s) => bulunan.includes(s.partNo))
      if (eslesen.length === 1) {
        setAktif(eslesen[0])
        setLoading(false)
        await lokasyonSatirIcin(eslesen[0], v)
        return
      }
      showError(`${v} lokasyonunda ${bulunan.join(', ')} var — önce talep satırını seçin`)
    } catch {
      showError('Bağlantı hatası — tekrar deneyin')
    } finally {
      setLoading(false)
    }
  }

  /** Serbest akış (satırsız talep): lokasyondaki tüm kullanılabilir stok satırları. */
  const lokasyonSerbest = async (v: string) => {
    const d = await api(`/api/depo/malzeme-talebi/stok?lokasyon=${encodeURIComponent(v)}`)
    if (!d) return
    const satirlar = (d.satirlar ?? []) as StokBilgisiSatir[]
    setLokasyon(v); setSecili(null)
    if (!Number(d.toplam) || !satirlar.length) {
      setAdaylar([]); setStoktaYok(`${v} lokasyonunda ${Number(d.toplam) ? 'kullanılabilir ' : ''}stok yok`); titret()
      return
    }
    setStoktaYok(null)
    setAdaylar(satirlar)
    if (satirlar.length === 1) setSecili(satirlar[0])
  }

  /** Raf okutulduktan sonra barkod / stok no (isteğe bağlı): talep satırında yalnız o malzeme kabul edilir. */
  const stokOkut = async (v: string, kaynak: EtiketKaynak) => {
    const p = new URLSearchParams({ lokasyon, okut: v, kaynak })
    if (aktif) p.set('partNo', aktif.partNo)
    const d = await api(`/api/depo/malzeme-talebi/stok?${p.toString()}`)
    if (!d) return
    const satirlar = ((d.satirlar ?? []) as StokBilgisiSatir[]).filter((s) => s.kullanilabilir > 0)
    if (!satirlar.length) {
      if (d.baskaParca && aktif) return showError(`Okutulan malzeme ${aktif.partNo} değil`)
      setStoktaYok(`${aktif?.partNo ?? v} · ${lokasyon} lokasyonunda kullanılabilir stok yok`); titret()
      return
    }
    setStoktaYok(null)
    if (satirlar.length === 1) stokSec(aktif, satirlar[0])
    else { setAdaylar(satirlar); setSecili(null) }
  }

  const ekle = async () => {
    if (!talep || !secili) return
    const m = miktarOku(miktar)
    if (m == null || !(m > 0)) return showError('Geçerli bir miktar girin (en fazla 4 ondalık)')
    if (m > secili.kullanilabilir) return showError(rezerveMesaji(secili.kullanilabilir, secili.rezerve, secili.birim, 'verilebilir'))
    if (aktif && m > aktif.kalan) return showError(`Talepte kalan ${fmt(aktif.kalan)} ${aktif.birim} — fazlası eklenemez`)
    const d = await api(`/api/depo/malzeme-talebi/${encodeURIComponent(talep.orderNo)}/satir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stok: kimlikOf(secili),
        miktar: m,
        ...(aktif ? { satir: { lineNo: aktif.lineNo, releaseNo: aktif.releaseNo, lineItemNo: aktif.lineItemNo } } : {}),
      }),
    })
    if (!d) return
    setInfo(`${secili.partNo} · ${fmt(m)} ${secili.birim} rezerve edildi (${secili.lokasyonNo})`)
    const onceki = aktif
    secimSifirla()
    const t = await talepYukle(talep.orderNo, false)
    // Aynı satırın kalanı varsa seçili kalır, bittiyse bırakılır.
    const guncel = onceki && t?.satirlar.find((x) => ayniSatir(onceki, x))
    setAktif(guncel && guncel.kalan > 0 ? guncel : null)
  }

  const rezervKaldir = async (s: TalepSatir) => {
    if (!talep) return
    const p = new URLSearchParams({ lineNo: s.lineNo, releaseNo: s.releaseNo, lineItemNo: String(s.lineItemNo) })
    const d = await api(`/api/depo/malzeme-talebi/${encodeURIComponent(talep.orderNo)}/satir?${p.toString()}`, { method: 'DELETE' })
    if (!d) return
    setInfo(`${s.partNo} rezervi kaldırıldı`)
    await talepYukle(talep.orderNo, false)
  }

  const tuketilecek = talep?.satirlar.filter((s) => s.rezerve > 0 && s.durum !== 'Closed') ?? []

  const tuketOnayla = async () => {
    if (!talep) return
    setOnayAcik(false)
    const d = await api(`/api/depo/malzeme-talebi/${encodeURIComponent(talep.orderNo)}/tuket`, { method: 'POST' })
    if (!d) return
    setOzet({ sonuclar: (d.sonuclar ?? []) as TuketSatirSonuc[], talepDurumu: String(d.talepDurumu ?? '') })
    setSekme('OZET')
    setListe(null)
    await talepYukle(talep.orderNo, false)
  }

  // Okutma yönlendirmesi: sekme + adıma göre.
  const dispatch = (v: string, kaynak: EtiketKaynak) => {
    const s = v.trim()
    if (!s) return
    if (sekme === 'TALEP') return void talepYukle(s)
    if (sekme !== 'SATIRLAR' || salt || !talep) return
    if (lokasyon && adaylar && adaylar.length > 0) return void stokOkut(s, kaynak)
    if (serbest) return void lokasyonSerbest(s)
    if (aktif) return void lokasyonSatirIcin(aktif, s)
    return void lokasyonSatirsiz(s)
  }
  const { inputProps } = useScanner(!manualOpen && !loading && !onayAcik && sekme !== 'OZET', (v) => dispatch(v, 'okutma'))

  const submitManual = () => {
    const v = manualVal.trim()
    if (!v) return
    setManualVal('')
    setManualOpen(false)
    dispatch(v, 'elle')
  }

  const malzemeAdimi = !!lokasyon && !!adaylar && adaylar.length > 0
  const serit =
    sekme === 'TALEP'
      ? { baslik: 'Talep no okut', alt: 'ya da aşağıdaki bekleyen taleplerden seç' }
      : malzemeAdimi
        ? { baslik: 'Barkod okut (isteğe bağlı)', alt: `${aktif?.partNo ?? ''} · lokasyon ${lokasyon} · ya da stok satırını seç` }
        : aktif
          ? { baslik: 'Rafı okut', alt: `${aktif.partNo} alınacak raf · ya da aşağıdaki stok yerine dokun` }
          : serbest
            ? { baslik: 'Kaynak lokasyonu okut', alt: 'malzemenin alınacağı raf' }
            : { baslik: 'Talep satırını seç ya da rafı okut', alt: 'yalnız talepteki malzemeler alınır' }

  return (
    <div className="flex flex-1 flex-col gap-3 py-2">
      <input {...inputProps} />

      {/* Üst bar */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            if (sekme === 'TALEP') return router.push('/terminal/depo')
            setTalep(null); setAktif(null); secimSifirla(); setOzet(null); setListe(null); setSekme('TALEP')
          }}
          aria-label="Geri"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors active:bg-muted/70"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-col leading-tight">
          <h1 className="text-base font-semibold">Malzeme Talebi</h1>
          {talep && sekme !== 'TALEP' && (
            <span className="truncate text-xs text-muted-foreground">
              Talep {talep.orderNo} · {talep.durum}{talep.varisYeri ? ` · ${talep.varisYeri}` : ''}
            </span>
          )}
        </div>
      </div>

      {errorMsg && (
        <div key={errorKey} className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{errorMsg}</div>
      )}
      {info && <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{info}</div>}

      {/* Okutma şeridi */}
      {(sekme === 'TALEP' || (sekme === 'SATIRLAR' && !salt)) && (
        <>
          <div className="flex items-center gap-3 rounded-2xl border p-3" style={{ borderColor: TERMINAL_ACCENT, background: `${TERMINAL_ACCENT}0D` }}>
            <ScanLine className="h-6 w-6 shrink-0" style={{ color: TERMINAL_ACCENT }} />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-sm font-semibold" style={{ color: TERMINAL_ACCENT }}>{serit.baslik}</div>
              <div className="truncate text-xs text-muted-foreground">{serit.alt}</div>
            </div>
            {sekme === 'SATIRLAR' && lokasyon && (
              <button type="button" onClick={secimSifirla} className="flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold">
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
                placeholder={sekme === 'TALEP' ? 'Talep no' : malzemeAdimi ? 'Stok no' : 'Lokasyon'}
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

      {/* ── TALEP: bekleyen talepler + yeni talep ── */}
      {sekme === 'TALEP' && !loading && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-muted-foreground">Bekleyen talepler{liste ? ` (${liste.length})` : ''}</div>
            <button type="button" onClick={() => void listeYukle()} aria-label="Yenile" className="flex h-8 w-8 items-center justify-center rounded-lg border"><RefreshCw className="h-4 w-4" /></button>
          </div>
          {liste === null ? null : liste.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">Bekleyen malzeme talebi yok</div>
          ) : (
            liste.map((t) => (
              <button key={t.orderNo} type="button" onClick={() => void talepYukle(t.orderNo)} className="flex flex-col gap-1 rounded-2xl border bg-card p-3 text-left active:opacity-70" style={{ borderColor: TERMINAL_ACCENT }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">Talep {t.orderNo}</span>
                  {t.termin && <span className="shrink-0 text-xs text-muted-foreground">termin {tarih(t.termin)}</span>}
                </div>
                {t.varisYeri && <div className="truncate text-xs text-muted-foreground">{t.varisYeri}</div>}
                <div className="text-xs">
                  <b style={{ color: TERMINAL_ACCENT }}>{t.acikKalem} kalem bekliyor</b>
                  {t.rezerveKalem > 0 ? ` · ${t.rezerveKalem} kalem tüketime hazır` : ''} · {t.durum}
                </div>
                {t.not && <div className="truncate text-xs text-muted-foreground">{t.not}</div>}
              </button>
            ))
          )}

          <button type="button" onClick={() => setYeniAcik((a) => !a)} className="mt-2 flex items-center justify-center gap-1 text-sm text-muted-foreground underline underline-offset-2">
            {yeniAcik ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />} Yeni talep aç
          </button>
          {yeniAcik && (
            <div className="flex flex-col gap-2 rounded-2xl border p-3">
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
        </div>
      )}

      {/* ── SATIRLAR ── */}
      {sekme === 'SATIRLAR' && talep && !loading && (
        <div className="flex flex-col gap-3">
          {salt && <div className="rounded-xl border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">Talep kapalı — salt okunur</div>}

          {/* STOKTA YOK — kalıcı kırmızı panel (bir sonraki okutma/seçime kadar) */}
          {stoktaYok && (
            <div className="flex items-start gap-3 rounded-2xl border-2 border-red-500 bg-red-50 p-4 text-red-800">
              <XCircle className="h-8 w-8 shrink-0 text-red-600" />
              <div className="min-w-0">
                <div className="text-lg font-bold">STOKTA YOK</div>
                <div className="text-sm">{stoktaYok}</div>
                {aktif && (yerler[aktif.partNo]?.length ?? 0) > 0 && (
                  <div className="mt-1 text-xs">Stokta olduğu yerler: {yerler[aktif.partNo].map((y) => `${y.lokasyonNo} (${fmt(y.kullanilabilir)})`).join(', ')}</div>
                )}
              </div>
            </div>
          )}

          {serbest && !salt && (
            <div className="rounded-xl border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">Talepte satır yok — rafı okutup malzemeyi ekleyin</div>
          )}

          {/* Talep satırları: istenen / rezerve / kalan */}
          <div className="flex flex-col gap-2">
            {talep.satirlar.map((s) => {
              const sec = ayniSatir(aktif, s)
              const acik = !salt && s.kalan > 0 && s.durum !== 'Closed'
              const yer = acik ? yerler[s.partNo] ?? [] : []
              return (
                <div key={`${s.lineNo}-${s.releaseNo}-${s.lineItemNo}`} className={cn('flex flex-col gap-2 rounded-2xl border bg-card p-3', !acik && 'opacity-80', sec && 'ring-2')} style={sec ? { borderColor: TERMINAL_ACCENT } : undefined}>
                  <button type="button" disabled={!acik} onClick={() => satirSec(s)} className="flex flex-col gap-1 text-left">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{s.partNo}</span>
                      {s.durum === 'Closed' ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">KAPALI</span>
                      ) : s.kalan === 0 && s.rezerve > 0 ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">HAZIR</span>
                      ) : null}
                    </div>
                    {s.partAdi && <div className="truncate text-xs text-muted-foreground">{s.partAdi}</div>}
                    <div className="grid w-full grid-cols-3 gap-1 text-center text-xs">
                      <div><div className="text-muted-foreground">İstenen</div><b className="text-sm">{fmt(s.miktar)} {s.birim}</b></div>
                      <div><div className="text-muted-foreground">Rezerve</div><b className="text-sm">{fmt(s.rezerve)}</b></div>
                      <div><div className="text-muted-foreground">Kalan</div><b className="text-sm" style={{ color: s.kalan ? TERMINAL_ACCENT : undefined }}>{fmt(s.kalan)}</b></div>
                    </div>
                    {s.cikis > 0 && <div className="text-xs text-muted-foreground">Verilen (tüketilen): {fmt(s.cikis)} {s.birim}</div>}
                    {s.rezervler.some((r) => r.rezerve > 0) && (
                      <div className="text-xs text-muted-foreground">
                        Rezerv: {s.rezervler.filter((r) => r.rezerve > 0).map((r) => `${r.locationNo} · ${fmt(r.rezerve)}${r.lotBatchNo !== '*' ? ` · lot ${r.lotBatchNo}` : ''}`).join(', ')}
                      </div>
                    )}
                  </button>
                  {acik && yer.length > 0 && !(sec && lokasyon) && (
                    <div className="flex flex-col gap-1">
                      {yer.map((y) => (
                        <button key={y.lokasyonNo} type="button" onClick={() => { setAktif(s); void lokasyonSatirIcin(s, y.lokasyonNo) }}
                          className="flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-xs active:bg-muted/70">
                          <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: TERMINAL_ACCENT }} />
                          <span className="min-w-0 flex-1 truncate">Stokta: <b>{y.lokasyonNo}</b>{y.lokasyonAdi ? ` ${y.lokasyonAdi}` : ''}</span>
                          <b className="shrink-0">{fmt(y.kullanilabilir)} {y.birim}</b>
                        </button>
                      ))}
                    </div>
                  )}
                  {acik && yer.length === 0 && (
                    <div className="rounded-lg border border-red-300 bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-700">Stokta kullanılabilir yok</div>
                  )}
                  {!salt && s.rezerve > 0 && s.cikis === 0 && s.durum !== 'Closed' && (
                    <button type="button" onClick={() => void rezervKaldir(s)} className="flex items-center justify-center gap-1 self-end rounded-lg border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 active:bg-red-50">
                      <Undo2 className="h-3.5 w-3.5" /> Rezervi kaldır
                    </button>
                  )}

                  {/* Seçili satır: lokasyondaki bu malzemenin stok satırları + miktar */}
                  {sec && malzemeAdimi && adaylar && (
                    <StokSecim adaylar={adaylar} secili={secili} lokasyon={lokasyon} onSec={(x) => stokSec(s, x)} />
                  )}
                  {sec && secili && (
                    <MiktarGir secili={secili} miktar={miktar} setMiktar={setMiktar} ust={Math.min(s.kalan, secili.kullanilabilir)} onEkle={() => void ekle()} onVazgec={secimSifirla} />
                  )}
                </div>
              )
            })}
            {talep.satirlar.length === 0 && (
              <div className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">Henüz satır yok</div>
            )}
          </div>

          {/* Serbest akış (satırsız talep) */}
          {serbest && !salt && malzemeAdimi && adaylar && (
            <StokSecim adaylar={adaylar} secili={secili} lokasyon={lokasyon} onSec={(x) => stokSec(null, x)} parcaGoster />
          )}
          {serbest && !salt && secili && (
            <MiktarGir secili={secili} miktar={miktar} setMiktar={setMiktar} ust={secili.kullanilabilir} onEkle={() => void ekle()} onVazgec={secimSifirla} />
          )}

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
            <button type="button" onClick={() => { setOzet(null); setTalep(null); setAktif(null); secimSifirla(); setSekme('TALEP') }} className="h-11 rounded-xl text-sm font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>Taleplere dön</button>
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

function StokSecim({ adaylar, secili, lokasyon, onSec, parcaGoster }: {
  adaylar: StokBilgisiSatir[]; secili: StokBilgisiSatir | null; lokasyon: string; onSec: (x: StokBilgisiSatir) => void; parcaGoster?: boolean
}) {
  if (adaylar.length < 2 && secili) return null
  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-semibold" style={{ color: TERMINAL_ACCENT }}>{lokasyon} · stok satırını seç</div>
      {adaylar.map((a, i) => {
        const sec = secili === a
        return (
          <button key={i} type="button" onClick={() => onSec(a)} className={cn('rounded-2xl border bg-card p-3 text-left active:opacity-70', sec && 'ring-2')} style={{ borderColor: TERMINAL_ACCENT }}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">
                {parcaGoster ? `${a.partNo} ` : ''}<span className={parcaGoster ? 'text-xs font-normal text-muted-foreground' : ''}>lot {tire(a.lot)}{a.tasimaBirimi ? ` · palet ${a.tasimaBirimi}` : ''}</span>
              </span>
              {sec && <Check className="h-4 w-4 shrink-0" style={{ color: TERMINAL_ACCENT }} />}
            </div>
            {parcaGoster && a.partAdi && <div className="truncate text-xs text-muted-foreground">{a.partAdi}</div>}
            <div className="text-xs text-muted-foreground">kullanılabilir {fmt(a.kullanilabilir)} {a.birim}</div>
          </button>
        )
      })}
    </div>
  )
}

function MiktarGir({ secili, miktar, setMiktar, ust, onEkle, onVazgec }: {
  secili: StokBilgisiSatir; miktar: string; setMiktar: (v: string) => void; ust: number; onEkle: () => void; onVazgec: () => void
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border p-3" style={{ borderColor: TERMINAL_ACCENT }}>
      <div className="text-xs text-muted-foreground">{secili.partNo} · {secili.lokasyonNo} · lot {tire(secili.lot)}</div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Miktar etiket="Eldeki" deger={secili.eldeki} birim={secili.birim} />
        <Miktar etiket="Rezerve" deger={secili.rezerve} birim={secili.birim} />
        <Miktar etiket="Kullanılabilir" deger={secili.kullanilabilir} birim={secili.birim} vurgu />
      </div>
      <div className="flex gap-2">
        <input
          value={miktar}
          onChange={(e) => setMiktar(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onEkle()}
          inputMode="decimal"
          aria-label="Miktar"
          placeholder={`Miktar (en fazla ${fmt(ust)})`}
          className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-3 text-base outline-none focus:ring-1 focus:ring-ring"
        />
        <button type="button" onClick={onEkle} className="h-11 rounded-xl px-5 text-sm font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>
          EKLE
        </button>
      </div>
      <button type="button" onClick={onVazgec} className="self-center text-xs text-muted-foreground underline underline-offset-2">vazgeç</button>
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
