'use client'

/**
 * Hazır Rapor — TUVAL tasarımcısı (Crystal tarzı bantlar + serbest yerleşim).
 * Referans: "ILERIHub — Rapor Tuvali (mockup)" artifact'ı.
 *
 * Sürükleme/boyutlandırma: dnd-kit DEĞİL, düz pointer events (referanstaki gibi) — öğeler mutlak
 * konumlu, 2px ızgaraya oturur, ok tuşlarıyla kaydırılır (Shift = 10px), Delete ile silinir.
 * Çoklu seçim: Ctrl/Cmd+tık veya bant içinde boş alandan seçim dikdörtgeni; 2+ seçimde hizalama/dağıtma.
 * ÖLÇEK: tuval genişliği sayfa yönü + kenar boşluklarından hesaplanır (tuvalGenislik) — 1px sabit
 * 0,28125 mm. Böylece ekrandaki tuval ile tuvalRender çıktısı aynı sayfayı gösterir.
 * Önizleme: gerçek veriyle tuvalRender → büyük pencerede iframe.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DateField } from '@/components/ui/date-field'
import {
  AlignCenter, AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical,
  AlignHorizontalSpaceAround, AlignLeft, AlignRight, AlignStartHorizontal, AlignStartVertical,
  AlignVerticalSpaceAround, FileText, Loader2, Maximize2, MoveHorizontal, MoveVertical, Play, Plus, Save, Trash2, Upload,
} from 'lucide-react'
import { tuvalRender } from '@/lib/rapor/tuval-render'
import { tuvalDogrula } from '@/lib/rapor/sablon-dogrula'
import { hizala, yonDegistir as yonOlcekle, type HizaIsi } from '@/lib/rapor/tuval-hizala'
import {
  BANT_ADI, tuvalGenislik, tuvalYukseklik,
  type AltToplamFn, type Bicim, type SablonIcerik, type SablonParametre, type TuvalBantId,
  type TuvalDikeyHiza, type TuvalHiza, type TuvalOge, type TuvalTasarim,
} from '@/lib/rapor/tipler'
import type { VeriSetiAlan } from '@/lib/rapor/veri-seti-alanlar'
import { GeriRozet } from '../../../_components/rozet-link'
import { apiGonder, apiIstek, hataMetni, hataYapisi } from '../../../_components/api'
import HataKutusu from '../../../_components/hata-kutusu'
import type { CevrilmisHata } from '@/lib/rapor/hata-cevir'

const NAVY = '#1B4F72'
const CYAN = '#2AA5C7'
/** Önizlemede kurum logosu (sunucu tarafı çalıştırmada base64 gömülür). */
const LOGO_URL = '/ilerigrouplogo.png'
const BICIMLER: (Bicim | '')[] = ['', '#.##0', '#.##0,00', '%0,0', '%0,00', 'gg.aa.yyyy', 'gg.aa.yyyy ss:dd', 'metin']
const FN_SIMGE: Record<string, string> = { topla: 'Σ', ortalama: 'x̄', say: '#', enkucuk: '↓', enbuyuk: '↑', orani: '%' }
const FN_AD: Record<string, string> = { topla: 'Toplam', ortalama: 'Ortalama', say: 'Say', enkucuk: 'Min', enbuyuk: 'Max', orani: 'Oran' }
const BANT_SIRASI: TuvalBantId[] = ['rb', 'sb', 'gb', 'dt', 'gs', 'rs', 'sa']
const TIP_ADI: Record<TuvalOge['tip'], string> = { metin: 'Metin', alan: 'Alan', toplam: 'Toplam alanı', gorsel: 'Görsel', cizgi: 'Çizgi', kutu: 'Kutu', tablo: 'Tablo', grafik: 'Grafik' }
const YAZILI: TuvalOge['tip'][] = ['metin', 'alan', 'toplam']
/** Hazır renk paleti (kurumsal + durum renkleri). */
const PALET: [string, string][] = [['#0F172A', 'Siyah'], [NAVY, 'Lacivert'], ['#64748B', 'Gri'], ['#DC2626', 'Kırmızı'], ['#15803D', 'Yeşil'], ['#EA580C', 'Turuncu']]

const izgara = (v: number) => Math.round(v / 2) * 2
const hizaCss = (h?: TuvalHiza) => (h === 'orta' ? 'center' : h === 'sag' ? 'right' : 'left')

interface Props {
  sablon: { id: string; kod: string; ad: string; aciklama: string; veriSetiId: string; veriSetiAd: string; durum: 'TASLAK' | 'YAYINDA' | 'ARSIV'; surum: number; izinAnahtari: string }
  icerik: SablonIcerik
  alanlar: VeriSetiAlan[]
  tuval: TuvalTasarim
}

/** Palet + serbest seçici; "varsayılan" seçeneği rengi tamamen kaldırır. */
function RenkSecici({ deger, onChange, bosEtiket }: { deger?: string; onChange: (v: string | undefined) => void; bosEtiket: string }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <button type="button" onClick={() => onChange(undefined)} title={bosEtiket} className={`h-6 w-6 rounded border text-[9px] leading-none text-slate-400 ${deger ? 'border-slate-300' : 'border-[#2AA5C7] ring-2 ring-[#2AA5C7]/30'}`} style={{ backgroundImage: 'linear-gradient(45deg,#fff 45%,#e2e8f0 45%,#e2e8f0 55%,#fff 55%)' }}>✕</button>
      {PALET.map(([renk, ad]) => (
        <button key={renk} type="button" title={ad} onClick={() => onChange(renk)} className={`h-6 w-6 rounded border ${deger?.toLowerCase() === renk.toLowerCase() ? 'border-[#2AA5C7] ring-2 ring-[#2AA5C7]/30' : 'border-slate-300'}`} style={{ background: renk }} />
      ))}
      <input type="color" aria-label="Serbest renk" value={deger ?? '#000000'} onChange={(ev) => onChange(ev.target.value)} className="h-6 w-8 cursor-pointer rounded border border-slate-300 bg-white p-0.5" />
    </div>
  )
}

/** Küçük ikonlu araç düğmesi. */
function AracDugme({ baslik, onClick, disabled, children }: { baslik: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" title={baslik} aria-label={baslik} onClick={onClick} disabled={disabled}
      className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-700 hover:bg-[#DCEDF5] disabled:opacity-40 disabled:hover:bg-white">
      {children}
    </button>
  )
}

export default function TuvalTasarimci({ sablon, icerik, alanlar, tuval: ilkTuval }: Props) {
  const router = useRouter()
  const [tuval, setTuval] = useState<TuvalTasarim>(ilkTuval)
  const [secimler, setSecimler] = useState<string[]>([])
  const [surum, setSurum] = useState(sablon.surum)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [hatalar, setHatalar] = useState<string[]>([])
  const [kayitHata, setKayitHata] = useState<CevrilmisHata | null>(null)
  const [yukleniyor, setYukleniyor] = useState(false)
  const sayacRef = useRef(1)
  const dosyaRef = useRef<HTMLInputElement>(null)

  const parametreler: SablonParametre[] = useMemo(() => icerik.parametreler ?? [], [icerik.parametreler])
  const hesaplananlar = useMemo(() => icerik.hesaplananAlanlar ?? [], [icerik.hesaplananAlanlar])
  const tumAlanlar = useMemo(
    () => [...alanlar.map((a) => ({ ad: a.ad, etiket: a.etiket ?? a.ad, tip: a.veriTipi, hesaplanan: false })), ...hesaplananlar.map((h) => ({ ad: h.ad, etiket: h.ad, tip: 'sayi', hesaplanan: true }))],
    [alanlar, hesaplananlar],
  )
  const alanAdlari = useMemo(() => new Set(tumAlanlar.map((a) => a.ad)), [tumAlanlar])
  const alanBilgi = useCallback((ad: string) => tumAlanlar.find((a) => a.ad === ad), [tumAlanlar])

  /** Sayfa yönü + kenar boşluklarından gelen tuval ölçüleri (px). */
  const genislik = tuvalGenislik(tuval.sayfa)
  const sayfaYukseklik = tuvalYukseklik(tuval.sayfa)
  const bantToplam = tuval.bantlar.reduce((t, b) => t + b.yukseklik, 0)

  const secililer = useMemo(() => secimler.map((id) => tuval.ogeler.find((e) => e.id === id)).filter(Boolean) as TuvalOge[], [secimler, tuval.ogeler])
  const secili = secililer.length === 1 ? secililer[0] : null
  const coklu = secililer.length > 1
  const bantOf = useCallback((id: TuvalBantId) => tuval.bantlar.find((b) => b.id === id) ?? { id, yukseklik: 0 }, [tuval.bantlar])

  // Doğrulama her değişiklikte (uyarılar da burada).
  useEffect(() => { setHatalar(tuvalDogrula(tuval, alanAdlari)) }, [tuval, alanAdlari])

  /** Kaydedilmiş tasarımda o1…oN kimlikleri zaten var → çakışmayan ilk kimliği üret. */
  const bosId = (ogeler: TuvalOge[]) => { let id = `o${sayacRef.current++}`; while (ogeler.some((e) => e.id === id)) id = `o${sayacRef.current++}`; return id }
  const yeniId = () => bosId(tuval.ogeler)
  const ogeGuncelle = (id: string, d: Partial<TuvalOge>) => setTuval((t) => ({ ...t, ogeler: t.ogeler.map((e) => (e.id === id ? ({ ...e, ...d } as TuvalOge) : e)) }))
  /** Seçili tüm öğelere aynı değişiklik (çoklu seçimde ortak özellikler). */
  const secimeUygula = (d: Partial<TuvalOge>) => setTuval((t) => ({ ...t, ogeler: t.ogeler.map((e) => (secimler.includes(e.id) ? ({ ...e, ...d } as TuvalOge) : e)) }))
  const ogeSil = (idler: string[]) => { setTuval((t) => ({ ...t, ogeler: t.ogeler.filter((e) => !idler.includes(e.id)) })); setSecimler((s) => s.filter((x) => !idler.includes(x))) }
  /** Öğe bandın altına taşarsa bandı büyüt (referanstaki growBand). */
  const bandiBuyut = (t: TuvalTasarim, e: TuvalOge): TuvalTasarim => {
    const b = t.bantlar.find((x) => x.id === e.bant)
    if (!b || e.y + e.h + 4 <= b.yukseklik) return t
    return { ...t, bantlar: t.bantlar.map((x) => (x.id === e.bant ? { ...x, yukseklik: e.y + e.h + 4 } : x)) }
  }
  const ogeEkle = (oge: TuvalOge, mesaj?: string) => {
    setTuval((t) => bandiBuyut({ ...t, ogeler: [...t.ogeler, oge] }, oge))
    setSecimler([oge.id])
    if (mesaj) toast(mesaj)
  }

  // ── Sayfa ayarları ────────────────────────────────────────────────────
  /**
   * Yön değişince tuval genişliği değişir (dikey ≈640px, yatay ≈950px) — öğelerin x/w'si oranla
   * ölçeklenir, böylece sağdakiler dışarı taşmaz ve yerleşim korunur.
   */
  function yonDegistir(yeniYon: 'dikey' | 'yatay') {
    if (yeniYon === tuval.sayfa.yon) return
    const { sayfa, ogeler, eski, yeni } = yonOlcekle(tuval, yeniYon)
    setTuval((t) => ({ ...t, sayfa, ogeler }))
    toast(`Sayfa ${yeniYon === 'yatay' ? 'YATAY' : 'DİKEY'} — genişlik ${eski} → ${yeni}px; öğe konumları %${Math.round((yeni / eski) * 100)} oranında ölçeklendi.`)
  }
  const kenarDegistir = (i: number, v: number) =>
    setTuval((t) => ({ ...t, sayfa: { ...t.sayfa, kenar: t.sayfa.kenar.map((x, j) => (j === i ? Math.max(0, Math.min(60, v)) : x)) as [number, number, number, number] } }))
  const bantYukseklik = (id: TuvalBantId, v: number) =>
    setTuval((t) => ({ ...t, bantlar: t.bantlar.map((b) => (b.id === id ? { ...b, yukseklik: Math.max(0, Math.min(2000, izgara(v))) } : b)) }))

  // ── Sürükle / boyutlandır (pointer events, çoklu seçim destekli) ──────
  const surukleRef = useRef<{ ids: string[]; sx: number; sy: number; bas: Record<string, { x: number; y: number; w: number; h: number }>; boyut: boolean } | null>(null)
  const onPointerDown = (ev: React.PointerEvent, e: TuvalOge, boyut: boolean) => {
    ev.preventDefault(); ev.stopPropagation()
    let ids = secimler
    if (ev.ctrlKey || ev.metaKey) {
      ids = secimler.includes(e.id) ? secimler.filter((x) => x !== e.id) : [...secimler, e.id]
      setSecimler(ids)
      if (!ids.includes(e.id)) return
    } else if (!secimler.includes(e.id)) {
      ids = [e.id]; setSecimler(ids)
    }
    const hedefler = boyut ? [e.id] : ids
    surukleRef.current = {
      ids: hedefler, sx: ev.clientX, sy: ev.clientY, boyut,
      bas: Object.fromEntries(tuval.ogeler.filter((x) => hedefler.includes(x.id)).map((x) => [x.id, { x: x.x, y: x.y, w: x.w, h: x.h }])),
    }
    ;(ev.target as Element).setPointerCapture?.(ev.pointerId)
  }
  useEffect(() => {
    const hareket = (ev: PointerEvent) => {
      const d = surukleRef.current
      if (!d) return
      setTuval((t) => {
        const G = tuvalGenislik(t.sayfa)
        const dx = ev.clientX - d.sx, dy = ev.clientY - d.sy
        let sonuc = t
        for (const id of d.ids) {
          const e = sonuc.ogeler.find((x) => x.id === id)
          const b0 = d.bas[id]
          if (!e || !b0) continue
          const b = sonuc.bantlar.find((x) => x.id === e.bant) ?? { yukseklik: 0 }
          const yeni: TuvalOge = d.boyut
            ? { ...e, w: Math.max(8, Math.min(G - e.x, izgara(b0.w + dx))), h: Math.max(2, izgara(b0.h + dy)) }
            : { ...e, x: Math.max(0, Math.min(G - e.w, izgara(b0.x + dx))), y: Math.max(0, Math.min(Math.max(0, b.yukseklik - e.h), izgara(b0.y + dy))) }
          sonuc = bandiBuyut({ ...sonuc, ogeler: sonuc.ogeler.map((x) => (x.id === id ? yeni : x)) }, yeni)
        }
        return sonuc
      })
    }
    const birak = () => { surukleRef.current = null }
    document.addEventListener('pointermove', hareket)
    document.addEventListener('pointerup', birak)
    return () => { document.removeEventListener('pointermove', hareket); document.removeEventListener('pointerup', birak) }
  }, [])

  // ── Seçim dikdörtgeni (bant içinde boş alandan sürükle) ───────────────
  const [secimKutusu, setSecimKutusu] = useState<{ bant: TuvalBantId; x0: number; y0: number; x1: number; y1: number } | null>(null)
  const kutuRef = useRef<{ bant: TuvalBantId; kutu: DOMRect; x0: number; y0: number; x1: number; y1: number; ekle: boolean } | null>(null)
  const ogelerRef = useRef(tuval.ogeler)
  ogelerRef.current = tuval.ogeler
  const kutuBaslat = (ev: React.PointerEvent, bantId: TuvalBantId) => {
    if (ev.button !== 0) return
    const kutu = (ev.currentTarget as HTMLElement).getBoundingClientRect()
    const x0 = ev.clientX - kutu.left, y0 = ev.clientY - kutu.top
    kutuRef.current = { bant: bantId, kutu, x0, y0, x1: x0, y1: y0, ekle: ev.ctrlKey || ev.metaKey }
    setSecimKutusu({ bant: bantId, x0, y0, x1: x0, y1: y0 })
    if (!kutuRef.current.ekle) setSecimler([])
  }
  useEffect(() => {
    const hareket = (ev: PointerEvent) => {
      const d = kutuRef.current
      if (!d) return
      d.x1 = ev.clientX - d.kutu.left; d.y1 = ev.clientY - d.kutu.top
      setSecimKutusu({ bant: d.bant, x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1 })
    }
    const birak = () => {
      const d = kutuRef.current
      kutuRef.current = null
      setSecimKutusu(null)
      if (!d) return
      const sol = Math.min(d.x0, d.x1), sag = Math.max(d.x0, d.x1), ust = Math.min(d.y0, d.y1), alt = Math.max(d.y0, d.y1)
      if (sag - sol <= 3 && alt - ust <= 3) return // tık: yalnız seçimi temizler
      const kapsanan = ogelerRef.current.filter((e) => e.bant === d.bant && e.x < sag && e.x + e.w > sol && e.y < alt && e.y + Math.max(e.h, 2) > ust).map((e) => e.id)
      setSecimler((s) => (d.ekle ? [...s, ...kapsanan.filter((x) => !s.includes(x))] : kapsanan))
    }
    document.addEventListener('pointermove', hareket)
    document.addEventListener('pointerup', birak)
    return () => { document.removeEventListener('pointermove', hareket); document.removeEventListener('pointerup', birak) }
  }, [])

  // Bant yüksekliği: bant etiketinin alt kenarından sürükle
  const bantSurukleRef = useRef<{ id: TuvalBantId; sy: number; y0: number } | null>(null)
  useEffect(() => {
    const hareket = (ev: PointerEvent) => {
      const d = bantSurukleRef.current
      if (!d) return
      setTuval((t) => ({ ...t, bantlar: t.bantlar.map((b) => (b.id === d.id ? { ...b, yukseklik: Math.max(0, izgara(d.y0 + (ev.clientY - d.sy))) } : b)) }))
    }
    const birak = () => { bantSurukleRef.current = null }
    document.addEventListener('pointermove', hareket)
    document.addEventListener('pointerup', birak)
    return () => { document.removeEventListener('pointermove', hareket); document.removeEventListener('pointerup', birak) }
  }, [])

  // Klavye: ok tuşları (Shift = 10px) — seçili TÜM öğeler; Delete → toplu sil
  useEffect(() => {
    const tus = (ev: KeyboardEvent) => {
      if (!secimler.length || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName ?? '')) return
      if (ev.key === 'Delete' || ev.key === 'Backspace') { ogeSil(secimler); ev.preventDefault(); return }
      const adim = ev.shiftKey ? 10 : 2
      const yon: Record<string, [number, number]> = { ArrowLeft: [-adim, 0], ArrowRight: [adim, 0], ArrowUp: [0, -adim], ArrowDown: [0, adim] }
      const m = yon[ev.key]
      if (!m) return
      setTuval((t) => {
        const G = tuvalGenislik(t.sayfa)
        return {
          ...t,
          ogeler: t.ogeler.map((e) => {
            if (!secimler.includes(e.id)) return e
            const b = t.bantlar.find((x) => x.id === e.bant) ?? { yukseklik: 0 }
            return { ...e, x: Math.max(0, Math.min(G - e.w, e.x + m[0])), y: Math.max(0, Math.min(Math.max(0, b.yukseklik - e.h), e.y + m[1])) }
          }),
        }
      })
      ev.preventDefault()
    }
    document.addEventListener('keydown', tus)
    return () => document.removeEventListener('keydown', tus)
  }, [secimler]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toplu hizalama / dağıtma (saf mantık: lib/rapor/tuval-hizala.ts) ─
  function topluHizala(is: HizaIsi) {
    if (secililer.length < 2) return
    setTuval((t) => ({ ...t, ogeler: hizala(t.ogeler, secimler, is, tuvalGenislik(t.sayfa)) }))
    if (is === 'yatayDagit' || is === 'dikeyDagit') toast(`${secililer.length} öğe eşit aralıkla dağıtıldı`)
  }

  // ── Paletten sürükle-bırak (HTML5 dnd, referanstaki gibi) ─────────────
  const [uzerinde, setUzerinde] = useState<TuvalBantId | null>(null)
  const birak = (ev: React.DragEvent, bantId: TuvalBantId) => {
    ev.preventDefault(); setUzerinde(null)
    let veri: { tip: string; alan?: string; metin?: string }
    try { veri = JSON.parse(ev.dataTransfer.getData('text/plain')) } catch { return }
    const kutu = (ev.currentTarget as HTMLElement).getBoundingClientRect()
    const b = bantOf(bantId)
    const x = izgara(Math.max(0, Math.min(genislik - 110, ev.clientX - kutu.left - 10)))
    const y = izgara(Math.max(0, Math.min(Math.max(0, b.yukseklik - 17), ev.clientY - kutu.top - 8)))
    if (veri.tip === 'alan' && veri.alan) {
      const bilgi = alanBilgi(veri.alan)
      ogeEkle({ id: yeniId(), bant: bantId, tip: 'alan', alan: veri.alan, x, y, w: 110, h: 16, size: 11, hiza: bilgi?.tip === 'sayi' ? 'sag' : 'sol', bicim: bilgi?.tip === 'sayi' ? '#.##0' : bilgi?.tip === 'tarih' ? 'gg.aa.yyyy' : undefined }, `${bilgi?.etiket ?? veri.alan} → ${BANT_ADI[bantId]}`)
    } else if (veri.metin) {
      ogeEkle({ id: yeniId(), bant: bantId, tip: 'metin', metin: veri.metin, x, y, w: 180, h: 16, size: 11 }, `Eklendi → ${BANT_ADI[bantId]}`)
    }
  }

  // ── Araç çubuğu: EKLE ─────────────────────────────────────────────────
  function ekle(tip: string) {
    const varsayilanBant: Record<string, TuvalBantId> = { metin: 'rb', tablo: 'rs', gorsel: 'rb', grafik: 'rs', cizgi: secili?.bant ?? 'rb', kutu: secili?.bant ?? 'rb', sayfa: 'sa', tarih: 'rb' }
    const bantId = (['metin', 'cizgi', 'kutu'].includes(tip) && secili ? secili.bant : varsayilanBant[tip]) as TuvalBantId
    const b = bantOf(bantId)
    const ortak = { id: yeniId(), bant: bantId, size: 11 }
    const ilkSayi = tumAlanlar.find((a) => a.tip === 'sayi')?.ad ?? tumAlanlar[0]?.ad ?? ''
    const ilkMetin = tumAlanlar.find((a) => a.tip === 'metin')?.ad ?? tumAlanlar[0]?.ad ?? ''
    const yeni: Record<string, TuvalOge> = {
      metin: { ...ortak, tip: 'metin', metin: 'Yeni metin', x: 12, y: 4, w: 160, h: 16 },
      tablo: { ...ortak, tip: 'tablo', kolonlar: tumAlanlar.slice(0, 4).map((a) => ({ alan: a.ad, baslik: a.etiket, genislik: 1 })), x: 0, y: b.yukseklik + 2, w: genislik - 26, h: 74, size: 9 },
      gorsel: { ...ortak, tip: 'gorsel', kaynak: 'logo', oraniKoru: true, x: genislik - 120, y: 10, w: 90, h: 36 },
      grafik: { ...ortak, tip: 'grafik', grafikTipi: 'sutun', grupla: ilkMetin, deger: ilkSayi, fn: 'topla', x: 0, y: b.yukseklik + 2, w: 300, h: 90 },
      cizgi: { ...ortak, tip: 'cizgi', x: 0, y: 2, w: genislik, h: 0, kalinlik: 1.5 },
      kutu: { ...ortak, tip: 'kutu', x: 12, y: 2, w: 200, h: Math.max(10, b.yukseklik - 6), kalinlik: 1.5 },
      sayfa: { ...ortak, tip: 'metin', metin: 'Sayfa {sayfa} / {toplamSayfa}', x: izgara(genislik / 2 - 90), y: 4, w: 180, h: 15, size: 9.5, hiza: 'orta' },
      tarih: { ...ortak, tip: 'metin', metin: '{bugun}', x: genislik - 140, y: 30, w: 140, h: 16, size: 10, hiza: 'sag' },
    }
    ogeEkle(yeni[tip], `${TIP_ADI[yeni[tip].tip]} eklendi → ${BANT_ADI[bantId]}`)
  }

  /**
   * Σ kısayolu: Detay bandındaki sayısal alan seçiliyken gs ve rs bantlarına AYNI x'te toplam öğesi ekler
   * (referans davranış). Zaten varsa tekrar eklemez.
   */
  function formulEkle(fn: AltToplamFn) {
    const e = secili
    if (!e || e.tip !== 'alan' || e.bant !== 'dt') { toast.warning('Önce Detay bandındaki bir alanı seçin.'); return }
    const bilgi = alanBilgi(e.alan)
    if (fn !== 'say' && bilgi?.tip !== 'sayi') { toast.warning(`${bilgi?.etiket ?? e.alan} sayısal değil — yalnız "Say" kullanılabilir.`); return }
    // Grup varsa Grup Sonu + Rapor Sonu, yoksa yalnız Rapor Sonu (referans davranış).
    const hedefler: TuvalBantId[] = tuval.grup?.alan ? ['gs', 'rs'] : ['rs']
    let eklenen = 0
    setTuval((t) => {
      let yeniT = { ...t }
      for (const bantId of hedefler) {
        if (yeniT.ogeler.some((x) => x.bant === bantId && x.tip === 'toplam' && x.alan === e.alan && x.fn === fn)) continue
        const mevcutAyniX = yeniT.ogeler.filter((x) => x.bant === bantId && x.tip === 'toplam' && x.x === e.x).length
        const oge: TuvalOge = {
          id: bosId(yeniT.ogeler), bant: bantId, tip: 'toplam', fn, alan: e.alan,
          ...(fn === 'orani' ? { oraniPay: e.alan, oraniPayda: tumAlanlar.find((a) => a.tip === 'sayi' && a.ad !== e.alan)?.ad } : {}),
          x: e.x, y: 5 + mevcutAyniX * 18, w: e.w, h: 16, hiza: 'sag', kalin: true, size: e.size, bicim: e.bicim,
        }
        if (!yeniT.bantlar.some((b) => b.id === bantId && b.yukseklik > 0)) yeniT = { ...yeniT, bantlar: yeniT.bantlar.map((b) => (b.id === bantId ? { ...b, yukseklik: 28 } : b)) }
        yeniT = bandiBuyut({ ...yeniT, ogeler: [...yeniT.ogeler, oge] }, oge)
        eklenen++
      }
      return yeniT
    })
    toast(eklenen ? `${FN_SIMGE[fn]} ${FN_AD[fn]}(${bilgi?.etiket ?? e.alan}) → ${tuval.grup?.alan ? 'Grup Sonu + ' : ''}Rapor Sonu` : 'Bu toplam zaten var.')
  }

  // ── Görsel yükleme (mevcut desen: akademi sertifika logosu ucu) ───────
  async function gorselYukle(dosya: File, id: string) {
    setYukleniyor(true)
    try {
      const fd = new FormData()
      fd.append('file', dosya)
      const d = await apiIstek<{ url: string; dosyaId: string; ad: string }>('/api/raporlar/logo', { method: 'POST', body: fd })
      ogeGuncelle(id, { kaynak: 'yukleme', url: d.url, dosyaId: d.dosyaId } as Partial<TuvalOge>)
      toast.success(`${d.ad} yüklendi`)
    } catch (e) { toast.error(hataMetni(e)) }
    finally { setYukleniyor(false) }
  }

  // ── Önizleme ──────────────────────────────────────────────────────────
  const [onizBuyuk, setOnizBuyuk] = useState(false)
  const [onizHtml, setOnizHtml] = useState<string | null>(null)
  const [onizBilgi, setOnizBilgi] = useState<string | null>(null)
  const [onizHata, setOnizHata] = useState<CevrilmisHata | null>(null)
  const [onizleniyor, setOnizleniyor] = useState(false)
  const [onizParam, setOnizParam] = useState<Record<string, string>>({})
  async function onizle() {
    setOnizleniyor(true); setOnizHata(null)
    try {
      const d = await apiGonder<{ satirlar: Record<string, unknown>[] }>(`/api/raporlar/${sablon.id}/veri`, 'POST', { parametreler: onizParam })
      const cikti = tuvalRender(tuval, d.satirlar, {
        hesaplananAlanlar: hesaplananlar,
        parametreler: Object.fromEntries(parametreler.map((p) => [p.ad, p.tip === 'tarih' && onizParam[p.ad] ? new Date(onizParam[p.ad]) : onizParam[p.ad]])),
        parametreTanimlari: parametreler,
        degerEtiketleri: Object.fromEntries(alanlar.filter((a) => a.degerEtiketleri).map((a) => [a.ad, a.degerEtiketleri!])),
        raporAdi: icerik.baslik || sablon.ad, raporKodu: sablon.kod,
        // Önizlemede tarayıcı URL'leri çözer; sunucu çalıştırmasında base64 gömülür.
        logoUrl: LOGO_URL,
      })
      setOnizHtml(cikti.html)
      setOnizBilgi(`${cikti.satirSayisi.toLocaleString('tr-TR')} satır · ${cikti.sayfaSayisi} sayfa · A4 ${tuval.sayfa.yon}`)
      setOnizBuyuk(true)
    } catch (e) { setOnizHata(hataYapisi(e)) }
    finally { setOnizleniyor(false) }
  }

  // ── Kaydet ────────────────────────────────────────────────────────────
  async function kaydet() {
    setKaydediliyor(true)
    try {
      setKayitHata(null)
      const d = await apiGonder<{ sablon: { surum: number } }>(`/api/raporlar/sablonlar/${sablon.id}`, 'PUT', { kod: sablon.kod, ad: sablon.ad, aciklama: sablon.aciklama, veriSetiId: sablon.veriSetiId, durum: sablon.durum, izinAnahtari: sablon.izinAnahtari || null, icerik: { ...icerik, yerlesim: 'tuval', tuval } })
      setSurum(d.sablon.surum)
      toast.success(`Kaydedildi (sürüm ${d.sablon.surum})`)
      router.refresh()
    } catch (e) { setKayitHata(hataYapisi(e)); toast.error(hataMetni(e)) }
    finally { setKaydediliyor(false) }
  }

  // ── Öğe içeriği (tuval görünümü) ──────────────────────────────────────
  const ogeIcerik = (e: TuvalOge) => {
    switch (e.tip) {
      case 'metin': return e.metin
      case 'alan': return `{${e.alan}}`
      case 'toplam': return `${FN_SIMGE[e.fn] ?? 'Σ'} {${e.alan}}`
      case 'gorsel':
        return e.kaynak === 'yukleme' && e.url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={e.url} alt="" draggable={false} className="w-full h-full" style={{ objectFit: (e.oraniKoru ?? true) ? 'contain' : 'fill', objectPosition: `${hizaCss(e.hiza)} top` }} />
          : <span className="w-full h-full border-[1.5px] border-[#1B4F72] text-[#1B4F72] flex items-center justify-center font-bold text-[12px] tracking-wider">LOGO</span>
      case 'cizgi': case 'kutu': return ''
      case 'tablo': return (
        <table className="w-full text-[9px] border-collapse">
          <tbody>
            <tr>{e.kolonlar.map((k) => <th key={k.alan} className="bg-[#1B4F72] text-white font-medium text-left px-1 py-px">{k.baslik}</th>)}</tr>
            {[0, 1].map((i) => <tr key={i}>{e.kolonlar.map((k) => <td key={k.alan} className="border-b border-slate-200 px-1 py-px font-mono text-slate-500">{`{${k.alan}}`}</td>)}</tr>)}
          </tbody>
        </table>
      )
      case 'grafik': return <span className="text-[9px] text-[#1B4F72]">▥ {alanBilgi(e.deger)?.etiket ?? e.deger} — {alanBilgi(e.grupla)?.etiket ?? e.grupla}</span>
    }
  }

  const surukleBaslat = (ev: React.DragEvent, veri: object) => ev.dataTransfer.setData('text/plain', JSON.stringify(veri))

  /** Metin/alan/toplam için hizalama düğme satırları (tekil + çoklu seçimde ortak). */
  const hizaSatiri = (uygula: (d: Partial<TuvalOge>) => void, mevcut?: TuvalHiza, mevcutDikey?: TuvalDikeyHiza) => (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <Label className="text-[11px]">Yatay</Label>
        <div className="flex gap-1">
          {([['sol', AlignLeft, 'Sola'], ['orta', AlignCenter, 'Ortaya'], ['sag', AlignRight, 'Sağa']] as const).map(([v, Ikon, ad]) => (
            <button key={v} type="button" title={ad} aria-label={ad} onClick={() => uygula({ hiza: v })}
              className={`inline-flex h-7 w-7 items-center justify-center rounded border ${(mevcut ?? 'sol') === v ? 'border-[#2AA5C7] bg-[#DCEDF5]' : 'border-slate-200 bg-white hover:bg-slate-50'}`}><Ikon className="h-3.5 w-3.5" /></button>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-[11px]">Dikey</Label>
        <div className="flex gap-1">
          {([['ust', AlignStartHorizontal, 'Üste'], ['orta', AlignCenterHorizontal, 'Ortaya'], ['alt', AlignEndHorizontal, 'Alta']] as const).map(([v, Ikon, ad]) => (
            <button key={v} type="button" title={ad} aria-label={ad} onClick={() => uygula({ dikeyHiza: v })}
              className={`inline-flex h-7 w-7 items-center justify-center rounded border ${(mevcutDikey ?? 'ust') === v ? 'border-[#2AA5C7] bg-[#DCEDF5]' : 'border-slate-200 bg-white hover:bg-slate-50'}`}><Ikon className="h-3.5 w-3.5" /></button>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-3">
      {/* ÜST */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <GeriRozet href="/raporlar">Raporlar</GeriRozet>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight flex items-center gap-3">
            <FileText className="h-6 w-6" style={{ color: NAVY }} />
            {icerik.baslik || sablon.ad}
            <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Hazır Rapor · Tuval</Badge>
            <Badge variant="outline" className="font-normal">sürüm {surum}</Badge>
          </h1>
          <p className="text-sm text-muted-foreground mt-1"><span className="font-mono">{sablon.kod}</span> · veri seti: <span className="font-mono">{sablon.veriSetiAd}</span> · A4 {tuval.sayfa.yon} ({genislik}×{sayfaYukseklik}px)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onizle} disabled={onizleniyor}>{onizleniyor ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Play className="h-4 w-4 mr-1.5" />}Önizle</Button>
          <Button size="sm" onClick={kaydet} disabled={kaydediliyor || hatalar.some((h) => !h.startsWith('Uyarı:'))} style={{ backgroundColor: CYAN, color: '#06222C' }} className="font-semibold">
            {kaydediliyor ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}Kaydet
          </Button>
        </div>
      </div>

      {/* Araç çubuğu */}
      <Card>
        <CardContent className="p-2 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10.5px] text-muted-foreground mr-1 tracking-wide">EKLE</span>
            {[['metin', 'T', 'Metin'], ['tablo', '▦', 'Tablo'], ['gorsel', '▣', 'Görsel'], ['grafik', '▥', 'Grafik'], ['cizgi', '―', 'Çizgi'], ['kutu', '□', 'Kutu'], ['sayfa', '#', 'Sayfa no'], ['tarih', '◷', 'Tarih']].map(([t, ic, ad]) => (
              <button key={t} type="button" onClick={() => ekle(t)} className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-[#DCEDF5]"><span className="font-bold" style={{ color: NAVY }}>{ic}</span>{ad}</button>
            ))}
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10.5px] text-muted-foreground mr-1 tracking-wide">FORMÜL</span>
            {(['topla', 'ortalama', 'say', 'enkucuk', 'enbuyuk', 'orani'] as AltToplamFn[]).map((fn) => (
              <button key={fn} type="button" onClick={() => formulEkle(fn)} className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-[#DCEDF5]" title={`${FN_AD[fn]} — Detay bandındaki sayısal alan seçiliyken`}><span className="font-bold" style={{ color: CYAN }}>{FN_SIMGE[fn]}</span>{FN_AD[fn]}</button>
            ))}
          </div>
          {/* HİZALA — yalnız 2+ öğe seçiliyken etkin */}
          <div className="flex items-center gap-1 flex-wrap" aria-label="Hizalama">
            <span className="text-[10.5px] text-muted-foreground mr-1 tracking-wide">HİZALA{coklu ? ` (${secililer.length})` : ''}</span>
            <AracDugme baslik="Sola hizala" disabled={!coklu} onClick={() => topluHizala('sol')}><AlignStartVertical className="h-4 w-4" /></AracDugme>
            <AracDugme baslik="Yatayda ortala" disabled={!coklu} onClick={() => topluHizala('yatayOrta')}><AlignCenterVertical className="h-4 w-4" /></AracDugme>
            <AracDugme baslik="Sağa hizala" disabled={!coklu} onClick={() => topluHizala('sag')}><AlignEndVertical className="h-4 w-4" /></AracDugme>
            <span className="w-px h-5 bg-slate-200 mx-0.5" />
            <AracDugme baslik="Üste hizala" disabled={!coklu} onClick={() => topluHizala('ust')}><AlignStartHorizontal className="h-4 w-4" /></AracDugme>
            <AracDugme baslik="Dikeyde ortala" disabled={!coklu} onClick={() => topluHizala('dikeyOrta')}><AlignCenterHorizontal className="h-4 w-4" /></AracDugme>
            <AracDugme baslik="Alta hizala" disabled={!coklu} onClick={() => topluHizala('alt')}><AlignEndHorizontal className="h-4 w-4" /></AracDugme>
            <span className="w-px h-5 bg-slate-200 mx-0.5" />
            <AracDugme baslik="Yatayda eşit aralıkla dağıt" disabled={secililer.length < 3} onClick={() => topluHizala('yatayDagit')}><AlignHorizontalSpaceAround className="h-4 w-4" /></AracDugme>
            <AracDugme baslik="Dikeyde eşit aralıkla dağıt" disabled={secililer.length < 3} onClick={() => topluHizala('dikeyDagit')}><AlignVerticalSpaceAround className="h-4 w-4" /></AracDugme>
            <AracDugme baslik="Aynı genişlik (ilk seçilene göre)" disabled={!coklu} onClick={() => topluHizala('ayniGenislik')}><MoveHorizontal className="h-4 w-4" /></AracDugme>
            <AracDugme baslik="Aynı yükseklik (ilk seçilene göre)" disabled={!coklu} onClick={() => topluHizala('ayniYukseklik')}><MoveVertical className="h-4 w-4" /></AracDugme>
          </div>
          <span className="text-[11px] text-muted-foreground ml-auto">Ctrl+tık veya boş alandan sürükle = çoklu seçim · ok tuşları / Delete · <b>Σ</b> ile grup+rapor toplamı</span>
        </CardContent>
      </Card>

      <HataKutusu hata={kayitHata} />
      {hatalar.length > 0 && (
        <div className={`rounded-md border px-3 py-2 text-xs ${hatalar.some((h) => !h.startsWith('Uyarı:')) ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          <ul className="list-disc ml-4">{hatalar.slice(0, 6).map((h, i) => <li key={i}>{h}</li>)}</ul>
          {hatalar.length > 6 && <div className="mt-0.5">… {hatalar.length - 6} sorun daha</div>}
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-[220px_1fr_300px]">
        {/* SOL — alan paleti */}
        <aside className="bg-white border rounded-lg p-3 max-h-[calc(100vh-10rem)] overflow-auto">
          <h4 className="m-0 mb-1.5 text-[11px] font-semibold text-slate-500 tracking-wide">ALANLAR · {sablon.veriSetiAd}</h4>
          <ul className="list-none m-0 p-0 mb-4">
            {tumAlanlar.filter((a) => !a.hesaplanan).map((a) => (
              <li key={a.ad} draggable onDragStart={(ev) => surukleBaslat(ev, { tip: 'alan', alan: a.ad })} className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-[#DCEDF5] cursor-grab text-xs select-none">
                <span className="font-mono text-[9.5px] text-slate-500 w-4">{a.tip === 'sayi' ? '12' : a.tip === 'tarih' ? '◷' : 'Aa'}</span>
                <span className="truncate">{a.etiket}</span>
                <span className="ml-auto font-mono text-[10px] text-slate-400 truncate max-w-[70px]">{a.ad}</span>
              </li>
            ))}
          </ul>
          {hesaplananlar.length > 0 && (
            <>
              <h4 className="m-0 mb-1.5 text-[11px] font-semibold text-slate-500 tracking-wide">HESAPLANAN</h4>
              <ul className="list-none m-0 p-0 mb-4">
                {hesaplananlar.map((h) => (
                  <li key={h.ad} draggable onDragStart={(ev) => surukleBaslat(ev, { tip: 'alan', alan: h.ad })} title={h.ifade} className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-[#DCEDF5] cursor-grab text-xs select-none">
                    <span className="font-mono text-[9.5px] text-slate-500 w-4">fx</span><span className="truncate">{h.ad}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {parametreler.length > 0 && (
            <>
              <h4 className="m-0 mb-1.5 text-[11px] font-semibold text-slate-500 tracking-wide">PARAMETRELER</h4>
              <ul className="list-none m-0 p-0 mb-4">
                {parametreler.map((p) => (
                  <li key={p.ad} draggable onDragStart={(ev) => surukleBaslat(ev, { tip: 'metin', metin: `${p.etiket}: {p.${p.ad}}` })} className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-[#DCEDF5] cursor-grab text-xs select-none">
                    <span className="font-mono text-[9.5px] text-slate-500 w-4">P</span><span className="truncate">{p.etiket}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <h4 className="m-0 mb-1.5 text-[11px] font-semibold text-slate-500 tracking-wide">ÖZEL ALANLAR</h4>
          <ul className="list-none m-0 p-0">
            {[['#', 'Sayfa numarası', 'Sayfa {sayfa} / {toplamSayfa}'], ['◷', 'Bugünün tarihi', '{bugun}'], ['T', 'Rapor adı', '{rapor.ad}'], ['@', 'Çalıştıran', '{calistiran}'], ['G', 'Grup değeri', '{grup}']].map(([ic, ad, metin]) => (
              <li key={ad} draggable onDragStart={(ev) => surukleBaslat(ev, { tip: 'metin', metin })} className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-[#DCEDF5] cursor-grab text-xs select-none">
                <span className="font-mono text-[9.5px] text-slate-500 w-4">{ic}</span><span className="truncate">{ad}</span>
              </li>
            ))}
          </ul>
        </aside>

        {/* ORTA — tuval */}
        <main className="overflow-auto bg-[#E9EDF1] rounded-lg p-4">
          <div className="bg-white border border-slate-300 shadow-sm w-max mx-auto">
            {BANT_SIRASI.map((bantId) => {
              const b = bantOf(bantId)
              const grupEki = bantId === 'gb' || bantId === 'gs' ? (tuval.grup?.alan ? ` · ${alanBilgi(tuval.grup.alan)?.etiket ?? tuval.grup.alan}` : ' · grupsuz') : ''
              return (
                <div key={bantId} className="flex border-b border-dashed border-slate-300">
                  <div className="w-[112px] shrink-0 bg-slate-50 border-r border-slate-200 text-[10.5px] text-slate-500 font-semibold px-2 py-1.5 relative select-none">
                    <span className={bantId === 'dt' ? 'text-[#2AA5C7]' : ''}>{BANT_ADI[bantId]}{grupEki}</span>
                    <span className="block text-[9px] font-normal text-slate-400">{b.yukseklik}px</span>
                    <div
                      className="absolute left-0 right-0 bottom-0 h-1.5 cursor-ns-resize hover:bg-[#2AA5C7]/40"
                      title="Bant yüksekliğini sürükleyerek ayarla"
                      onPointerDown={(ev) => { ev.preventDefault(); ev.stopPropagation(); bantSurukleRef.current = { id: bantId, sy: ev.clientY, y0: b.yukseklik }; (ev.target as Element).setPointerCapture?.(ev.pointerId) }}
                    />
                  </div>
                  <div
                    className={`relative shrink-0 ${uzerinde === bantId ? 'bg-[#DCEDF5]' : ''}`}
                    style={{ width: genislik, height: Math.max(b.yukseklik, 8) }}
                    onPointerDown={(ev) => kutuBaslat(ev, bantId)}
                    onDragOver={(ev) => { ev.preventDefault(); setUzerinde(bantId) }}
                    onDragLeave={() => setUzerinde((u) => (u === bantId ? null : u))}
                    onDrop={(ev) => birak(ev, bantId)}
                  >
                    {tuval.ogeler.filter((e) => e.bant === bantId).map((e) => {
                      const sec = secimler.includes(e.id)
                      const stil: React.CSSProperties = {
                        left: e.x, top: e.y, width: e.w, height: e.h, fontSize: e.size ?? 11,
                        fontWeight: e.kalin ? 700 : 400, textAlign: hizaCss(e.hiza) as React.CSSProperties['textAlign'],
                        color: e.renk, background: e.zemin,
                        ...(e.dikeyHiza && e.dikeyHiza !== 'ust' ? { display: 'flex', flexDirection: 'column' as const, justifyContent: e.dikeyHiza === 'orta' ? 'center' : 'flex-end' } : {}),
                        ...(e.tip === 'cizgi' ? { borderTop: `${e.kalinlik ?? 1.5}px solid ${e.renk ?? NAVY}`, height: 0 } : {}),
                        ...(e.tip === 'kutu' ? { border: `${e.kalinlik ?? 1.5}px solid ${e.renk ?? NAVY}` } : {}),
                      }
                      const sinif = e.tip === 'alan' ? 'font-mono text-[#1B4F72] bg-[#2AA5C7]/10' : e.tip === 'toplam' ? 'font-mono text-[#1B4F72] font-semibold bg-[#1B4F72]/[0.07]' : ''
                      return (
                        <div
                          key={e.id}
                          onPointerDown={(ev) => onPointerDown(ev, e, false)}
                          className={`absolute overflow-hidden whitespace-nowrap px-0.5 leading-tight cursor-move border border-dashed ${sec ? 'border-solid border-[#2AA5C7] ring-2 ring-[#2AA5C7]/25' : 'border-transparent hover:border-slate-300'} ${e.zemin ? '' : sinif}`}
                          style={stil}
                          title={`${TIP_ADI[e.tip]} · ${e.x},${e.y} ${e.w}×${e.h}`}
                        >
                          {ogeIcerik(e)}
                          {sec && !coklu && <span onPointerDown={(ev) => onPointerDown(ev, e, true)} className="absolute -right-px -bottom-px w-2.5 h-2.5 bg-[#2AA5C7] cursor-nwse-resize" />}
                        </div>
                      )
                    })}
                    {secimKutusu?.bant === bantId && (
                      <div className="absolute border border-[#2AA5C7] bg-[#2AA5C7]/10 pointer-events-none"
                        style={{ left: Math.min(secimKutusu.x0, secimKutusu.x1), top: Math.min(secimKutusu.y0, secimKutusu.y1), width: Math.abs(secimKutusu.x1 - secimKutusu.x0), height: Math.abs(secimKutusu.y1 - secimKutusu.y0) }} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            Sayfa gövdesi {sayfaYukseklik}px · bantlar toplamı {bantToplam}px
            {bantToplam > sayfaYukseklik && <span className="text-amber-700"> — detay bandı sayfaya sığmıyor, sayfalara bölünecek</span>}
          </p>
        </main>

        {/* SAĞ — özellikler */}
        <aside className="bg-white border rounded-lg p-3 max-h-[calc(100vh-10rem)] overflow-auto text-sm">
          {coklu ? (
            <>
              <h4 className="m-0 mb-2 text-[11px] font-semibold text-slate-500 tracking-wide">{secililer.length} ÖĞE SEÇİLİ</h4>
              <p className="text-[11px] text-muted-foreground mb-2">Hizalama/dağıtma üstteki <b>HİZALA</b> grubunda. Aşağıdakiler seçili tüm öğelere uygulanır.</p>
              <div className="space-y-2">
                {hizaSatiri(secimeUygula)}
                <div className="space-y-1"><Label className="text-[11px]">Yazı rengi</Label><RenkSecici deger={undefined} bosEtiket="Varsayılan" onChange={(v) => secimeUygula({ renk: v })} /></div>
                <div className="space-y-1"><Label className="text-[11px]">Arka plan</Label><RenkSecici deger={undefined} bosEtiket="Saydam" onChange={(v) => secimeUygula({ zemin: v })} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label className="text-[11px]">Yazı boyutu</Label>
                    <Input className="h-8 text-xs" type="number" step="0.5" placeholder="—" onChange={(ev) => { const v = Number(ev.target.value); if (v) secimeUygula({ size: v }) }} />
                  </div>
                  <div className="space-y-1"><Label className="text-[11px]">Kalınlık</Label>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="h-8 text-xs flex-1 font-bold" onClick={() => secimeUygula({ kalin: true })}>K</Button>
                      <Button variant="outline" size="sm" className="h-8 text-xs flex-1" onClick={() => secimeUygula({ kalin: false })}>normal</Button>
                    </div>
                  </div>
                </div>
                <div className="space-y-1"><Label className="text-[11px]">Bant</Label>
                  <NativeSelect className="h-8 text-xs" value="" onChange={(ev) => ev.target.value && secimeUygula({ bant: ev.target.value as TuvalBantId })}>
                    <option value="">Taşı…</option>{BANT_SIRASI.map((b) => <option key={b} value={b}>{BANT_ADI[b]}</option>)}
                  </NativeSelect>
                </div>
                <Button variant="outline" size="sm" className="w-full text-red-600 border-red-200 hover:bg-red-50" onClick={() => ogeSil(secimler)}><Trash2 className="h-3.5 w-3.5 mr-1.5" />{secililer.length} öğeyi sil</Button>
              </div>
            </>
          ) : !secili ? (
            <>
              <h4 className="m-0 mb-2 text-[11px] font-semibold text-slate-500 tracking-wide">SAYFA AYARLARI</h4>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-[11px]">Yön</Label>
                  <div className="flex gap-1">
                    {([['dikey', 'A4 Dikey'], ['yatay', 'A4 Yatay']] as const).map(([v, ad]) => (
                      <button key={v} type="button" onClick={() => yonDegistir(v)}
                        className={`flex-1 rounded border px-2 py-1.5 text-xs ${tuval.sayfa.yon === v ? 'border-[#2AA5C7] bg-[#DCEDF5] font-medium text-[#1B4F72]' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>{ad}</button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Yön değişince öğeler yeni genişliğe orantılı ölçeklenir.</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Kenar boşlukları (mm)</Label>
                  <div className="grid grid-cols-4 gap-1">
                    {(['Üst', 'Sağ', 'Alt', 'Sol'] as const).map((ad, i) => (
                      <div key={ad} className="space-y-0.5">
                        <span className="block text-[9.5px] text-slate-500">{ad}</span>
                        <Input className="h-8 text-xs" type="number" min={0} max={60} value={tuval.sayfa.kenar[i]} onChange={(ev) => kenarDegistir(i, Number(ev.target.value) || 0)} />
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Sayfa içi alan: {genislik}×{sayfaYukseklik}px</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Gruplama alanı</Label>
                  <NativeSelect className="h-8 text-xs" value={tuval.grup?.alan ?? ''} onChange={(ev) => setTuval((t) => ({ ...t, grup: ev.target.value ? { alan: ev.target.value, baslik: t.grup?.baslik } : undefined }))}>
                    <option value="">Yok</option>{tumAlanlar.map((a) => <option key={a.ad} value={a.ad}>{a.etiket}</option>)}
                  </NativeSelect>
                </div>
                {tuval.grup?.alan && (
                  <div className="space-y-1">
                    <Label className="text-[11px]">Grup başlığı ifadesi</Label>
                    <Input className="h-8 text-xs font-mono" placeholder={`{${tuval.grup.alan}}`} value={tuval.grup.baslik ?? ''}
                      onChange={(ev) => setTuval((t) => ({ ...t, grup: { alan: t.grup!.alan, baslik: ev.target.value || undefined } }))} />
                    <p className="text-[10px] text-muted-foreground">Grup Başı bandında <b>{'{grup}'}</b> yer tutucusu grubun değerini basar.</p>
                  </div>
                )}
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox checked={!!bantOf('gb').yeniSayfa} onCheckedChange={(v) => setTuval((t) => ({ ...t, bantlar: t.bantlar.map((b) => (b.id === 'gb' ? { ...b, yeniSayfa: v === true } : b)) }))} />
                  Her grup yeni sayfada başlasın
                </label>
                <div className="space-y-1 border-t pt-2">
                  <Label className="text-[11px]">Bant yükseklikleri (px)</Label>
                  {BANT_SIRASI.map((b) => (
                    <div key={b} className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-600 flex-1 truncate">{BANT_ADI[b]}</span>
                      <Input className="h-7 w-20 text-xs" type="number" min={0} step={2} value={bantOf(b).yukseklik} onChange={(ev) => bantYukseklik(b, Number(ev.target.value) || 0)} />
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground">0 = bant basılmaz. Bant etiketinin alt kenarından sürükleyerek de ayarlanır.</p>
                </div>
                <div className="text-[11px] text-muted-foreground border-t pt-2 leading-relaxed">
                  Bir öğe seçin; <b>Ctrl+tık</b> veya bant içinde boş alandan sürükleyerek çoklu seçim yapın.
                </div>
              </div>
            </>
          ) : (
            <>
              <h4 className="m-0 mb-2 text-[11px] font-semibold text-slate-500 tracking-wide">ÖZELLİKLER · {TIP_ADI[secili.tip].toUpperCase()}</h4>
              <div className="space-y-2">
                {secili.tip === 'metin' && (
                  <div className="space-y-1"><Label className="text-[11px]">Metin</Label>
                    <Input className="h-8 text-xs" value={secili.metin} onChange={(ev) => ogeGuncelle(secili.id, { metin: ev.target.value } as Partial<TuvalOge>)} />
                    <p className="text-[10px] text-muted-foreground">{'{alan}'} · {'{p.param}'} · {'{sayfa}'} · {'{toplamSayfa}'} · {'{bugun}'} · {'{calistiran}'} · {'{grup}'}</p>
                  </div>
                )}
                {(secili.tip === 'alan' || secili.tip === 'toplam') && (
                  <div className="space-y-1"><Label className="text-[11px]">Alan</Label>
                    <NativeSelect className="h-8 text-xs" value={secili.alan} onChange={(ev) => ogeGuncelle(secili.id, { alan: ev.target.value } as Partial<TuvalOge>)}>
                      {tumAlanlar.map((a) => <option key={a.ad} value={a.ad}>{a.etiket} ({a.ad})</option>)}
                    </NativeSelect>
                  </div>
                )}
                {secili.tip === 'toplam' && (
                  <>
                    <div className="space-y-1"><Label className="text-[11px]">Fonksiyon</Label>
                      <NativeSelect className="h-8 text-xs" value={secili.fn} onChange={(ev) => ogeGuncelle(secili.id, { fn: ev.target.value as AltToplamFn } as Partial<TuvalOge>)}>
                        {Object.keys(FN_AD).map((k) => <option key={k} value={k}>{FN_SIMGE[k]} {FN_AD[k]}</option>)}
                      </NativeSelect>
                    </div>
                    {secili.fn === 'orani' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1"><Label className="text-[11px]">Pay</Label>
                          <NativeSelect className="h-8 text-xs" value={secili.oraniPay ?? ''} onChange={(ev) => ogeGuncelle(secili.id, { oraniPay: ev.target.value } as Partial<TuvalOge>)}><option value="">—</option>{tumAlanlar.map((a) => <option key={a.ad} value={a.ad}>{a.etiket}</option>)}</NativeSelect>
                        </div>
                        <div className="space-y-1"><Label className="text-[11px]">Payda</Label>
                          <NativeSelect className="h-8 text-xs" value={secili.oraniPayda ?? ''} onChange={(ev) => ogeGuncelle(secili.id, { oraniPayda: ev.target.value } as Partial<TuvalOge>)}><option value="">—</option>{tumAlanlar.map((a) => <option key={a.ad} value={a.ad}>{a.etiket}</option>)}</NativeSelect>
                        </div>
                      </div>
                    )}
                  </>
                )}
                {secili.tip === 'gorsel' && (
                  <>
                    <div className="space-y-1"><Label className="text-[11px]">Kaynak</Label>
                      <NativeSelect className="h-8 text-xs" value={secili.kaynak} onChange={(ev) => ogeGuncelle(secili.id, { kaynak: ev.target.value as 'logo' | 'yukleme' } as Partial<TuvalOge>)}>
                        <option value="logo">Kurum logosu (varsayılan)</option>
                        <option value="yukleme">Yüklenen görsel</option>
                      </NativeSelect>
                    </div>
                    {secili.kaynak === 'yukleme' && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <input ref={dosyaRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
                            onChange={(ev) => { const f = ev.target.files?.[0]; if (f) gorselYukle(f, secili.id); ev.target.value = '' }} />
                          <Button variant="outline" size="sm" className="h-8 text-xs" disabled={yukleniyor} onClick={() => dosyaRef.current?.click()}>
                            {yukleniyor ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}Dosya seç
                          </Button>
                          <span className="text-[10px] text-muted-foreground">PNG/JPG/WEBP/SVG · ≤2 MB</span>
                        </div>
                        {secili.url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={secili.url} alt="Yüklenen görsel önizlemesi" className="mt-1 max-h-20 border rounded bg-slate-50 object-contain" />
                        )}
                      </div>
                    )}
                    <label className="flex items-center gap-2 text-xs">
                      <Checkbox checked={secili.oraniKoru ?? true} onCheckedChange={(v) => ogeGuncelle(secili.id, { oraniKoru: v === true } as Partial<TuvalOge>)} />
                      En-boy oranını koru
                    </label>
                  </>
                )}
                {secili.tip === 'tablo' && (
                  <div className="space-y-1"><Label className="text-[11px]">Kolonlar (alan adları, virgülle)</Label>
                    <Input className="h-8 text-xs font-mono" value={secili.kolonlar.map((k) => k.alan).join(', ')}
                      onChange={(ev) => ogeGuncelle(secili.id, { kolonlar: ev.target.value.split(',').map((x) => x.trim()).filter(Boolean).map((ad) => ({ alan: ad, baslik: alanBilgi(ad)?.etiket ?? ad, genislik: 1 })) } as Partial<TuvalOge>)} />
                  </div>
                )}
                {secili.tip === 'grafik' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><Label className="text-[11px]">Kırılım</Label>
                      <NativeSelect className="h-8 text-xs" value={secili.grupla} onChange={(ev) => ogeGuncelle(secili.id, { grupla: ev.target.value } as Partial<TuvalOge>)}>{tumAlanlar.map((a) => <option key={a.ad} value={a.ad}>{a.etiket}</option>)}</NativeSelect>
                    </div>
                    <div className="space-y-1"><Label className="text-[11px]">Değer</Label>
                      <NativeSelect className="h-8 text-xs" value={secili.deger} onChange={(ev) => ogeGuncelle(secili.id, { deger: ev.target.value } as Partial<TuvalOge>)}>{tumAlanlar.map((a) => <option key={a.ad} value={a.ad}>{a.etiket}</option>)}</NativeSelect>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-4 gap-1.5">
                  {(['x', 'y', 'w', 'h'] as const).map((k) => (
                    <div key={k} className="space-y-1"><Label className="text-[11px] uppercase">{k}</Label>
                      <Input className="h-8 text-xs" type="number" value={secili[k]} onChange={(ev) => ogeGuncelle(secili.id, { [k]: Number(ev.target.value) || 0 } as Partial<TuvalOge>)} />
                    </div>
                  ))}
                </div>
                {YAZILI.includes(secili.tip) && (
                  <>
                    <div className="space-y-1"><Label className="text-[11px]">Yazı boyutu</Label>
                      <Input className="h-8 text-xs" type="number" step="0.5" value={secili.size ?? 11} onChange={(ev) => ogeGuncelle(secili.id, { size: Number(ev.target.value) || 11 })} />
                    </div>
                    {hizaSatiri((d) => ogeGuncelle(secili.id, d), secili.hiza, secili.dikeyHiza)}
                    <label className="flex items-center gap-2 text-xs"><Checkbox checked={!!secili.kalin} onCheckedChange={(v) => ogeGuncelle(secili.id, { kalin: v === true })} />Kalın</label>
                    <div className="space-y-1"><Label className="text-[11px]">Yazı rengi</Label>
                      <RenkSecici deger={secili.renk} bosEtiket="Varsayılan (siyah)" onChange={(v) => ogeGuncelle(secili.id, { renk: v })} />
                    </div>
                  </>
                )}
                {secili.tip === 'gorsel' && (
                  <div className="space-y-1"><Label className="text-[11px]">Yatay hizalama</Label>
                    <div className="flex gap-1">
                      {([['sol', AlignLeft, 'Sola'], ['orta', AlignCenter, 'Ortaya'], ['sag', AlignRight, 'Sağa']] as const).map(([v, Ikon, ad]) => (
                        <button key={v} type="button" title={ad} aria-label={ad} onClick={() => ogeGuncelle(secili.id, { hiza: v })}
                          className={`inline-flex h-7 w-7 items-center justify-center rounded border ${(secili.hiza ?? 'sol') === v ? 'border-[#2AA5C7] bg-[#DCEDF5]' : 'border-slate-200 bg-white hover:bg-slate-50'}`}><Ikon className="h-3.5 w-3.5" /></button>
                      ))}
                    </div>
                  </div>
                )}
                {secili.tip !== 'cizgi' && (
                  <div className="space-y-1"><Label className="text-[11px]">{secili.tip === 'kutu' ? 'Dolgu rengi' : 'Arka plan rengi'}</Label>
                    <RenkSecici deger={secili.zemin} bosEtiket="Saydam" onChange={(v) => ogeGuncelle(secili.id, { zemin: v })} />
                  </div>
                )}
                {(secili.tip === 'alan' || secili.tip === 'toplam') && (
                  <>
                    <div className="space-y-1"><Label className="text-[11px]">Biçim</Label>
                      <NativeSelect className="h-8 text-xs" value={secili.bicim ?? ''} onChange={(ev) => ogeGuncelle(secili.id, { bicim: (ev.target.value || undefined) as Bicim | undefined } as Partial<TuvalOge>)}>
                        {BICIMLER.map((b) => <option key={b} value={b}>{b || 'Varsayılan'}</option>)}
                      </NativeSelect>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between"><Label className="text-[11px]">Koşullu biçim</Label>
                        <button type="button" className="text-[11px] text-[#1B4F72] hover:underline" onClick={() => ogeGuncelle(secili.id, { kosulluBicim: [...(secili.kosulluBicim ?? []), { kosul: `{${secili.alan}} < 90`, renk: 'kritik' }] } as Partial<TuvalOge>)}><Plus className="h-3 w-3 inline" />Kural</button>
                      </div>
                      {(secili.kosulluBicim ?? []).map((k, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <Input className="h-7 text-[11px] font-mono" value={k.kosul} onChange={(ev) => ogeGuncelle(secili.id, { kosulluBicim: (secili.kosulluBicim ?? []).map((x, j) => (j === i ? { ...x, kosul: ev.target.value } : x)) } as Partial<TuvalOge>)} />
                          <NativeSelect className="h-7 text-[11px] w-20" value={k.renk ?? ''} onChange={(ev) => ogeGuncelle(secili.id, { kosulluBicim: (secili.kosulluBicim ?? []).map((x, j) => (j === i ? { ...x, renk: (ev.target.value || undefined) as 'kritik' | 'iyi' | 'uyari' | undefined } : x)) } as Partial<TuvalOge>)}>
                            <option value="">renk</option><option value="kritik">kritik</option><option value="uyari">uyarı</option><option value="iyi">iyi</option>
                          </NativeSelect>
                          <button type="button" className="text-red-600" onClick={() => ogeGuncelle(secili.id, { kosulluBicim: (secili.kosulluBicim ?? []).filter((_, j) => j !== i) } as Partial<TuvalOge>)}><Trash2 className="h-3 w-3" /></button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {(secili.tip === 'cizgi' || secili.tip === 'kutu') && (
                  <div className="space-y-1">
                    <div className="space-y-1"><Label className="text-[11px]">Kalınlık</Label><Input className="h-8 text-xs" type="number" step="0.5" value={secili.kalinlik ?? 1.5} onChange={(ev) => ogeGuncelle(secili.id, { kalinlik: Number(ev.target.value) || 1 } as Partial<TuvalOge>)} /></div>
                    <Label className="text-[11px]">Çizgi rengi</Label>
                    <RenkSecici deger={secili.renk} bosEtiket="Varsayılan (lacivert)" onChange={(v) => ogeGuncelle(secili.id, { renk: v })} />
                  </div>
                )}
                <div className="space-y-1"><Label className="text-[11px]">Bant</Label>
                  <NativeSelect className="h-8 text-xs" value={secili.bant} onChange={(ev) => ogeGuncelle(secili.id, { bant: ev.target.value as TuvalBantId })}>
                    {BANT_SIRASI.map((b) => <option key={b} value={b}>{BANT_ADI[b]}</option>)}
                  </NativeSelect>
                </div>
                <Button variant="outline" size="sm" className="w-full text-red-600 border-red-200 hover:bg-red-50" onClick={() => ogeSil([secili.id])}><Trash2 className="h-3.5 w-3.5 mr-1.5" />Öğeyi sil</Button>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* Önizleme */}
      {parametreler.length > 0 && (
        <Card>
          <CardContent className="p-3 flex flex-wrap items-end gap-3">
            <span className="text-xs text-muted-foreground pb-2">Önizleme parametreleri:</span>
            {parametreler.map((p) => (
              <div key={p.ad} className="space-y-1 min-w-[160px]">
                <Label className="text-[11px]">{p.etiket}</Label>
                {p.tip === 'tarih'
                  ? <DateField id={`oz-${p.ad}`} value={onizParam[p.ad] ?? ''} onChange={(v) => setOnizParam((m) => ({ ...m, [p.ad]: v }))} takvim />
                  : <Input className="h-8" type={p.tip === 'sayi' ? 'number' : 'text'} value={onizParam[p.ad] ?? ''} onChange={(ev) => setOnizParam((m) => ({ ...m, [p.ad]: ev.target.value }))} />}
              </div>
            ))}
            {onizHata && <div className="w-full"><HataKutusu hata={onizHata} /></div>}
          </CardContent>
        </Card>
      )}

      <Dialog open={onizBuyuk} onOpenChange={setOnizBuyuk}>
        <DialogContent className="max-w-[96vw] w-[96vw] h-[92vh] flex flex-col p-4 gap-3">
          <DialogHeader className="shrink-0"><DialogTitle className="text-base flex items-center gap-2"><Maximize2 className="h-4 w-4" />Önizleme — {onizBilgi}</DialogTitle></DialogHeader>
          {onizHtml && <iframe title="Tuval önizleme" srcDoc={onizHtml} sandbox="allow-same-origin allow-modals" className="flex-1 min-h-0 w-full bg-white border rounded" />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
