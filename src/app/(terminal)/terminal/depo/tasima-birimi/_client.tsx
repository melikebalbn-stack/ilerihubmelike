'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRightLeft, Boxes, Loader2, MapPin, Package, PackageMinus, PackagePlus, Printer, ScanLine, Trash2, Truck, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScanner } from '@/lib/depo/use-scanner'
import { miktarOku, rezerveMesaji } from '@/lib/depo/miktar'
import { paletNoAday, type EtiketKaynak } from '@/lib/depo/etiket-parse'
import { TERMINAL_ACCENT } from '../../_shared'
import type { AltBirim, HuStokSatiri, Palet, PaletAramaSonuc, PaletIcerik, PaletTuru } from '@/lib/ifs/tasima-birimi'
import type { StokBilgisiSatir } from '@/lib/ifs/stok-bilgisi'

/**
 * Taşıma birimi ekranı — kullanıcıya KOLİ ve PALET olarak iki ayrı yüz; arka planda aynı IFS işlemleri
 * (HandlingUnit). Palet = PALLET kategorili tür; koli = diğer türler (BOX, CASE…).
 *  Oluştur: Koli / Palet · Ekle: Koliye Malzeme / Palete Koli · Çıkar: Koliden / Paletten Malzeme
 *  Taşı: Koli / Palet (lokasyon) · Aktar: Koliden Koliye / Paletten Palete (içerik)
 */

type Mod = 'MENU' | 'OLUSTUR' | 'EKLE' | 'KOLI_EKLE' | 'CIKAR' | 'TASI' | 'AKTAR'
type Tur = 'KOLI' | 'PALET'
// Okutma ALAN BAZLI: değer, o an beklenen alana gider (birim alanında çıplak sayı = birim no).
type Alan = 'BIRIM' | 'LOKASYON' | 'MALZEME' | 'HEDEF_LOK' | 'HEDEF_BIRIM' | 'KOLI' | 'TUR' | null
type EkleAdim = 'LOKASYON' | 'MALZEME' | 'MIKTAR'

const trUst = (v: string) => v.toLocaleUpperCase('tr-TR')
const fmt = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 3 })
const tire = (v: string) => (!v || v === '*' ? '—' : v)
const birimNoOf = (v: string): number | null => paletNoAday(v, true)
const kimlik = (s: PaletIcerik | HuStokSatiri): HuStokSatiri => ({
  partNo: s.partNo, locationNo: s.locationNo, lotBatchNo: s.lotBatchNo, serialNo: s.serialNo, engChgLevel: s.engChgLevel,
  waivDevRejNo: s.waivDevRejNo, configurationId: s.configurationId, activitySeq: s.activitySeq, handlingUnitId: s.handlingUnitId,
})
const kaynakKimlik = (s: StokBilgisiSatir): HuStokSatiri => ({
  partNo: s.partNo, locationNo: s.lokasyonNo, lotBatchNo: s.lot || '*', serialNo: s.seri || '*', engChgLevel: s.muhSeviye || '*',
  waivDevRejNo: s.waivDevRejNo || '*', configurationId: s.konfigurasyon || '*', activitySeq: s.aktiviteSira, handlingUnitId: s.tasimaBirimi,
})
const paletMi = (kategori: string) => trUst(kategori) === 'PALLET'
const ad = (t: Tur) => (t === 'KOLI' ? 'Koli' : 'Palet')

const BOLUMLER: { baslik: string; dugmeler: { mod: Mod; tur: Tur; label: string; Icon: LucideIcon }[] }[] = [
  { baslik: 'Oluştur', dugmeler: [
    { mod: 'OLUSTUR', tur: 'KOLI', label: 'Koli Oluştur', Icon: PackagePlus },
    { mod: 'OLUSTUR', tur: 'PALET', label: 'Palet Oluştur', Icon: PackagePlus },
  ] },
  { baslik: 'Ekle', dugmeler: [
    { mod: 'EKLE', tur: 'KOLI', label: 'Koliye Malzeme Ekle', Icon: Package },
    { mod: 'KOLI_EKLE', tur: 'PALET', label: 'Palete Koli Ekle', Icon: Boxes },
  ] },
  { baslik: 'Çıkar', dugmeler: [
    { mod: 'CIKAR', tur: 'KOLI', label: 'Koliden Malzeme Çıkar', Icon: PackageMinus },
    { mod: 'CIKAR', tur: 'PALET', label: 'Paletten Malzeme Çıkar', Icon: PackageMinus },
  ] },
  { baslik: 'Taşı', dugmeler: [
    { mod: 'TASI', tur: 'KOLI', label: 'Koli Taşı', Icon: Truck },
    { mod: 'TASI', tur: 'PALET', label: 'Palet Taşı', Icon: Truck },
  ] },
  { baslik: 'Aktar', dugmeler: [
    { mod: 'AKTAR', tur: 'KOLI', label: 'Koliden Koliye Aktar', Icon: ArrowRightLeft },
    { mod: 'AKTAR', tur: 'PALET', label: 'Paletten Palete Aktar', Icon: ArrowRightLeft },
  ] },
]
const baslikOf = (mod: Mod, tur: Tur) =>
  BOLUMLER.flatMap((b) => b.dugmeler).find((d) => d.mod === mod && d.tur === tur)?.label ?? 'Koli / Palet'

export function TasimaBirimiClient({ baslangicPalet = null }: { baslangicPalet?: number | null }) {
  const router = useRouter()
  const [mod, setMod] = useState<Mod>('MENU')
  const [tur, setTur] = useState<Tur>('PALET')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [errorKey, setErrorKey] = useState(0)
  const [info, setInfo] = useState<string | null>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualVal, setManualVal] = useState('')

  // Oluştur
  const [turler, setTurler] = useState<PaletTuru[]>([])
  const [secTur, setSecTur] = useState('')
  const [turAra, setTurAra] = useState('')
  const [olusan, setOlusan] = useState<number | null>(null)
  // Ortak: işlenen (kaynak) birim
  const [palet, setPalet] = useState<Palet | null>(null)
  // Ekle (malzeme)
  const [ekleAdim, setEkleAdim] = useState<EkleAdim>('LOKASYON')
  const [lokasyon, setLokasyon] = useState('')
  const [adaylar, setAdaylar] = useState<StokBilgisiSatir[] | null>(null)
  const [secAday, setSecAday] = useState<StokBilgisiSatir | null>(null)
  const [miktar, setMiktar] = useState('')
  // Palete koli ekle
  const [koli, setKoli] = useState<Palet | null>(null)
  // Çıkar
  const [cikarSatir, setCikarSatir] = useState<PaletIcerik | null>(null)
  const [cikarMiktar, setCikarMiktar] = useState('')
  // Taşı
  const [hedefLok, setHedefLok] = useState('')
  // Aktar
  const [degSatir, setDegSatir] = useState<PaletIcerik | null>(null)
  const [degMiktar, setDegMiktar] = useState('')
  const [hedefPalet, setHedefPalet] = useState<Palet | null>(null)
  // Arama sonuçları (numara, tür kodu, SSCC, lokasyon) — hangi alan için arandığıyla.
  const [arama, setArama] = useState<{ q: string; alan: 'BIRIM' | 'HEDEF_BIRIM' | 'KOLI'; sonuclar: PaletAramaSonuc[] } | null>(null)

  const showError = useCallback((msg: string) => {
    setErrorMsg(msg)
    setErrorKey((k) => k + 1)
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(200)
  }, [])
  useEffect(() => {
    if (!errorMsg) return
    const t = setTimeout(() => setErrorMsg(null), 5000)
    return () => clearTimeout(t)
  }, [errorKey, errorMsg])
  useEffect(() => {
    if (!info) return
    const t = setTimeout(() => setInfo(null), 8000)
    return () => clearTimeout(t)
  }, [info])

  const sifirla = useCallback(() => {
    setPalet(null); setOlusan(null); setEkleAdim('LOKASYON'); setLokasyon(''); setAdaylar(null)
    setSecAday(null); setMiktar(''); setKoli(null); setCikarSatir(null); setCikarMiktar(''); setHedefLok(''); setDegSatir(null)
    setDegMiktar(''); setHedefPalet(null); setManualOpen(false); setManualVal(''); setArama(null); setTurAra('')
  }, [])
  const modAc = (m: Mod, t: Tur = tur) => { sifirla(); setTur(t); setMod(m) }

  useEffect(() => {
    if (mod !== 'OLUSTUR' || turler.length) return
    void (async () => {
      try {
        const res = await fetch('/api/depo/tasima-birimi/turler')
        const data = await res.json().catch(() => null)
        if (res.ok && data?.ok) setTurler((data.turler ?? []) as PaletTuru[])
        else showError(data?.error ?? 'Türler alınamadı')
      } catch { showError('Bağlantı hatası — tekrar deneyin') }
    })()
  }, [mod, turler.length, showError])

  // Oluştur: koli ekranında palet türleri, palet ekranında palet olmayanlar gizli.
  const uygunTurler = turler.filter((t) => (tur === 'PALET' ? paletMi(t.kategori) : !paletMi(t.kategori)))
  const ilkUygun = uygunTurler[0]?.id ?? ''
  const secUygun = uygunTurler.some((t) => t.id === secTur)
  useEffect(() => {
    if (mod === 'OLUSTUR' && !secUygun) setSecTur(ilkUygun)
  }, [mod, secUygun, ilkUygun])

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

  // Dışarıdan birim no ile gelindi (Stok Bilgisi → "Palet Taşı'ya git"): Taşı modunda, kategorisine göre aç.
  const baslangicYuklendi = useRef(false)
  useEffect(() => {
    if (!baslangicPalet || baslangicYuklendi.current) return
    baslangicYuklendi.current = true
    void paletYukle(baslangicPalet).then((p) => {
      if (!p) return
      setTur(paletMi(p.kategori) ? 'PALET' : 'KOLI'); setMod('TASI'); setPalet(p)
    })
  }, [baslangicPalet, paletYukle])

  const olustur = async () => {
    if (!secTur) return showError('Tür seçin')
    const d = await post('/api/depo/tasima-birimi', { tur: secTur })
    if (d) setOlusan(Number(d.id))
  }

  // ── Koliye malzeme ekle ──
  const lokasyonOkut = async (v: string) => {
    const d = await api(`/api/depo/tasima-birimi/stok?lokasyon=${encodeURIComponent(v)}`)
    if (!d) return
    if (!Number(d.toplam)) return showError(`Lokasyonda kolisiz/paletsiz stok yok: ${v}`)
    setLokasyon(v); setEkleAdim('MALZEME')
  }
  const malzemeOkut = async (v: string, kaynak: EtiketKaynak) => {
    const p = new URLSearchParams({ lokasyon, okut: v, kaynak })
    const d = await api(`/api/depo/tasima-birimi/stok?${p.toString()}`)
    if (!d) return
    const s = (d.satirlar ?? []) as StokBilgisiSatir[]
    if (!s.length) return showError(`${lokasyon} lokasyonunda bulunamadı: ${v}`)
    if (s.length === 1) { setSecAday(s[0]); setAdaylar(null); setEkleAdim('MIKTAR') } else { setAdaylar(s); setSecAday(null) }
  }
  const ekle = async () => {
    if (!palet || !secAday) return
    const m = miktarOku(miktar)
    if (m == null || !(m > 0)) return showError('Geçerli bir miktar girin (en fazla 4 ondalık)')
    if (m > secAday.kullanilabilir) return showError(rezerveMesaji(secAday.kullanilabilir, secAday.rezerve, secAday.birim, 'eklenebilir'))
    const d = await post(`/api/depo/tasima-birimi/${palet.id}/ekle`, { stok: kaynakKimlik(secAday), miktar: m })
    if (!d) return
    const t = d.tasindi as { kaynakLok: string; hedefLok: string } | null
    const p = await paletYukle(palet.id)
    if (p) setPalet(p)
    // IFS taşımayı sessizce atlarsa (boş birim) operatör görsün.
    const tasimaUyari = t && p && p.lokasyonNo !== t.hedefLok ? ` UYARI: IFS'te ${ad(tur).toLowerCase()} hâlâ ${p.lokasyonNo || '—'} lokasyonunda görünüyor.` : ''
    setInfo(`${t ? `${ad(tur)} ${palet.id}, ${t.kaynakLok} nolu lokasyondan ${t.hedefLok} nolu lokasyona taşındı. ` : ''}${secAday.partNo} · ${fmt(m)} ${secAday.birim} ${ad(tur).toLowerCase()}ye eklendi.${tasimaUyari}`)
    setSecAday(null); setAdaylar(null); setMiktar(''); setEkleAdim('MALZEME')
  }

  // ── Palete koli ekle / paletten koli çıkar ──
  const koliEkle = async () => {
    if (!palet || !koli) return
    const d = await post(`/api/depo/tasima-birimi/${palet.id}/koli-ekle`, { koliId: koli.id })
    if (!d) return
    const t = d.tasindi as { kaynakLok: string; hedefLok: string } | null
    setInfo(`${t ? `Koli ${koli.id}, ${t.kaynakLok} nolu lokasyondan ${t.hedefLok} nolu lokasyona taşındı. ` : ''}Koli ${koli.id} palet ${palet.id}'e eklendi.`)
    setKoli(null)
    const p = await paletYukle(palet.id); if (p) setPalet(p)
  }
  const koliCikar = async (k: AltBirim) => {
    if (!palet) return
    const d = await post(`/api/depo/tasima-birimi/${palet.id}/koli-cikar`, { koliId: k.id })
    if (!d) return
    setInfo(`Koli ${k.id} palet ${palet.id}'ten çıkarıldı`)
    const p = await paletYukle(palet.id); if (p) setPalet(p)
  }

  // ── Malzeme çıkar ──
  const cikar = async () => {
    if (!palet || !cikarSatir) return
    const m = miktarOku(cikarMiktar) ?? 0
    if (!(m > 0) || m > cikarSatir.eldeki) return showError(`Miktar 0 ile ${fmt(cikarSatir.eldeki)} arasında olmalı`)
    const d = await post(`/api/depo/tasima-birimi/${palet.id}/cikar`, { stok: kimlik(cikarSatir), miktar: m })
    if (!d) return
    setInfo(`${cikarSatir.partNo} · ${fmt(m)} ${cikarSatir.birim} ${ad(tur).toLowerCase()}den çıkarıldı`)
    setCikarSatir(null); setCikarMiktar('')
    const p = await paletYukle(palet.id); if (p) setPalet(p)
  }

  // ── Taşı ──
  const tasi = async () => {
    if (!palet || !hedefLok) return
    const d = await post(`/api/depo/tasima-birimi/${palet.id}/tasi`, { hedefLok })
    if (!d) return
    setInfo(`${ad(tur)} ${palet.id}: ${String(d.kaynakLok || '—')} → ${hedefLok}`)
    const p = await paletYukle(palet.id); if (p) setPalet(p)
    setHedefLok('')
  }

  // ── Aktar ──
  const aktar = async () => {
    if (!palet || !degSatir || !hedefPalet) return
    const m = miktarOku(degMiktar)
    if (m == null || !(m > 0)) return showError('Geçerli bir miktar girin (en fazla 4 ondalık)')
    if (m > degSatir.kullanilabilir) return showError(rezerveMesaji(degSatir.kullanilabilir, degSatir.rezerve, degSatir.birim, 'aktarılabilir'))
    const d = await post(`/api/depo/tasima-birimi/${palet.id}/degistir`, { hedefId: hedefPalet.id, stok: kimlik(degSatir), miktar: m })
    if (!d) return
    setInfo(`${degSatir.partNo} · ${fmt(m)} ${degSatir.birim}: ${ad(tur).toLowerCase()} ${palet.id} → ${hedefPalet.id}`)
    setDegSatir(null); setDegMiktar(''); setHedefPalet(null)
    const p = await paletYukle(palet.id); if (p) setPalet(p)
  }

  const alan: Alan = (() => {
    if (mod === 'OLUSTUR') return olusan ? null : 'TUR'
    if (mod === 'MENU') return null
    if (!palet) return 'BIRIM'
    if (mod === 'EKLE') return ekleAdim === 'LOKASYON' ? 'LOKASYON' : 'MALZEME'
    if (mod === 'KOLI_EKLE') return 'KOLI'
    if (mod === 'TASI') return 'HEDEF_LOK'
    if (mod === 'AKTAR') return degSatir && !hedefPalet ? 'HEDEF_BIRIM' : null
    return null
  })()

  /** Okutulan/seçilen birim bu ekranın türüne uyuyor mu? (palet ekranına koli, koli ekranına palet okutulamaz) */
  const turKontrol = (p: Palet, beklenen: Tur): string | null => {
    if (!p.kategori) return null
    if (beklenen === 'PALET' && !paletMi(p.kategori)) return `${p.id} bir koli (${p.tur}) — palet okutun`
    if (beklenen === 'KOLI' && paletMi(p.kategori)) return `${p.id} bir palet (${p.tur}) — koli okutun`
    return null
  }

  async function birimSec(id: number, hangi: 'BIRIM' | 'HEDEF_BIRIM' | 'KOLI') {
    if (hangi !== 'BIRIM' && palet && id === palet.id) return showError(hangi === 'KOLI' ? 'Koli ve palet aynı' : 'Hedef kaynakla aynı')
    const p = await paletYukle(id)
    if (!p) return
    const beklenen: Tur = hangi === 'KOLI' ? 'KOLI' : tur
    const hata = turKontrol(p, beklenen)
    if (hata) return showError(hata)
    setArama(null)
    if (hangi === 'HEDEF_BIRIM') return setHedefPalet(p)
    if (hangi === 'KOLI') return setKoli(p)
    const m = mod
    sifirla(); setMod(m); setPalet(p)
  }

  const dispatch = async (v: string, kaynak: EtiketKaynak) => {
    const s = v.trim()
    if (!s || !alan) return
    if (alan === 'BIRIM' || alan === 'HEDEF_BIRIM' || alan === 'KOLI') {
      // Etiket "P1620" → doğrudan. Çıplak sayı, tür kodu, SSCC, lokasyon → ara; tek sonuç açılır.
      const etiketNo = /^[Pp]\d+$/.test(s) ? birimNoOf(s) : null
      if (etiketNo) return void birimSec(etiketNo, alan)
      // Çıplak sayı → önce doğrudan o numaralı birim (yeni oluşturulan dahil); yoksa aramaya düş.
      const no = /^\d+$/.test(s) ? birimNoOf(s) : null
      if (no) {
        try {
          const r = await fetch(`/api/depo/tasima-birimi/${no}`)
          if (r.ok) return void birimSec(no, alan)
        } catch { /* aramaya düş */ }
      }
      const d = await api(`/api/depo/tasima-birimi/ara?q=${encodeURIComponent(s)}`)
      if (!d) return
      const beklenen: Tur = alan === 'KOLI' ? 'KOLI' : tur
      const tumu = (d.sonuclar ?? []) as PaletAramaSonuc[]
      const sonuclar = tumu.filter((x) => !x.kategori || (beklenen === 'PALET' ? paletMi(x.kategori) : !paletMi(x.kategori)))
      if (!sonuclar.length) return showError(tumu.length ? `"${s}" için ${ad(beklenen).toLowerCase()} yok (yalnız ${beklenen === 'PALET' ? 'koli' : 'palet'} bulundu)` : `Bulunamadı: ${s}`)
      const tam = sonuclar.filter((x) => String(x.id) === s)
      if (sonuclar.length === 1 || tam.length === 1) return void birimSec((tam[0] ?? sonuclar[0]).id, alan)
      setArama({ q: s, alan, sonuclar })
      return
    }
    if (alan === 'TUR') {
      const tam = uygunTurler.find((t) => trUst(t.id) === trUst(s))
      if (tam) { setSecTur(tam.id); setTurAra('') } else setTurAra(s)
      return
    }
    if (alan === 'LOKASYON') return void lokasyonOkut(s)
    if (alan === 'MALZEME') return void malzemeOkut(s, kaynak)
    if (alan === 'HEDEF_LOK') {
      if (palet && s === palet.lokasyonNo) return showError(`${ad(tur)} zaten ${s} lokasyonunda`)
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

  const A = ad(tur)
  const serit: Record<Exclude<Alan, null>, { baslik: string; alt: string }> = {
    BIRIM: { baslik: `${A} okut ya da ara`, alt: 'numara, malzeme kodu, tür kodu, SSCC ya da lokasyon' },
    LOKASYON: { baslik: 'Lokasyon okut', alt: 'eklenecek malzemenin rafı' },
    MALZEME: { baslik: 'Malzeme barkodu okut', alt: palet?.lokasyonNo && lokasyon && palet.lokasyonNo !== lokasyon ? `lokasyon ${lokasyon} · ${A.toLowerCase()} ${palet.lokasyonNo}'ten buraya taşınacak` : `lokasyon ${lokasyon}` },
    HEDEF_LOK: { baslik: 'Hedef lokasyonu okut', alt: `${A.toLowerCase()}nin gideceği raf` },
    HEDEF_BIRIM: { baslik: `Hedef ${A.toLowerCase()}yi okut ya da ara`, alt: 'numara, malzeme kodu, tür kodu, SSCC ya da lokasyon' },
    KOLI: { baslik: 'Koli okut ya da ara', alt: `palet ${palet?.id ?? ''} içine konacak koli` },
    TUR: { baslik: 'Tür kodu okut ya da ara', alt: tur === 'PALET' ? 'palet türleri' : 'koli türleri' },
  }

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
          <h1 className="text-base font-semibold">{mod === 'MENU' ? 'Koli / Palet' : baslikOf(mod, tur)}</h1>
          {palet && mod !== 'MENU' && (
            <span className="truncate text-xs text-muted-foreground">{A} {palet.id} · {palet.turAdi || palet.tur} · {palet.lokasyonNo || 'lokasyonsuz'}</span>
          )}
        </div>
      </div>

      {/* Mesajlar ekranın üstüne yapışık — aşağı kaydırılmışken de görünür. */}
      {(errorMsg || info) && (
        <div className="sticky top-0 z-20 flex flex-col gap-1">
          {errorMsg && <div key={errorKey} className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 shadow-sm">{errorMsg}</div>}
          {info && <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 shadow-sm">{info}</div>}
        </div>
      )}

      {/* MENÜ — bölüm başına koli / palet düğmesi */}
      {mod === 'MENU' && (
        <div className="flex flex-col gap-3">
          {BOLUMLER.map((b) => (
            <div key={b.baslik} className="flex flex-col gap-1.5">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{b.baslik}</div>
              <div className="grid grid-cols-2 gap-2">
                {b.dugmeler.map(({ mod: m, tur: t, label, Icon }) => (
                  <button key={label} type="button" onClick={() => modAc(m, t)} className="flex min-h-16 items-center gap-2 rounded-2xl border bg-card p-3 text-left shadow-sm active:translate-y-px" style={{ borderColor: TERMINAL_ACCENT }}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: TERMINAL_ACCENT }}><Icon className="h-5 w-5" /></span>
                    <span className="text-sm font-semibold leading-tight" style={{ color: TERMINAL_ACCENT }}>{label}</span>
                  </button>
                ))}
              </div>
            </div>
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
                placeholder={alan === 'TUR' ? 'Tür kodu ya da açıklama' : alan === 'BIRIM' || alan === 'HEDEF_BIRIM' || alan === 'KOLI' ? 'No, malzeme kodu, tür kodu, lokasyon' : alan === 'MALZEME' ? 'Stok no' : 'Lokasyon'}
                className="h-11 flex-1 rounded-xl border bg-background px-3 text-base outline-none focus:ring-1 focus:ring-ring" />
              <button type="button" onClick={submitManual} className="h-11 rounded-xl px-4 text-sm font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>Getir</button>
            </div>
          ) : (
            <button type="button" onClick={() => setManualOpen(true)} className="self-center text-sm text-muted-foreground underline underline-offset-2">veya elle gir</button>
          )}
        </>
      )}

      {loading && <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> IFS ile işlem yapılıyor…</div>}

      {/* Arama sonuçları */}
      {arama && !loading && alan === arama.alan && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold" style={{ color: TERMINAL_ACCENT }}>&quot;{arama.q}&quot; · {arama.sonuclar.length} sonuç{arama.sonuclar.length === 50 ? '+' : ''}</div>
            <button type="button" onClick={() => setArama(null)} aria-label="Kapat" className="flex h-8 w-8 items-center justify-center rounded-lg border"><X className="h-4 w-4" /></button>
          </div>
          {arama.sonuclar.map((x) => (
            <button key={x.id} type="button" onClick={() => void birimSec(x.id, arama.alan)} className="flex items-center justify-between gap-2 rounded-2xl border bg-card p-3 text-left active:opacity-70" style={{ borderColor: TERMINAL_ACCENT }}>
              <div className="min-w-0">
                <div className="font-semibold">{paletMi(x.kategori) ? 'Palet' : 'Koli'} {x.id}</div>
                <div className="truncate text-xs text-muted-foreground">{x.tur}{x.turAdi ? ` · ${x.turAdi}` : ''}{x.sscc ? ` · SSCC ${x.sscc}` : ''}</div>
              </div>
              <span className="flex shrink-0 items-center gap-1 text-sm font-semibold"><MapPin className="h-4 w-4" /> {x.lokasyonNo || '—'}</span>
            </button>
          ))}
        </div>
      )}

      {/* OLUŞTUR */}
      {mod === 'OLUSTUR' && !loading && (
        olusan ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border p-5 text-center" style={{ borderColor: TERMINAL_ACCENT }}>
            <Boxes className="h-8 w-8" style={{ color: TERMINAL_ACCENT }} />
            <div className="text-sm text-muted-foreground">Yeni {A.toLowerCase()}</div>
            <div className="text-5xl font-bold tracking-wide" style={{ color: TERMINAL_ACCENT }}>{olusan}</div>
            <EtiketBasButon paletId={olusan} />
            <div className="grid w-full grid-cols-2 gap-2">
              <button type="button" onClick={() => setOlusan(null)} className="h-11 rounded-xl border text-sm font-semibold">Bir tane daha</button>
              <button type="button" onClick={async () => {
                const id = olusan
                modAc(tur === 'PALET' ? 'KOLI_EKLE' : 'EKLE', tur)
                const p = await paletYukle(id); if (p) setPalet(p)
              }} className="h-11 rounded-xl text-sm font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>
                {tur === 'PALET' ? 'Koli ekle' : 'Malzeme ekle'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="text-sm font-semibold text-muted-foreground">{A} türü seçin</div>
            <input value={turAra} onChange={(e) => setTurAra(e.target.value)} placeholder="Ara: kod ya da açıklama"
              className="h-11 rounded-xl border bg-background px-3 text-base outline-none focus:ring-1 focus:ring-ring" />
            {uygunTurler.filter((t) => !turAra.trim() || t.id === secTur || trUst(`${t.id} ${t.ad} ${t.kategori}`).includes(trUst(turAra.trim()))).map((t) => (
              <button key={t.id} type="button" onClick={() => setSecTur(t.id)} className={cn('flex items-center justify-between rounded-xl border p-3 text-left', secTur === t.id && 'ring-2')} style={secTur === t.id ? { borderColor: TERMINAL_ACCENT } : undefined}>
                <span className="min-w-0"><span className="font-semibold">{t.id}</span> <span className="text-sm text-muted-foreground">{t.ad}</span></span>
                <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{t.kategori}</span>
              </button>
            ))}
            {turler.length > 0 && uygunTurler.length === 0 && (
              <div className="rounded-xl border border-dashed p-3 text-center text-sm text-muted-foreground">IFS&apos;te {A.toLowerCase()} türü tanımlı değil</div>
            )}
            <button type="button" onClick={() => void olustur()} disabled={!secTur} className="mt-1 h-12 rounded-2xl text-base font-semibold text-white disabled:opacity-40" style={{ background: TERMINAL_ACCENT }}>{A.toLocaleUpperCase('tr-TR')} OLUŞTUR</button>
          </div>
        )
      )}

      {/* KOLİYE MALZEME EKLE */}
      {mod === 'EKLE' && palet && !loading && (
        <div className="flex flex-col gap-2">
          <PaletKart palet={palet} A={A} />
          {adaylar && (
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
          {ekleAdim === 'MIKTAR' && secAday && (
            <div className="flex flex-col gap-2 rounded-2xl border p-3" style={{ borderColor: TERMINAL_ACCENT }}>
              <div><div className="font-semibold">{secAday.partNo}</div><div className="truncate text-xs text-muted-foreground">{secAday.partAdi} · {secAday.lokasyonNo} · lot {tire(secAday.lot)}</div></div>
              <div className="text-sm">Kullanılabilir: <b style={{ color: TERMINAL_ACCENT }}>{fmt(secAday.kullanilabilir)} {secAday.birim}</b></div>
              <div className="flex gap-2">
                <input value={miktar} onChange={(e) => setMiktar(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void ekle()} inputMode="decimal" placeholder="Miktar" className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-3 text-base outline-none" />
                <button type="button" onClick={() => void ekle()} className="h-11 rounded-xl px-5 text-sm font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>EKLE</button>
              </div>
            </div>
          )}
          <EtiketBasButon paletId={palet.id} />
        </div>
      )}

      {/* PALETE KOLİ EKLE */}
      {mod === 'KOLI_EKLE' && palet && !loading && (
        <div className="flex flex-col gap-2">
          <PaletKart palet={palet} A={A} />
          {koli && (
            <div className="flex flex-col gap-2 rounded-2xl border p-3" style={{ borderColor: TERMINAL_ACCENT }}>
              <div className="text-center text-lg font-semibold">Koli {koli.id} → <span style={{ color: TERMINAL_ACCENT }}>Palet {palet.id}</span></div>
              <div className="text-center text-xs text-muted-foreground">{koli.turAdi || koli.tur} · {koli.icerik.length} kalem · {koli.lokasyonNo || 'lokasyonsuz'}</div>
              {palet.lokasyonNo && koli.lokasyonNo && koli.lokasyonNo !== palet.lokasyonNo && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800">Koli {koli.lokasyonNo} lokasyonunda — eklerken paletin lokasyonuna ({palet.lokasyonNo}) taşınacak</div>
              )}
              <button type="button" onClick={() => void koliEkle()} className="h-12 rounded-2xl text-base font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>PALETE EKLE</button>
              <button type="button" onClick={() => setKoli(null)} className="self-center text-xs text-muted-foreground underline">vazgeç</button>
            </div>
          )}
          <EtiketBasButon paletId={palet.id} />
        </div>
      )}

      {/* ÇIKAR */}
      {mod === 'CIKAR' && palet && !loading && (
        <div className="flex flex-col gap-2">
          <PaletKart palet={palet} A={A} secilebilir={!cikarSatir} secili={cikarSatir} onSec={(s) => { setCikarSatir(s); setCikarMiktar(String(s.eldeki)) }} secEtiket="Çıkar"
            onKoliCikar={tur === 'PALET' ? (k) => void koliCikar(k) : undefined} />
          {cikarSatir && (
            <div className="flex flex-col gap-2 rounded-2xl border border-red-300 p-3">
              <div className="text-sm font-semibold">{cikarSatir.partNo} · {A.toLowerCase()}den çıkar (en fazla {fmt(cikarSatir.eldeki)} {cikarSatir.birim})</div>
              <div className="flex gap-2">
                <input value={cikarMiktar} onChange={(e) => setCikarMiktar(e.target.value)} inputMode="decimal" className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-3 text-base outline-none" />
                <button type="button" onClick={() => void cikar()} className="h-11 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white">ÇIKAR</button>
              </div>
              <button type="button" onClick={() => setCikarSatir(null)} className="self-center text-xs text-muted-foreground underline">vazgeç</button>
            </div>
          )}
        </div>
      )}

      {/* TAŞI */}
      {mod === 'TASI' && palet && !loading && (
        <div className="flex flex-col gap-2">
          <PaletKart palet={palet} A={A} ozet />
          {hedefLok && (
            <div className="flex flex-col gap-2 rounded-2xl border p-3" style={{ borderColor: TERMINAL_ACCENT }}>
              <div className="text-center text-lg font-semibold">{palet.lokasyonNo || '—'} → <span style={{ color: TERMINAL_ACCENT }}>{hedefLok}</span></div>
              <button type="button" onClick={() => void tasi()} disabled={!palet.icerik.length && !palet.altBirimler.length} className="h-12 rounded-2xl text-base font-semibold text-white disabled:opacity-40" style={{ background: TERMINAL_ACCENT }}>{A.toLocaleUpperCase('tr-TR')} TAŞI</button>
              <button type="button" onClick={() => setHedefLok('')} className="self-center text-xs text-muted-foreground underline">vazgeç</button>
            </div>
          )}
          {!palet.icerik.length && !palet.altBirimler.length && <div className="rounded-xl border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{A} boş — taşınacak stok yok</div>}
        </div>
      )}

      {/* AKTAR */}
      {mod === 'AKTAR' && palet && !loading && (
        <div className="flex flex-col gap-2">
          <PaletKart palet={palet} A={A} secilebilir={!degSatir} secili={degSatir} onSec={(s) => { setDegSatir(s); setDegMiktar(String(s.kullanilabilir).replace('.', ',')) }} secEtiket="Seç" />
          {degSatir && (
            <div className="flex flex-col gap-2 rounded-2xl border p-3" style={{ borderColor: TERMINAL_ACCENT }}>
              <div className="text-sm font-semibold">{degSatir.partNo} · aktarılacak miktar (en fazla {fmt(degSatir.kullanilabilir)} {degSatir.birim})</div>
              <input value={degMiktar} onChange={(e) => setDegMiktar(e.target.value)} inputMode="decimal" className="h-11 rounded-xl border bg-background px-3 text-base outline-none" />
              {hedefPalet ? (
                <>
                  <div className="text-center text-lg font-semibold">{A} {palet.id} → <span style={{ color: TERMINAL_ACCENT }}>{hedefPalet.id}</span></div>
                  {hedefPalet.lokasyonNo && hedefPalet.lokasyonNo !== degSatir.locationNo && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800">Hedef {A.toLowerCase()} {hedefPalet.lokasyonNo} lokasyonunda — önce aynı lokasyona taşıyın</div>
                  )}
                  <button type="button" onClick={() => void aktar()} className="h-12 rounded-2xl text-base font-semibold text-white" style={{ background: TERMINAL_ACCENT }}>AKTAR</button>
                </>
              ) : (
                <div className="text-center text-xs text-muted-foreground">Hedef {A.toLowerCase()}yi okutun</div>
              )}
              <button type="button" onClick={() => { setDegSatir(null); setHedefPalet(null) }} className="self-center text-xs text-muted-foreground underline">vazgeç</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PaletKart({ palet, A, ozet, secilebilir, secili, onSec, secEtiket, onKoliCikar }: {
  palet: Palet
  A: string
  ozet?: boolean
  secilebilir?: boolean
  secili?: PaletIcerik | null
  onSec?: (s: PaletIcerik) => void
  secEtiket?: string
  onKoliCikar?: (k: AltBirim) => void
}) {
  const toplam = palet.icerik.length
  const alt = palet.altBirimler ?? []
  return (
    <div className="flex flex-col gap-2 rounded-2xl border p-3">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-bold" style={{ color: TERMINAL_ACCENT }}>{A} {palet.id}</div>
        <div className="flex items-center gap-1 text-sm font-semibold"><MapPin className="h-4 w-4" /> {palet.lokasyonNo || '—'}</div>
      </div>
      <div className="text-xs text-muted-foreground">
        {palet.tur} · {palet.turAdi || palet.kategori} · {toplam} kalem{alt.length ? ` · ${alt.length} koli` : ''}{palet.ustBirim ? ` · palet ${palet.ustBirim} içinde` : ''}
      </div>
      {ozet ? (
        (toplam > 0 || alt.length > 0) && (
          <div className="text-xs">
            {palet.icerik.slice(0, 4).map((s) => `${s.partNo} ${fmt(s.eldeki)} ${s.birim}`).join(' · ')}{toplam > 4 ? ` · +${toplam - 4}` : ''}
            {alt.length ? `${toplam ? ' · ' : ''}Koliler: ${alt.map((k) => k.id).join(', ')}` : ''}
          </div>
        )
      ) : toplam === 0 && alt.length === 0 ? (
        <div className="rounded-xl border border-dashed p-3 text-center text-sm text-muted-foreground">{A} boş</div>
      ) : (
        <>
          {alt.map((k) => (
            <div key={`k${k.id}`} className="flex items-center justify-between gap-2 rounded-xl border p-2">
              <div className="min-w-0">
                <div className="font-semibold">Koli {k.id}</div>
                <div className="truncate text-xs text-muted-foreground">{k.tur}{k.turAdi ? ` · ${k.turAdi}` : ''}</div>
              </div>
              {onKoliCikar && (
                <button type="button" onClick={() => onKoliCikar(k)} className="flex shrink-0 items-center gap-1 rounded-lg border border-red-300 px-2 py-1 text-xs font-semibold text-red-700">
                  <Trash2 className="h-3.5 w-3.5" /> Paletten çıkar
                </button>
              )}
            </div>
          ))}
          {palet.icerik.map((s, i) => (
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
          ))}
        </>
      )}
    </div>
  )
}

/**
 * "Etiket Bas" — koli/palet etiketi PDF'i (80×100 mm, barkod "P{id}") yeni sekmede açılır; yazıcıyı cihazın
 * yazdırma penceresi seçer. IFS'e yazmaz, tekrar basılabilir.
 */
function EtiketBasButon({ paletId }: { paletId: number }) {
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const bas = async () => {
    if (yukleniyor) return
    setYukleniyor(true)
    setHata(null)
    try {
      const res = await fetch(`/api/depo/tasima-birimi/${paletId}/etiket`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setHata(data?.error ?? `Etiket üretilemedi (HTTP ${res.status})`)
        return
      }
      const url = URL.createObjectURL(await res.blob())
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      setHata('Bağlantı hatası — tekrar deneyin')
    } finally {
      setYukleniyor(false)
    }
  }
  return (
    <div className="flex w-full flex-col gap-1">
      <button type="button" onClick={() => void bas()} disabled={yukleniyor}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border text-sm font-semibold active:bg-muted/70 disabled:opacity-50"
        style={{ borderColor: TERMINAL_ACCENT, color: TERMINAL_ACCENT }}>
        {yukleniyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} Etiket Bas (P{paletId})
      </button>
      {hata && <div className="text-center text-xs font-medium text-red-700">{hata}</div>}
    </div>
  )
}
