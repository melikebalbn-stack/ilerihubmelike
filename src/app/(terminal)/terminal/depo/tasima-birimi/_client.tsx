'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRightLeft, Boxes, Loader2, MapPin, PackageOpen, PackagePlus, ScanLine, Trash2, Truck, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScanner } from '@/lib/depo/use-scanner'
import { miktarOku, rezerveMesaji } from '@/lib/depo/miktar'
import type { EtiketKaynak } from '@/lib/depo/etiket-parse'
import { TERMINAL_ACCENT } from '../../_shared'
import type { HuStokSatiri, Palet, PaletIcerik, PaletTuru } from '@/lib/ifs/tasima-birimi'
import type { StokBilgisiSatir } from '@/lib/ifs/stok-bilgisi'

type Mod = 'MENU' | 'OLUSTUR' | 'ICERIK' | 'TASI' | 'DEGISTIR'
// Okutma ALAN BAZLI: değer, o an beklenen alana gider (palet alanında çıplak sayı = palet no).
type Alan = 'PALET' | 'LOKASYON' | 'MALZEME' | 'HEDEF_LOK' | 'HEDEF_PALET' | null
type EkleAdim = 'LOKASYON' | 'MALZEME' | 'MIKTAR'

const fmt = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 3 })
const tire = (v: string) => (!v || v === '*' ? '—' : v)
const paletNoOf = (v: string): number | null => {
  const s = v.trim()
  if (!/^\d+$/.test(s)) return null
  const n = Number(s)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}
const kimlik = (s: PaletIcerik | HuStokSatiri): HuStokSatiri => ({
  partNo: s.partNo, locationNo: s.locationNo, lotBatchNo: s.lotBatchNo, serialNo: s.serialNo, engChgLevel: s.engChgLevel,
  waivDevRejNo: s.waivDevRejNo, configurationId: s.configurationId, activitySeq: s.activitySeq, handlingUnitId: s.handlingUnitId,
})
const kaynakKimlik = (s: StokBilgisiSatir): HuStokSatiri => ({
  partNo: s.partNo, locationNo: s.lokasyonNo, lotBatchNo: s.lot || '*', serialNo: s.seri || '*', engChgLevel: s.muhSeviye || '*',
  waivDevRejNo: s.waivDevRejNo || '*', configurationId: s.konfigurasyon || '*', activitySeq: s.aktiviteSira, handlingUnitId: s.tasimaBirimi,
})

const KARTLAR: { mod: Mod; label: string; alt: string; Icon: LucideIcon }[] = [
  { mod: 'OLUSTUR', label: 'Oluştur', alt: 'Yeni boş palet', Icon: PackagePlus },
  { mod: 'ICERIK', label: 'İçerik', alt: 'Palete ekle / çıkar', Icon: PackageOpen },
  { mod: 'TASI', label: 'Taşı', alt: 'Bütün paleti lokasyona', Icon: Truck },
  { mod: 'DEGISTIR', label: 'Değiştir', alt: 'Paletten palete aktar', Icon: ArrowRightLeft },
]

export function TasimaBirimiClient({ baslangicPalet = null }: { baslangicPalet?: number | null }) {
  const router = useRouter()
  const [mod, setMod] = useState<Mod>('MENU')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [errorKey, setErrorKey] = useState(0)
  const [info, setInfo] = useState<string | null>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualVal, setManualVal] = useState('')

  // Oluştur
  const [turler, setTurler] = useState<PaletTuru[]>([])
  const [secTur, setSecTur] = useState('')
  const [olusan, setOlusan] = useState<number | null>(null)
  // Ortak: işlenen (kaynak) palet
  const [palet, setPalet] = useState<Palet | null>(null)
  // İçerik → ekle
  const [ekleAcik, setEkleAcik] = useState(false)
  const [ekleAdim, setEkleAdim] = useState<EkleAdim>('LOKASYON')
  const [lokasyon, setLokasyon] = useState('')
  const [adaylar, setAdaylar] = useState<StokBilgisiSatir[] | null>(null)
  const [secAday, setSecAday] = useState<StokBilgisiSatir | null>(null)
  const [miktar, setMiktar] = useState('')
  // İçerik → çıkar
  const [cikarSatir, setCikarSatir] = useState<PaletIcerik | null>(null)
  const [cikarMiktar, setCikarMiktar] = useState('')
  // Taşı
  const [hedefLok, setHedefLok] = useState('')
  // Değiştir
  const [degSatir, setDegSatir] = useState<PaletIcerik | null>(null)
  const [degMiktar, setDegMiktar] = useState('')
  const [hedefPalet, setHedefPalet] = useState<Palet | null>(null)

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

  const sifirla = useCallback(() => {
    setPalet(null); setOlusan(null); setEkleAcik(false); setEkleAdim('LOKASYON'); setLokasyon(''); setAdaylar(null)
    setSecAday(null); setMiktar(''); setCikarSatir(null); setCikarMiktar(''); setHedefLok(''); setDegSatir(null)
    setDegMiktar(''); setHedefPalet(null); setManualOpen(false); setManualVal('')
  }, [])
  const modAc = (m: Mod) => { sifirla(); setMod(m) }

  useEffect(() => {
    if (mod !== 'OLUSTUR' || turler.length) return
    void (async () => {
      try {
        const res = await fetch('/api/depo/tasima-birimi/turler')
        const data = await res.json().catch(() => null)
        if (res.ok && data?.ok) {
          const t = (data.turler ?? []) as PaletTuru[]
          setTurler(t)
          if (t[0]) setSecTur(t[0].id)
        } else showError(data?.error ?? 'Türler alınamadı')
      } catch { showError('Bağlantı hatası — tekrar deneyin') }
    })()
  }, [mod, turler.length, showError])

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
  const post = (url: string, body: unknown) => api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

  const paletYukle = useCallback(async (id: number): Promise<Palet | null> => {
    const d = await api(`/api/depo/tasima-birimi/${id}`)
    return d ? (d.palet as Palet) : null
  }, [api])

  // Dışarıdan palet no ile gelindi (Stok Bilgisi → "Palet Taşı'ya git"): Taşı modunda palet yüklü aç.
  const baslangicYuklendi = useRef(false)
  useEffect(() => {
    if (!baslangicPalet || baslangicYuklendi.current) return
    baslangicYuklendi.current = true
    setMod('TASI')
    void paletYukle(baslangicPalet).then((p) => { if (p) setPalet(p) })
  }, [baslangicPalet, paletYukle])

  const olustur = async () => {
    if (!secTur) return showError('Tür seçin')
    const d = await post('/api/depo/tasima-birimi', { tur: secTur })
    if (d) setOlusan(Number(d.id))
  }

  const lokasyonOkut = async (v: string) => {
    const d = await api(`/api/depo/tasima-birimi/stok?lokasyon=${encodeURIComponent(v)}`)
    if (!d) return
    if (!Number(d.toplam)) return showError(`Lokasyonda paletsiz stok yok: ${v}`)
    if (palet?.lokasyonNo && palet.lokasyonNo !== v) return showError(`Palet ${palet.lokasyonNo} lokasyonunda — aynı lokasyondan ekleyin`)
    setLokasyon(v); setEkleAdim('MALZEME')
  }
  const malzemeOkut = async (v: string, kaynak: EtiketKaynak) => {
    const p = new URLSearchParams({ lokasyon, okut: v, kaynak })
    const d = await api(`/api/depo/tasima-birimi/stok?${p.toString()}`)
    if (!d) return
    const s = (d.satirlar ?? []) as StokBilgisiSatir[]
    if (!s.length) return showError(`${lokasyon} lokasyonunda paletsiz bulunamadı: ${v}`)
    if (s.length === 1) { setSecAday(s[0]); setAdaylar(null); setEkleAdim('MIKTAR') } else { setAdaylar(s); setSecAday(null) }
  }

  const ekle = async () => {
    if (!palet || !secAday) return
    const m = miktarOku(miktar)
    if (m == null || !(m > 0)) return showError('Geçerli bir miktar girin (en fazla 4 ondalık)')
    if (m > secAday.kullanilabilir) return showError(rezerveMesaji(secAday.kullanilabilir, secAday.rezerve, secAday.birim, 'eklenebilir'))
    const d = await post(`/api/depo/tasima-birimi/${palet.id}/ekle`, { stok: kaynakKimlik(secAday), miktar: m })
    if (!d) return
    setInfo(`${secAday.partNo} · ${fmt(m)} ${secAday.birim} palete eklendi`)
    setSecAday(null); setAdaylar(null); setMiktar(''); setEkleAdim('MALZEME')
    const p = await paletYukle(palet.id); if (p) setPalet(p)
  }

  const cikar = async () => {
    if (!palet || !cikarSatir) return
    const m = miktarOku(cikarMiktar) ?? 0
    if (!(m > 0) || m > cikarSatir.eldeki) return showError(`Miktar 0 ile ${fmt(cikarSatir.eldeki)} arasında olmalı`)
    const d = await post(`/api/depo/tasima-birimi/${palet.id}/cikar`, { stok: kimlik(cikarSatir), miktar: m })
    if (!d) return
    setInfo(`${cikarSatir.partNo} · ${fmt(m)} ${cikarSatir.birim} paletten çıkarıldı`)
    setCikarSatir(null); setCikarMiktar('')
    const p = await paletYukle(palet.id); if (p) setPalet(p)
  }

  const tasi = async () => {
    if (!palet || !hedefLok) return
    const d = await post(`/api/depo/tasima-birimi/${palet.id}/tasi`, { hedefLok })
    if (!d) return
    setInfo(`Palet ${palet.id}: ${String(d.kaynakLok || '—')} → ${hedefLok}`)
    const p = await paletYukle(palet.id); if (p) setPalet(p)
    setHedefLok('')
  }

  const aktar = async () => {
    if (!palet || !degSatir || !hedefPalet) return
    // Rezerve koruması: aktarılabilir = kullanılabilir (eldeki − rezerve).
    const m = miktarOku(degMiktar)
    if (m == null || !(m > 0)) return showError('Geçerli bir miktar girin (en fazla 4 ondalık)')
    if (m > degSatir.kullanilabilir) return showError(rezerveMesaji(degSatir.kullanilabilir, degSatir.rezerve, degSatir.birim, 'aktarılabilir'))
    const d = await post(`/api/depo/tasima-birimi/${palet.id}/degistir`, { hedefId: hedefPalet.id, stok: kimlik(degSatir), miktar: m })
    if (!d) return
    setInfo(`${degSatir.partNo} · ${fmt(m)} ${degSatir.birim}: palet ${palet.id} → ${hedefPalet.id}`)
    setDegSatir(null); setDegMiktar(''); setHedefPalet(null)
    const p = await paletYukle(palet.id); if (p) setPalet(p)
  }

  const alan: Alan = (() => {
    if (mod === 'ICERIK') return !palet ? 'PALET' : ekleAcik ? (ekleAdim === 'LOKASYON' ? 'LOKASYON' : 'MALZEME') : cikarSatir ? null : 'PALET'
    if (mod === 'TASI') return !palet ? 'PALET' : 'HEDEF_LOK'
    if (mod === 'DEGISTIR') return !palet ? 'PALET' : degSatir && !hedefPalet ? 'HEDEF_PALET' : null
    return null
  })()

  const dispatch = async (v: string, kaynak: EtiketKaynak) => {
    const s = v.trim()
    if (!s || !alan) return
    if (alan === 'PALET' || alan === 'HEDEF_PALET') {
      const id = paletNoOf(s)
      if (!id) return showError(`Geçersiz palet no: ${s}`)
      if (alan === 'HEDEF_PALET' && palet && id === palet.id) return showError('Hedef palet kaynakla aynı')
      const p = await paletYukle(id)
      if (!p) return
      if (alan === 'PALET') { sifirla(); setPalet(p) } else setHedefPalet(p)
      return
    }
    if (alan === 'LOKASYON') return void lokasyonOkut(s)
    if (alan === 'MALZEME') return void malzemeOkut(s, kaynak)
    if (alan === 'HEDEF_LOK') {
      if (palet && s === palet.lokasyonNo) return showError(`Palet zaten ${s} lokasyonunda`)
      setHedefLok(s)
    }
  }
  const { inputProps } = useScanner(!!alan && !manualOpen && !loading, (v) => void dispatch(v, 'okutma'))
  const submitManual = () => {
    const v = manualVal.trim()
    if (!v) return
    setManualVal(''); setManualOpen(false)
    void dispatch(v, 'elle')
  }

  const serit: Record<Exclude<Alan, null>, { baslik: string; alt: string }> = {
    PALET: { baslik: 'Palet okut', alt: 'taşıma birimi numarası' },
    LOKASYON: { baslik: 'Lokasyon okut', alt: 'eklenecek malzemenin rafı' },
    MALZEME: { baslik: 'Malzeme barkodu okut', alt: `lokasyon ${lokasyon}` },
    HEDEF_LOK: { baslik: 'Hedef lokasyonu okut', alt: 'paletin gideceği raf' },
    HEDEF_PALET: { baslik: 'Hedef paleti okut', alt: 'aktarılacak palet' },
  }
  const baslik = mod === 'MENU' ? 'Taşıma Birimi' : KARTLAR.find((k) => k.mod === mod)?.label ?? ''

  return (
    <div className="flex flex-1 flex-col gap-3 py-2">
      <input {...inputProps} />

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => (mod === 'MENU' ? router.push('/terminal/depo') : modAc('MENU'))}
          aria-label="Geri"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors active:bg-muted/70"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-col leading-tight">
          <h1 className="text-base font-semibold">{baslik}</h1>
          {palet && mod !== 'MENU' && (
            <span className="truncate text-xs text-muted-foreground">Palet {palet.id} · {palet.turAdi || palet.tur} · {palet.lokasyonNo || 'lokasyonsuz'}</span>
          )}
        </div>
      </div>

      {errorMsg && <div key={errorKey} className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{errorMsg}</div>}
      {info && <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{info}</div>}

      {/* MENÜ — 4 kart */}
      {mod === 'MENU' && (
        <div className="grid grid-cols-2 gap-3">
          {KARTLAR.map(({ mod: m, label, alt, Icon }) => (
            <button key={m} type="button" onClick={() => modAc(m)} className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border bg-card p-3 text-center shadow-sm active:translate-y-px" style={{ borderColor: TERMINAL_ACCENT }}>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ background: TERMINAL_ACCENT }}><Icon className="h-6 w-6" /></span>
              <span className="text-base font-semibold" style={{ color: TERMINAL_ACCENT }}>{label}</span>
              <span className="text-[11px] leading-tight text-muted-foreground">{alt}</span>
            </button>
          ))}
        </div>
      )}

      {/* Okutma şeridi — alan bazlı */}
      {alan && (
        <>
          <div className="flex items-center gap-3 rounded-2xl border p-3" style={{ borderColor: TERMINAL_ACCENT, background: `${TERMINAL_ACCENT}0D` }}>
            <ScanLine className="h-6 w-6 shrink-0" style={{ color: TERMINAL_ACCENT }} />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-sm font-semibold" style={{ color: TERMINAL_ACCENT }}>{serit[alan].baslik}</div>
              <div className="truncate text-xs text-muted-foreground">{serit[alan].alt}</div>
            </div>
            {alan === 'MALZEME' && lokasyon && (
              <button type="button" onClick={() => { setLokasyon(''); setEkleAdim('LOKASYON'); setAdaylar(null); setSecAday(null) }} className="flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold">
                <MapPin className="h-3.5 w-3.5" /> {lokasyon} <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {manualOpen ? (
            <div className="flex w-full gap-2">
              <input autoFocus value={manualVal} onChange={(e) => setManualVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitManual()}
                inputMode={alan === 'PALET' || alan === 'HEDEF_PALET' ? 'numeric' : undefined}
                placeholder={alan === 'PALET' || alan === 'HEDEF_PALET' ? 'Palet no' : alan === 'MALZEME' ? 'Stok no' : 'Lokasyon'}
                className="h-11 flex-1 rounded-xl border bg-background px-3 text-base outline-none focus:ring-1 focus:ring-ring" />
              <button type="button" onClick={submitManual} className="h-11 rounded-xl px-4 text-sm font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>Getir</button>
            </div>
          ) : (
            <button type="button" onClick={() => setManualOpen(true)} className="self-center text-sm text-muted-foreground underline underline-offset-2">veya elle gir</button>
          )}
        </>
      )}

      {loading && <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> IFS ile işlem yapılıyor…</div>}

      {/* OLUŞTUR */}
      {mod === 'OLUSTUR' && !loading && (
        olusan ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border p-5 text-center" style={{ borderColor: TERMINAL_ACCENT }}>
            <Boxes className="h-8 w-8" style={{ color: TERMINAL_ACCENT }} />
            <div className="text-sm text-muted-foreground">Yeni palet</div>
            <div className="text-5xl font-bold tracking-wide" style={{ color: TERMINAL_ACCENT }}>{olusan}</div>
            <div className="grid w-full grid-cols-2 gap-2">
              <button type="button" onClick={() => setOlusan(null)} className="h-11 rounded-xl border text-sm font-semibold">Bir tane daha</button>
              <button type="button" onClick={async () => { const id = olusan; modAc('ICERIK'); const p = await paletYukle(id); if (p) setPalet(p) }} className="h-11 rounded-xl text-sm font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>İçeriğe git</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="text-sm font-semibold text-muted-foreground">Tür seçin</div>
            {turler.map((t) => (
              <button key={t.id} type="button" onClick={() => setSecTur(t.id)} className={cn('flex items-center justify-between rounded-xl border p-3 text-left', secTur === t.id && 'ring-2')} style={secTur === t.id ? { borderColor: TERMINAL_ACCENT } : undefined}>
                <span className="min-w-0"><span className="font-semibold">{t.id}</span> <span className="text-sm text-muted-foreground">{t.ad}</span></span>
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold', t.kategori === 'PALLET' ? 'text-white' : 'border text-muted-foreground')} style={t.kategori === 'PALLET' ? { background: TERMINAL_ACCENT } : undefined}>{t.kategori}</span>
              </button>
            ))}
            <button type="button" onClick={() => void olustur()} disabled={!secTur} className="mt-1 h-12 rounded-2xl text-base font-semibold text-white disabled:opacity-40" style={{ background: TERMINAL_ACCENT }}>OLUŞTUR</button>
          </div>
        )
      )}

      {/* İÇERİK */}
      {mod === 'ICERIK' && palet && !loading && (
        <div className="flex flex-col gap-2">
          <PaletKart palet={palet} secilebilir={!ekleAcik} secili={cikarSatir} onSec={(s) => { setCikarSatir(s); setCikarMiktar(String(s.eldeki)) }} secEtiket="Çıkar" />
          {cikarSatir && (
            <div className="flex flex-col gap-2 rounded-2xl border border-red-300 p-3">
              <div className="text-sm font-semibold">{cikarSatir.partNo} · paletten çıkar (en fazla {fmt(cikarSatir.eldeki)} {cikarSatir.birim})</div>
              <div className="flex gap-2">
                <input value={cikarMiktar} onChange={(e) => setCikarMiktar(e.target.value)} inputMode="decimal" className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-3 text-base outline-none" />
                <button type="button" onClick={() => void cikar()} className="h-11 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white">ÇIKAR</button>
              </div>
              <button type="button" onClick={() => setCikarSatir(null)} className="self-center text-xs text-muted-foreground underline">vazgeç</button>
            </div>
          )}
          {!ekleAcik && !cikarSatir && (
            <button type="button" onClick={() => { setEkleAcik(true); setEkleAdim('LOKASYON') }} className="h-12 rounded-2xl text-base font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>+ Ekle</button>
          )}
          {ekleAcik && adaylar && (
            <div className="flex flex-col gap-2">
              <div className="text-sm font-semibold" style={{ color: TERMINAL_ACCENT }}>Hangi stok satırı?</div>
              {adaylar.map((a, i) => (
                <button key={i} type="button" onClick={() => { setSecAday(a); setAdaylar(null); setEkleAdim('MIKTAR') }} className="rounded-2xl border bg-card p-3 text-left" style={{ borderColor: TERMINAL_ACCENT }}>
                  <div className="font-semibold">{a.partNo} <span className="text-xs font-normal text-muted-foreground">lot {tire(a.lot)}</span></div>
                  <div className="text-xs text-muted-foreground">kullanılabilir {fmt(a.kullanilabilir)} {a.birim}</div>
                </button>
              ))}
            </div>
          )}
          {ekleAcik && ekleAdim === 'MIKTAR' && secAday && (
            <div className="flex flex-col gap-2 rounded-2xl border p-3" style={{ borderColor: TERMINAL_ACCENT }}>
              <div><div className="font-semibold">{secAday.partNo}</div><div className="truncate text-xs text-muted-foreground">{secAday.partAdi} · {secAday.lokasyonNo} · lot {tire(secAday.lot)}</div></div>
              <div className="text-sm">Kullanılabilir: <b style={{ color: TERMINAL_ACCENT }}>{fmt(secAday.kullanilabilir)} {secAday.birim}</b></div>
              <div className="flex gap-2">
                <input value={miktar} onChange={(e) => setMiktar(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void ekle()} inputMode="decimal" placeholder="Miktar" className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-3 text-base outline-none" />
                <button type="button" onClick={() => void ekle()} className="h-11 rounded-xl px-5 text-sm font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>EKLE</button>
              </div>
            </div>
          )}
          {ekleAcik && (
            <button type="button" onClick={() => { setEkleAcik(false); setEkleAdim('LOKASYON'); setLokasyon(''); setAdaylar(null); setSecAday(null); setMiktar('') }} className="self-center text-sm text-muted-foreground underline underline-offset-2">eklemeyi bitir</button>
          )}
        </div>
      )}

      {/* TAŞI */}
      {mod === 'TASI' && palet && !loading && (
        <div className="flex flex-col gap-2">
          <PaletKart palet={palet} ozet />
          {hedefLok && (
            <div className="flex flex-col gap-2 rounded-2xl border p-3" style={{ borderColor: TERMINAL_ACCENT }}>
              <div className="text-center text-lg font-semibold">{palet.lokasyonNo || '—'} → <span style={{ color: TERMINAL_ACCENT }}>{hedefLok}</span></div>
              <button type="button" onClick={() => void tasi()} disabled={!palet.icerik.length} className="h-12 rounded-2xl text-base font-semibold text-white disabled:opacity-40" style={{ background: TERMINAL_ACCENT }}>TAŞI</button>
              <button type="button" onClick={() => setHedefLok('')} className="self-center text-xs text-muted-foreground underline">vazgeç</button>
            </div>
          )}
          {!palet.icerik.length && <div className="rounded-xl border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">Palet boş — taşınacak stok yok</div>}
        </div>
      )}

      {/* DEĞİŞTİR */}
      {mod === 'DEGISTIR' && palet && !loading && (
        <div className="flex flex-col gap-2">
          <PaletKart palet={palet} secilebilir={!degSatir} secili={degSatir} onSec={(s) => { setDegSatir(s); setDegMiktar(String(s.kullanilabilir).replace('.', ',')) }} secEtiket="Seç" />
          {degSatir && (
            <div className="flex flex-col gap-2 rounded-2xl border p-3" style={{ borderColor: TERMINAL_ACCENT }}>
              <div className="text-sm font-semibold">{degSatir.partNo} · aktarılacak miktar (en fazla {fmt(degSatir.eldeki)} {degSatir.birim})</div>
              <input value={degMiktar} onChange={(e) => setDegMiktar(e.target.value)} inputMode="decimal" className="h-11 rounded-xl border bg-background px-3 text-base outline-none" />
              {hedefPalet ? (
                <>
                  <div className="text-center text-lg font-semibold">Palet {palet.id} → <span style={{ color: TERMINAL_ACCENT }}>{hedefPalet.id}</span></div>
                  {hedefPalet.lokasyonNo && hedefPalet.lokasyonNo !== degSatir.locationNo && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800">Hedef palet {hedefPalet.lokasyonNo} lokasyonunda — önce aynı lokasyona taşıyın</div>
                  )}
                  <button type="button" onClick={() => void aktar()} className="h-12 rounded-2xl text-base font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>AKTAR</button>
                </>
              ) : (
                <div className="text-center text-xs text-muted-foreground">Hedef paleti okutun</div>
              )}
              <button type="button" onClick={() => { setDegSatir(null); setHedefPalet(null) }} className="self-center text-xs text-muted-foreground underline">vazgeç</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PaletKart({ palet, ozet, secilebilir, secili, onSec, secEtiket }: {
  palet: Palet
  ozet?: boolean
  secilebilir?: boolean
  secili?: PaletIcerik | null
  onSec?: (s: PaletIcerik) => void
  secEtiket?: string
}) {
  const toplam = palet.icerik.length
  return (
    <div className="flex flex-col gap-2 rounded-2xl border p-3">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-bold" style={{ color: TERMINAL_ACCENT }}>Palet {palet.id}</div>
        <div className="flex items-center gap-1 text-sm font-semibold"><MapPin className="h-4 w-4" /> {palet.lokasyonNo || '—'}</div>
      </div>
      <div className="text-xs text-muted-foreground">{palet.tur} · {palet.turAdi || palet.kategori} · {toplam} kalem</div>
      {ozet ? (
        toplam > 0 && <div className="text-xs">{palet.icerik.slice(0, 4).map((s) => `${s.partNo} ${fmt(s.eldeki)} ${s.birim}`).join(' · ')}{toplam > 4 ? ` · +${toplam - 4}` : ''}</div>
      ) : toplam === 0 ? (
        <div className="rounded-xl border border-dashed p-3 text-center text-sm text-muted-foreground">Palet boş</div>
      ) : (
        palet.icerik.map((s, i) => (
          <div key={i} className={cn('flex items-center justify-between gap-2 rounded-xl border p-2', secili === s && 'ring-2')}>
            <div className="min-w-0">
              <div className="font-semibold">{s.partNo}</div>
              <div className="truncate text-xs text-muted-foreground">{s.partAdi} · lot {tire(s.lotBatchNo)}</div>
              <div className="text-xs font-semibold" style={{ color: TERMINAL_ACCENT }}>{fmt(s.eldeki)} {s.birim}{s.rezerve > 0 ? ` · ${fmt(s.rezerve)} rezerve` : ''}</div>
            </div>
            {secilebilir && onSec && (
              <button type="button" onClick={() => onSec(s)} className={cn('flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold', secEtiket === 'Çıkar' && 'border-red-300 text-red-700')}>
                {secEtiket === 'Çıkar' && <Trash2 className="h-3.5 w-3.5" />} {secEtiket}
              </button>
            )}
          </div>
        ))
      )}
    </div>
  )
}
