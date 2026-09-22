'use client'

/**
 * Etkileşimli rapor ekranı — referans: "ILERIHub — Etkileşimli Rapor (mockup)" artifact'ı.
 * Ham satırlar /api/raporlar/[id]/veri'den gelir; görünüm (filtre/sıra/grup/toplam/grafik/KPI)
 * TARAYICIDA gorunumUygula ile kurulur — Excel sunucuda AYNI fonksiyonu çağırır.
 * Doğal dil çubuğu: /api/raporlar/[id]/ai — istek SUNUCUDA Claude'a gider (API anahtarı
 * istemciye asla inmez), dönen görünüm doğrulanmış olarak uygulanır; geri al yığını tutulur.
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { DateField } from '@/components/ui/date-field'
import { NativeSelect } from '@/components/ui/select'
import { AlertTriangle, FileBarChart2, FileSpreadsheet, GripVertical, Loader2, Play, Printer, RotateCcw, Save, Sparkles, Undo2, X } from 'lucide-react'
import { gorunumUygula, MAX_GRUP, type GrupDugum, type KolonTipi, type Satir } from '@/lib/rapor/gorunum'
import { bicimle } from '@/lib/rapor/bicim'
import { gorunumHtml } from '@/lib/rapor/gorunum-html'
import type { EtkilesimliIcerik, Gorunum, GorunumKolon, GorunumToplamFn, SablonParametre } from '@/lib/rapor/tipler'
import type { VeriSetiAlan } from '@/lib/rapor/veri-seti-alanlar'
import { GeriRozet, RozetLink } from '../../_components/rozet-link'
import { TUR_ADI } from '@/lib/rapor/tur-adlari'

const NAVY = '#1B4F72'
const CYAN = '#2AA5C7'
/**
 * İlk çizimde TOPLAM en fazla bu kadar detay satırı çizilir (tüm gruplar dahil, küresel bütçe);
 * kalanı segment başına "Devamını göster" ile açılır. Ölçüm (dev, 2.000 satır): hesap 5–15 ms,
 * çizim ≈ 0,85 s / 500 satır → tamamı 3 s+; bütçe ilk boyamayı sabit tutar.
 */
const DETAY_BUTCESI = 500

interface Props {
  sablon: { id: string; kod: string; ad: string; aciklama: string; durum: 'TASLAK' | 'YAYINDA' | 'ARSIV'; surum: number; veriSetiId: string; veriSetiAd: string; izinAnahtari: string }
  icerik: EtkilesimliIcerik
  alanlar: VeriSetiAlan[]
  tasarlayabilir: boolean
}

const TOPLAM_SIRASI: (GorunumToplamFn | undefined)[] = [undefined, 'topla', 'ortalama', 'say', 'enkucuk', 'enbuyuk']
const TOPLAM_SIMGE: Record<GorunumToplamFn, string> = { topla: 'Σ', ortalama: 'x̄', say: '#', enkucuk: 'min', enbuyuk: 'max' }
const TOPLAM_AD: Record<GorunumToplamFn, string> = { topla: 'Toplam', ortalama: 'Ortalama', say: 'Sayı', enkucuk: 'En küçük', enbuyuk: 'En büyük' }

/** Şablon görünümünü veri setinin güncel alanlarıyla birleştirir: yeni alanlar gizli olarak eklenir, silinenler düşer. */
function gorunumuHizala(g: Gorunum, alanlar: VeriSetiAlan[]): Gorunum {
  const hesaplananlar = new Set((g.hesaplananAlanlar ?? []).map((h) => h.ad))
  const mevcut = new Set(alanlar.map((a) => a.ad))
  const kolonlar: GorunumKolon[] = g.kolonlar.filter((k) => mevcut.has(k.alan) || hesaplananlar.has(k.alan))
  const var_ = new Set(kolonlar.map((k) => k.alan))
  for (const a of alanlar) if (!var_.has(a.ad)) kolonlar.push({ alan: a.ad, gorunur: false, ...(a.veriTipi === 'sayi' ? { bicim: '#.##0' as const } : a.veriTipi === 'tarih' ? { bicim: 'gg.aa.yyyy' as const } : {}) })
  for (const h of g.hesaplananAlanlar ?? []) if (!var_.has(h.ad)) kolonlar.push({ alan: h.ad, gorunur: true, bicim: h.bicim })
  return { ...g, kolonlar, gruplar: (g.gruplar ?? []).filter((x) => mevcut.has(x) || hesaplananlar.has(x)).slice(0, MAX_GRUP), filtreler: g.filtreler ?? {} }
}

/** %'li biçim → verim benzeri oran: <90 kritik, ≥95 iyi. */
function kosulluSinif(k: GorunumKolon, v: unknown): string {
  if (!k.bicim?.startsWith('%') || v === null || v === undefined) return ''
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return ''
  return n < 90 ? 'text-red-700 font-semibold' : n >= 95 ? 'text-green-700' : ''
}

const tipSimgesi = (tip: KolonTipi, hesaplanan: boolean) => (hesaplanan ? 'fx' : tip === 'sayi' ? '12' : tip === 'tarih' ? '◷' : 'Aa')

/**
 * Örnek istek çipleri — SABİT değil, veri setinin kendi alanlarından üretilir:
 * ilk metin alanına göre grupla, ilk sayı alanına göre sırala, oran/% alanı varsa eşik süzgeci,
 * tarih alanı varsa geciken kaydı. En fazla 4 çip.
 */
function ornekCipler(
  kolonlar: GorunumKolon[],
  tipler: Record<string, KolonTipi>,
  baslik: (alan: string) => string,
  hesaplananAdlari: Set<string>,
): string[] {
  const tip = (k: GorunumKolon) => tipler[k.alan] ?? (hesaplananAdlari.has(k.alan) ? 'sayi' : 'metin')
  const metinler = kolonlar.filter((k) => tip(k) === 'metin')
  const sayilar = kolonlar.filter((k) => tip(k) === 'sayi')
  const tarihler = kolonlar.filter((k) => tip(k) === 'tarih')
  const oran = kolonlar.find((k) => k.bicim?.startsWith('%'))
  const cipler: string[] = []
  if (metinler[0]) cipler.push(`${baslik(metinler[0].alan).toLocaleLowerCase('tr-TR')} bazında grupla`)
  if (oran) cipler.push(`${baslik(oran.alan).toLocaleLowerCase('tr-TR')} 90'ın altında olanlar`)
  if (sayilar[0]) cipler.push(`en yüksek ${baslik(sayilar[0].alan).toLocaleLowerCase('tr-TR')} üstte olacak şekilde sırala`)
  if (tarihler[0] && cipler.length < 4) cipler.push(`${baslik(tarihler[0].alan).toLocaleLowerCase('tr-TR')} tarihi geçmiş olanlar`)
  if (metinler[1] && sayilar[0] && cipler.length < 4) {
    cipler.push(`${baslik(metinler[1].alan).toLocaleLowerCase('tr-TR')} bazında ${baslik(sayilar[0].alan).toLocaleLowerCase('tr-TR')} grafiği`)
  }
  return cipler.slice(0, 4)
}

// ── dnd: sol liste öğesi + GRUPLA alanı ─────────────────────────────────

function SurukleAlan({ alan, children }: { alan: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `alan:${alan}`, data: { alan } })
  return <div ref={setNodeRef} {...attributes} {...listeners} className={`touch-manipulation ${isDragging ? 'opacity-40' : ''}`}>{children}</div>
}

function GruplaAlani({ gecerlilik, children }: { gecerlilik: (alan: string) => string | null; children: React.ReactNode }) {
  const { setNodeRef, isOver, active } = useDroppable({ id: 'drop:gruplar' })
  const alan = (active?.data.current as { alan?: string } | undefined)?.alan
  const hata = isOver && alan ? gecerlilik(alan) : null
  return (
    <div ref={setNodeRef} data-birak="drop:gruplar" className={`flex flex-wrap items-center gap-1.5 rounded-lg border-[1.5px] border-dashed px-2 py-1.5 min-h-[36px] bg-white transition-colors ${isOver ? (hata ? 'border-red-500 bg-red-50' : 'border-[#2AA5C7] bg-[#DCEDF5]') : 'border-slate-300'}`}>
      <span className="text-[11px] font-semibold text-slate-500 tracking-wide">GRUPLA</span>
      {children}
      {isOver && hata && <span className="text-[11px] text-red-700">{hata}</span>}
    </div>
  )
}

// ── Bileşen ─────────────────────────────────────────────────────────────

export default function EtkilesimliRapor({ sablon, icerik, alanlar, tasarlayabilir }: Props) {
  const varsayilan = useMemo(() => gorunumuHizala(icerik.gorunum, alanlar), [icerik.gorunum, alanlar])
  const [gorunum, setGorunum] = useState<Gorunum>(varsayilan)
  const [kayitliGorunum, setKayitliGorunum] = useState<Gorunum>(varsayilan)
  const [surum, setSurum] = useState(sablon.surum)
  const etiketler = useMemo(() => Object.fromEntries(alanlar.map((a) => [a.ad, a.etiket])) as Record<string, string | null>, [alanlar])
  /** alan → (ham değer → Türkçe gösterim). Katalogdan gelir; YALNIZ gösterimde kullanılır. */
  const degerEtiketleri = useMemo(
    () => Object.fromEntries(alanlar.filter((a) => a.degerEtiketleri).map((a) => [a.ad, a.degerEtiketleri!])) as Record<string, Record<string, string>>,
    [alanlar],
  )
  /** Hücre/seçenek gösterimi: etiket varsa Türkçesi, yoksa biçimli ham değer. */
  const gosterim = useCallback((alan: string, v: unknown, bicim?: GorunumKolon['bicim']) => degerEtiketleri[alan]?.[String(v)] ?? bicimle(v, bicim), [degerEtiketleri])
  const hesaplananAdlari = useMemo(() => new Set((gorunum.hesaplananAlanlar ?? []).map((h) => h.ad)), [gorunum.hesaplananAlanlar])
  const baslik = useCallback((alan: string) => gorunum.kolonlar.find((k) => k.alan === alan)?.baslik ?? etiketler[alan] ?? alan, [gorunum.kolonlar, etiketler])

  // Parametreler + veri
  const parametreler: SablonParametre[] = icerik.parametreler ?? []
  const [paramDegerleri, setParamDegerleri] = useState<Record<string, string>>({})
  const [veri, setVeri] = useState<Satir[] | null>(null)
  const [veriBilgi, setVeriBilgi] = useState<{ sureMs: number; toplamSatir: number; uyari?: string } | null>(null)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [excelIniyor, setExcelIniyor] = useState(false)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const eksikZorunlu = parametreler.filter((p) => p.zorunlu && !(paramDegerleri[p.ad] ?? '').trim()).map((p) => p.etiket)

  const calistir = useCallback(async () => {
    setYukleniyor(true); setHata(null)
    try {
      const r = await fetch(`/api/raporlar/${sablon.id}/veri`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parametreler: paramDegerleri }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`)
      setVeri(d.satirlar)
      setVeriBilgi({ sureMs: d.sureMs, toplamSatir: d.toplamSatir, uyari: d.uyari })
      setKapali(new Set()); setAcilanSegmentler(new Set())
    } catch (e) { setVeri(null); setHata(e instanceof Error ? e.message : String(e)) }
    finally { setYukleniyor(false) }
  }, [sablon.id, paramDegerleri])

  // Parametresiz rapor: girişte otomatik çalıştır.
  const otomatikRef = useRef(false)
  useEffect(() => { if (!parametreler.length && !otomatikRef.current) { otomatikRef.current = true; void calistir() } }, [parametreler.length, calistir])

  // Görünüm hesabı (ölçümlü)
  const [kapali, setKapali] = useState<Set<string>>(new Set())
  const [acilanSegmentler, setAcilanSegmentler] = useState<Set<string>>(new Set())
  const [cizimMs, setCizimMs] = useState<number | null>(null)
  const { sonuc, hesapMs } = useMemo(() => {
    if (!veri) return { sonuc: null, hesapMs: 0 }
    const t0 = performance.now()
    const s = gorunumUygula(veri, gorunum, { degerEtiketleri })
    return { sonuc: s, hesapMs: Math.round(performance.now() - t0) }
  }, [veri, gorunum, degerEtiketleri])
  // Çizim süresi: bu render'ın başlangıcından commit sonrasına (grup aç/kapa, devamını göster dahil).
  const renderBaslangic = performance.now()
  useEffect(() => { if (sonuc) setCizimMs(Math.round(performance.now() - renderBaslangic)) }, [sonuc, kapali, acilanSegmentler]) // eslint-disable-line react-hooks/exhaustive-deps

  const grupSet = useMemo(() => new Set(gorunum.gruplar), [gorunum.gruplar])
  const gorunurKolonlar = useMemo(() => gorunum.kolonlar.filter((k) => k.gorunur && !grupSet.has(k.alan)), [gorunum.kolonlar, grupSet])
  const tipler = useMemo<Record<string, KolonTipi>>(() => sonuc?.kolonTipleri ?? {}, [sonuc])
  const toplamVar = gorunurKolonlar.some((k) => k.toplam)
  const degisti = useMemo(() => JSON.stringify(gorunum) !== JSON.stringify(kayitliGorunum), [gorunum, kayitliGorunum])

  // Metin kolonlarında ≤12 farklı değer → açılır liste süzgeci (referans: Durum)
  const secenekler = useMemo(() => {
    const out: Record<string, string[]> = {}
    if (!veri) return out
    for (const k of gorunum.kolonlar) {
      if (tipler[k.alan] !== 'metin') continue
      const s = new Set<string>()
      for (const r of veri) { const v = r[k.alan]; if (v !== null && v !== undefined && v !== '') s.add(String(v)); if (s.size > 12) break }
      if (s.size > 0 && s.size <= 12) out[k.alan] = [...s].sort((a, b) => a.localeCompare(b, 'tr-TR'))
    }
    return out
  }, [veri, gorunum.kolonlar, tipler])

  // ── Doğal dil çubuğu ──────────────────────────────────────────────────
  const [aiIstek, setAiIstek] = useState('')
  const [aiCalisiyor, setAiCalisiyor] = useState(false)
  const [aiSerit, setAiSerit] = useState<{ aciklama: string; uyari: boolean } | null>(null)
  /** Geri al yığını: AI her görünüm kurduğunda öncekini iter (çok adım geri alınabilir). */
  const [aiGecmis, setAiGecmis] = useState<Gorunum[]>([])

  /**
   * Süzgeç doğruluğu için modele örnek değerler: ≤20 farklı değeri olan METİN kolonları
   * (Durum: Planned/Released/…, tezgah adları). Veri yoksa boş gider — kutu yine çalışır.
   */
  const ornekDegerler = useMemo(() => {
    const out: Record<string, string[]> = {}
    if (!veri) return out
    for (const k of gorunum.kolonlar) {
      if ((tipler[k.alan] ?? 'metin') !== 'metin') continue
      const s = new Set<string>()
      for (const r of veri) {
        const v = r[k.alan]
        if (v === null || v === undefined || v === '') continue
        s.add(String(v))
        if (s.size > 20) break
      }
      if (s.size > 0 && s.size <= 20) out[k.alan] = [...s].sort((a, b) => a.localeCompare(b, 'tr-TR'))
    }
    return out
  }, [veri, gorunum.kolonlar, tipler])

  const cipler = useMemo(
    () => ornekCipler(gorunum.kolonlar, tipler, baslik, hesaplananAdlari),
    [gorunum.kolonlar, tipler, baslik, hesaplananAdlari],
  )

  const aiGonder = useCallback(async (metin: string) => {
    const istek = metin.trim()
    if (!istek || aiCalisiyor) return
    setAiCalisiyor(true)
    try {
      const r = await fetch(`/api/raporlar/${sablon.id}/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ istek, mevcutGorunum: gorunum, ornekDegerler }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`)
      if (d.anlasilmadi || !d.gorunum) {
        setAiSerit({ aciklama: d.aciklama ?? 'İstek anlaşılamadı.', uyari: true })
        return
      }
      setAiGecmis((y) => [...y, gorunum])
      setGorunum(gorunumuHizala(d.gorunum as Gorunum, alanlar))
      setKapali(new Set()); setAcilanSegmentler(new Set())
      setAiSerit({ aciklama: d.aciklama ?? 'Görünüm güncellendi.', uyari: false })
      setAiIstek('')
    } catch (e) {
      setAiSerit({ aciklama: e instanceof Error ? e.message : String(e), uyari: true })
    } finally {
      setAiCalisiyor(false)
    }
  }, [aiCalisiyor, gorunum, ornekDegerler, sablon.id, alanlar])

  const aiGeriAl = () => {
    setAiGecmis((y) => {
      if (!y.length) return y
      setGorunum(y[y.length - 1])
      setKapali(new Set()); setAcilanSegmentler(new Set())
      setAiSerit(null)
      return y.slice(0, -1)
    })
  }

  // ── Görünüm işlemleri ─────────────────────────────────────────────────
  const kolonGuncelle = (alan: string, d: Partial<GorunumKolon>) => setGorunum((g) => ({ ...g, kolonlar: g.kolonlar.map((k) => (k.alan === alan ? { ...k, ...d } : k)) }))
  const siralaTikla = (alan: string) => setGorunum((g) => ({ ...g, siralama: g.siralama?.alan === alan ? (g.siralama.yon === 1 ? { alan, yon: -1 } : null) : { alan, yon: 1 } }))
  const toplamDondur = (k: GorunumKolon) => {
    const sonraki = TOPLAM_SIRASI[(TOPLAM_SIRASI.indexOf(k.toplam) + 1) % TOPLAM_SIRASI.length]
    kolonGuncelle(k.alan, { toplam: sonraki })
    if (sonraki) toast(`${baslik(k.alan)}: ${TOPLAM_AD[sonraki]} — grup ve genel toplam satırlarında`)
  }
  const filtreYaz = (alan: string, v: string) => setGorunum((g) => { const f = { ...g.filtreler }; if (v) f[alan] = v; else delete f[alan]; return { ...g, filtreler: f } })
  const grupGecerlilik = (alan: string) => grupSet.has(alan) ? 'Zaten gruplu' : gorunum.gruplar.length >= MAX_GRUP ? `En fazla ${MAX_GRUP} seviye` : (tipler[alan] ?? 'metin') !== 'metin' ? 'Sayı/tarih kolonuna göre gruplama yerine filtre kullanın' : null
  const grupEkle = (alan: string) => { const h = grupGecerlilik(alan); if (h) toast.warning(h); else setGorunum((g) => ({ ...g, gruplar: [...g.gruplar, alan] })) }
  const grupSil = (i: number) => setGorunum((g) => ({ ...g, gruplar: g.gruplar.filter((_, j) => j !== i) }))
  const varsayilanaDon = () => { setGorunum(kayitliGorunum); setKapali(new Set()); setAcilanSegmentler(new Set()) }
  const grupAcKapa = (anahtar: string) => setKapali((s) => { const n = new Set(s); n.has(anahtar) ? n.delete(anahtar) : n.add(anahtar); return n })

  // dnd
  const [surukleAlan, setSurukleAlan] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }), useSensor(KeyboardSensor))
  const onDragStart = (e: DragStartEvent) => setSurukleAlan((e.active.data.current as { alan?: string })?.alan ?? null)
  const onDragEnd = (e: DragEndEvent) => { setSurukleAlan(null); const alan = (e.active.data.current as { alan?: string })?.alan; if (alan && e.over?.id === 'drop:gruplar') grupEkle(alan) }

  // ── Excel / kaydet ────────────────────────────────────────────────────
  /** Görünümün aynısını A4 HTML'e çevirip gizli iframe'de print() — kullanıcı "PDF olarak kaydet" seçer. */
  const yazdirIframe = useRef<HTMLIFrameElement | null>(null)
  function yazdir() {
    if (!veri) return
    const { html, yon, satirSayisi } = gorunumHtml(icerik.baslik || sablon.ad, icerik.altBaslik, veri, gorunum, {
      parametreler: Object.fromEntries(parametreler.map((p) => [p.ad, p.tip === 'tarih' && paramDegerleri[p.ad] ? new Date(paramDegerleri[p.ad]) : paramDegerleri[p.ad]])),
      parametreTanimlari: parametreler,
      raporKodu: sablon.kod,
      basliklar: Object.fromEntries(gorunum.kolonlar.map((k) => [k.alan, baslik(k.alan)])),
      degerEtiketleri,
    })
    yazdirIframe.current?.remove()
    const f = document.createElement('iframe')
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
    f.setAttribute('aria-hidden', 'true')
    document.body.appendChild(f)
    yazdirIframe.current = f
    f.onload = () => { try { f.contentWindow?.focus(); f.contentWindow?.print() } catch { toast.error('Yazdırma penceresi açılamadı') } }
    f.srcdoc = html
    toast(`Yazdırma hazır: ${satirSayisi.toLocaleString('tr-TR')} satır, A4 ${yon === 'landscape' ? 'yatay' : 'dikey'} — PDF için "PDF olarak kaydet"i seçin`)
  }
  useEffect(() => () => yazdirIframe.current?.remove(), [])

  async function excelIndir() {
    setExcelIniyor(true)
    try {
      const r = await fetch(`/api/raporlar/${sablon.id}/excel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parametreler: paramDegerleri, gorunum }) })
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error ?? `HTTP ${r.status}`) }
      const url = URL.createObjectURL(await r.blob())
      const a = document.createElement('a'); a.href = url; a.download = `${sablon.kod}.xlsx`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
      toast.success('Excel indirildi — görünen kolonlar, gruplar ve toplamlarla')
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)) }
    finally { setExcelIniyor(false) }
  }
  async function gorunumuKaydet() {
    setKaydediliyor(true)
    try {
      const r = await fetch(`/api/raporlar/sablonlar/${sablon.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kod: sablon.kod, ad: sablon.ad, aciklama: sablon.aciklama, veriSetiId: sablon.veriSetiId, durum: sablon.durum, izinAnahtari: sablon.izinAnahtari || null, icerik: { ...icerik, gorunum } }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error([d.error, ...(d.hatalar ?? [])].filter(Boolean).join(' · '))
      setKayitliGorunum(gorunum); setSurum(d.sablon.surum)
      toast.success(`Görünüm kaydedildi (sürüm ${d.sablon.surum}) — herkes bu görünümle açar`)
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)) }
    finally { setKaydediliyor(false) }
  }

  // ── Tablo satırları ───────────────────────────────────────────────────
  const hucre = (k: GorunumKolon, v: unknown) => {
    const metin = gosterim(k.alan, v, k.bicim)
    const sec = secenekler[k.alan]
    return <td key={k.alan} className={`px-2 py-1 border-b border-slate-200 whitespace-nowrap ${tipler[k.alan] === 'sayi' ? 'text-right font-mono text-[12px]' : ''} ${kosulluSinif(k, v)}`}>{sec && metin ? <span className="text-[10.5px] px-1.5 py-px rounded-full border border-slate-300">{metin}</span> : metin}</td>
  }
  // Küresel çizim bütçesi: her render'da sıfırlanır; açık (opt-in) segmentler bütçeye sayılmaz.
  const butce = { kalan: DETAY_BUTCESI }
  const detaySatirlari = (satirlar: Satir[], segment: string) => {
    const acik = acilanSegmentler.has(segment)
    const adet = acik ? satirlar.length : Math.min(satirlar.length, butce.kalan)
    if (!acik) butce.kalan -= adet
    const gosterilen = adet === satirlar.length ? satirlar : satirlar.slice(0, adet)
    return (
      <>
        {gosterilen.map((s, i) => <tr key={`${segment}#${i}`} className="hover:bg-slate-50">{gorunurKolonlar.map((k) => hucre(k, s[k.alan]))}</tr>)}
        {adet < satirlar.length && (
          <tr><td colSpan={gorunurKolonlar.length} className="px-2 py-1.5 border-b border-slate-200 bg-slate-50">
            <button type="button" className="text-xs text-[#1B4F72] hover:underline" onClick={() => setAcilanSegmentler((a) => new Set(a).add(segment))}>Devamını göster (+{(satirlar.length - adet).toLocaleString('tr-TR')} satır)</button>
          </td></tr>
        )}
      </>
    )
  }
  const toplamSatiri = (etiket: string, toplamlar: Record<string, number | null>, sinif: string, key: string) => (
    <tr key={key} className={sinif}>
      {gorunurKolonlar.map((k, i) => {
        const v = k.toplam ? toplamlar[k.alan] : undefined
        const metin = v === undefined || v === null ? (i === 0 ? etiket : '') : k.toplam === 'say' ? String(v) : bicimle(v, k.bicim)
        return <td key={k.alan} className={`px-2 py-1 whitespace-nowrap ${tipler[k.alan] === 'sayi' ? 'text-right font-mono text-[12px]' : ''} ${k.toplam && k.toplam !== 'say' ? kosulluSinif(k, v) : ''}`}>{metin}</td>
      })}
    </tr>
  )
  const grupSatirlari = (g: GrupDugum): React.ReactNode => {
    const kapaliMi = kapali.has(g.anahtar)
    return (
      <Fragment key={g.anahtar}>
        <tr className="cursor-pointer select-none" onClick={() => grupAcKapa(g.anahtar)}>
          <td colSpan={gorunurKolonlar.length} className={`px-2 py-1.5 border-b border-slate-200 bg-[#F4F7FA] font-semibold text-[#1B4F72] ${g.seviye ? 'pl-7' : ''}`}>
            {kapaliMi ? '▸' : '▾'} {baslik(g.alan)}: {g.etiket} <span className="font-normal text-slate-500">· {g.satirSayisi.toLocaleString('tr-TR')} satır</span>
          </td>
        </tr>
        {!kapaliMi && (g.altGruplar.length ? g.altGruplar.map(grupSatirlari) : detaySatirlari(g.satirlar, g.anahtar))}
        {!kapaliMi && toplamVar && toplamSatiri(`${g.etiket} toplamı`, g.toplamlar, 'font-semibold border-b-[1.5px] border-slate-300', `${g.anahtar}#t`)}
      </Fragment>
    )
  }

  const metinKolonlar = gorunum.kolonlar.filter((k) => (tipler[k.alan] ?? 'metin') === 'metin' && !hesaplananAdlari.has(k.alan))
  const sayiKolonlar = gorunum.kolonlar.filter((k) => tipler[k.alan] === 'sayi')
  const grafik = gorunum.grafik

  return (
    <div className="space-y-3">
      {/* ÜST */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <GeriRozet href="/raporlar">Raporlar</GeriRozet>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight flex items-center gap-3">
            <FileBarChart2 className="h-6 w-6" style={{ color: NAVY }} />
            {icerik.baslik || sablon.ad}
            <Badge className="bg-[#DCEDF5] text-[#1B4F72] hover:bg-[#DCEDF5]">{TUR_ADI.etkilesimli}</Badge>
            {sablon.durum === 'TASLAK' && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Taslak</Badge>}
            <Badge variant="outline" className="font-normal">sürüm {surum}</Badge>
          </h1>
          <p className="text-sm text-muted-foreground mt-1"><span className="font-mono">{sablon.kod}</span> · veri seti: <span className="font-mono">{sablon.veriSetiAd}</span>{icerik.altBaslik ? ` · ${icerik.altBaslik}` : ''}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={yazdir} disabled={!veri} title="Mevcut görünümü A4 olarak yazdır / PDF kaydet"><Printer className="h-4 w-4 mr-1.5" />PDF / Yazdır</Button>
          <Button variant="outline" size="sm" onClick={excelIndir} disabled={!veri || excelIniyor}>{excelIniyor ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-1.5" />}Excel</Button>
          <Button variant="outline" size="sm" onClick={varsayilanaDon} disabled={!degisti} title="Kayıtlı görünüme dön"><RotateCcw className="h-4 w-4 mr-1.5" />Varsayılana dön</Button>
          {tasarlayabilir && <Button size="sm" onClick={gorunumuKaydet} disabled={!degisti || kaydediliyor} style={{ backgroundColor: CYAN, color: '#06222C' }} className="font-semibold">{kaydediliyor ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}Görünümü kaydet</Button>}
          {tasarlayabilir && <RozetLink href="/raporlar/veri-setleri" className="text-xs">Veri setleri</RozetLink>}
        </div>
      </div>

      {/* Doğal dil çubuğu — görünümü sunucudaki yapay zekâ kurar (anahtar istemciye inmez) */}
      <div className="rounded-lg border bg-white px-4 py-3">
        <div className="flex gap-2 max-w-4xl">
          <div className="relative flex-1">
            <Sparkles className="h-4 w-4 absolute left-3 top-2.5 text-[#2AA5C7]" />
            <Input
              className="pl-9 border-[#2AA5C7]/60"
              value={aiIstek}
              onChange={(e) => setAiIstek(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void aiGonder(aiIstek) } }}
              disabled={aiCalisiyor}
              maxLength={500}
              placeholder="Ne görmek istiyorsun? Örn: tezgaha göre grupla, verimi 90'ın altındakiler"
            />
          </div>
          <Button onClick={() => void aiGonder(aiIstek)} disabled={aiCalisiyor || !aiIstek.trim()} style={{ backgroundColor: NAVY }}>
            {aiCalisiyor ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}Oluştur
          </Button>
        </div>
        {cipler.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2 max-w-4xl">
            {cipler.map((c) => (
              <button
                key={c}
                type="button"
                disabled={aiCalisiyor}
                onClick={() => { setAiIstek(c); void aiGonder(c) }}
                className="text-[11px] rounded-full border border-[#2AA5C7]/50 bg-[#F2F9FC] text-[#1B4F72] px-2.5 py-1 hover:bg-[#DCEDF5] disabled:opacity-50"
              >
                {c}
              </button>
            ))}
          </div>
        )}
        {aiSerit && (
          <div className={`mt-2.5 flex items-start gap-2 rounded-md border px-3 py-2 text-xs max-w-4xl ${aiSerit.uyari ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-[#2AA5C7]/40 bg-[#F2F9FC] text-[#1B4F72]'}`}>
            {aiSerit.uyari ? <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> : <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
            <span className="flex-1">{aiSerit.uyari ? aiSerit.aciklama : <><span className="font-semibold">Kurulan görünüm:</span> {aiSerit.aciklama}</>}</span>
            {aiGecmis.length > 0 && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={aiGeriAl}>
                <Undo2 className="h-3 w-3 mr-1" />Geri al{aiGecmis.length > 1 ? ` (${aiGecmis.length})` : ''}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Parametreler */}
      {parametreler.length > 0 && (
        <Card>
          <CardContent className="p-4 flex flex-wrap items-end gap-3">
            {parametreler.map((p) => {
              const v = paramDegerleri[p.ad] ?? ''
              const set = (deger: string) => setParamDegerleri((d) => ({ ...d, [p.ad]: deger }))
              return (
                <div key={p.ad} className="space-y-1 min-w-[180px]">
                  <Label htmlFor={`p-${p.ad}`} className="text-xs">{p.etiket}{p.zorunlu && <span className="text-red-600 ml-0.5">*</span>}</Label>
                  {p.tip === 'tarih' ? <DateField id={`p-${p.ad}`} value={v} onChange={set} takvim /> : <Input id={`p-${p.ad}`} className="h-9" type={p.tip === 'sayi' ? 'number' : 'text'} value={v} onChange={(e) => set(e.target.value)} />}
                </div>
              )
            })}
            <Button onClick={calistir} disabled={yukleniyor || eksikZorunlu.length > 0} style={{ backgroundColor: NAVY }}>{yukleniyor ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}Çalıştır</Button>
            {eksikZorunlu.length > 0 && <span className="text-xs text-muted-foreground pb-2">Zorunlu: {eksikZorunlu.join(', ')}</span>}
            {veriBilgi && !yukleniyor && <span className="text-xs text-muted-foreground pb-2 ml-auto">{veriBilgi.toplamSatir.toLocaleString('tr-TR')} satır · {veriBilgi.sureMs} ms</span>}
          </CardContent>
        </Card>
      )}
      {hata && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{hata}</div>}
      {veriBilgi?.uyari && <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">{veriBilgi.uyari}</div>}
      {yukleniyor && !veri && <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Veri çekiliyor…</div>}

      {veri && sonuc && (
        <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setSurukleAlan(null)}>
          <div className="grid gap-3 lg:grid-cols-[210px_1fr] rounded-lg border bg-[#EEF1F4] overflow-hidden">
            {/* SOL — kolonlar */}
            <aside className="bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-3">
              <h4 className="m-0 mb-1.5 text-[11px] font-semibold text-slate-500 tracking-wide">KOLONLAR</h4>
              <ul className="list-none m-0 p-0 mb-3">
                {gorunum.kolonlar.map((k) => (
                  <SurukleAlan key={k.alan} alan={k.alan}>
                    <li className="flex items-center gap-1.5 px-1 py-1 rounded hover:bg-[#DCEDF5] cursor-grab active:cursor-grabbing text-[12.5px] select-none" title={hesaplananAdlari.has(k.alan) ? (gorunum.hesaplananAlanlar ?? []).find((h) => h.ad === k.alan)?.ifade : k.alan}>
                      <GripVertical className="h-3 w-3 shrink-0 text-slate-400" />
                      <input type="checkbox" className="m-0" checked={k.gorunur} onChange={(e) => kolonGuncelle(k.alan, { gorunur: e.target.checked })} onPointerDown={(e) => e.stopPropagation()} />
                      <span className="truncate flex-1">{baslik(k.alan)}</span>
                      <span className="ml-auto text-[9.5px] font-mono text-slate-500">{tipSimgesi(tipler[k.alan] ?? 'metin', hesaplananAdlari.has(k.alan))}</span>
                      {grupSet.has(k.alan) && <span className="text-[9px] text-[#2AA5C7]">grup</span>}
                    </li>
                  </SurukleAlan>
                ))}
              </ul>
              <p className="text-[11px] text-slate-500 leading-relaxed">İşaretle → tabloda göster.<br />Sürükle → <b>Grupla</b> alanına bırak.<br />Kolon başlığına tıkla → sırala.<br />Başlıktaki <b>Σ</b> → toplam / ortalama / say.</p>
            </aside>

            {/* SAĞ — çalışma alanı */}
            <main className="p-3 lg:p-4 min-w-0 overflow-auto">
              <div className="flex flex-wrap items-center gap-2 mb-2.5">
                <GruplaAlani gecerlilik={grupGecerlilik}>
                  {gorunum.gruplar.length === 0 && <span className="text-[11.5px] text-slate-500">Soldan bir kolonu buraya sürükle (en fazla {MAX_GRUP})</span>}
                  {gorunum.gruplar.map((alan, i) => (
                    <span key={alan} className="inline-flex items-center gap-1.5 bg-[#DCEDF5] border border-[#2AA5C7] rounded-full px-2.5 py-0.5 text-xs"><b>{i + 1}.</b> {baslik(alan)}<button type="button" className="text-slate-500 hover:text-slate-800" onClick={() => grupSil(i)} title="Kaldır"><X className="h-3 w-3" /></button></span>
                  ))}
                </GruplaAlani>
                <span className="ml-auto text-[11px] text-slate-500 tabular-nums">hesap {hesapMs} ms{cizimMs !== null ? ` · çizim ${cizimMs} ms` : ''}</span>
              </div>

              {/* KPI */}
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 mb-3">
                <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5"><div className="text-[11px] text-slate-500">Satır{sonuc.kpi.satirSayisi !== sonuc.kpi.toplamSatir ? <span className="text-slate-400"> / {sonuc.kpi.toplamSatir.toLocaleString('tr-TR')}</span> : null}</div><div className="text-xl font-semibold mt-0.5 tabular-nums">{sonuc.kpi.satirSayisi.toLocaleString('tr-TR')}</div></div>
                {sonuc.kpi.kartlar.slice(0, 3).map((k) => (
                  <div key={k.alan} className="bg-white border border-slate-200 rounded-lg px-3 py-2.5"><div className="text-[11px] text-slate-500">{TOPLAM_SIMGE[k.fn]} {baslik(k.alan)}</div><div className={`text-xl font-semibold mt-0.5 tabular-nums ${k.fn !== 'say' ? kosulluSinif(gorunum.kolonlar.find((x) => x.alan === k.alan)!, k.deger) : ''}`}>{k.deger === null ? '—' : k.fn === 'say' ? String(k.deger) : bicimle(k.deger, k.bicim)}</div></div>
                ))}
              </div>

              {/* Grafik */}
              <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 mb-3">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <h5 className="m-0 text-xs font-semibold text-[#1B4F72]">{grafik ? `${baslik(grafik.deger)} — ${baslik(grafik.grupla)} bazında (${grafik.fn === 'topla' ? 'Σ' : 'x̄'})` : 'Grafik'}</h5>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <NativeSelect className="h-7 text-[11px] w-auto py-0" value={grafik?.grupla ?? ''} onChange={(e) => setGorunum((g) => ({ ...g, grafik: e.target.value ? { grupla: e.target.value, deger: g.grafik?.deger ?? sayiKolonlar[0]?.alan ?? '', fn: g.grafik?.fn ?? 'topla' } : null }))}>
                      <option value="">Grafik yok</option>{metinKolonlar.map((k) => <option key={k.alan} value={k.alan}>{baslik(k.alan)}</option>)}
                    </NativeSelect>
                    <NativeSelect className="h-7 text-[11px] w-auto py-0" value={grafik?.deger ?? ''} disabled={!grafik} onChange={(e) => setGorunum((g) => ({ ...g, grafik: g.grafik ? { ...g.grafik, deger: e.target.value } : null }))}>
                      {sayiKolonlar.map((k) => <option key={k.alan} value={k.alan}>{baslik(k.alan)}</option>)}
                    </NativeSelect>
                    <NativeSelect className="h-7 text-[11px] w-auto py-0" value={grafik?.fn ?? 'topla'} disabled={!grafik} onChange={(e) => setGorunum((g) => ({ ...g, grafik: g.grafik ? { ...g.grafik, fn: e.target.value as 'topla' | 'ortalama' } : null }))}>
                      <option value="topla">Σ Toplam</option><option value="ortalama">x̄ Ortalama</option>
                    </NativeSelect>
                  </div>
                </div>
                {grafik && sonuc.grafikVerisi.length > 0 ? (
                  <div className="h-[190px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sonuc.grafikVerisi.slice(0, 40)} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="#E5E9EE" />
                        <XAxis dataKey="etiket" tick={{ fontSize: 11 }} interval={0} angle={sonuc.grafikVerisi.length > 8 ? -30 : 0} textAnchor={sonuc.grafikVerisi.length > 8 ? 'end' : 'middle'} height={sonuc.grafikVerisi.length > 8 ? 50 : 24} />
                        <YAxis tick={{ fontSize: 11 }} width={48} tickFormatter={(v: number) => v.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} />
                        <Tooltip formatter={(v: number) => [bicimle(v, gorunum.kolonlar.find((k) => k.alan === grafik.deger)?.bicim), baslik(grafik.deger)]} contentStyle={{ fontSize: 12 }} />
                        <Bar dataKey="deger" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                          {sonuc.grafikVerisi.slice(0, 40).map((_, i) => <Cell key={i} fill={i % 2 ? CYAN : NAVY} />)}
                          <LabelList dataKey="deger" position="top" fontSize={10} formatter={(v: number) => bicimle(v, gorunum.kolonlar.find((k) => k.alan === grafik.deger)?.bicim)} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    {sonuc.grafikVerisi.length > 40 && <div className="text-[10px] text-slate-500">İlk 40 kırılım gösteriliyor ({sonuc.grafikVerisi.length} toplam).</div>}
                  </div>
                ) : <p className="text-[11.5px] text-slate-500 m-0">Kırılım alanı seçin (metin kolonu) — çubuk grafik burada çizilir.</p>}
              </div>

              {/* Tablo */}
              <div className="bg-white border border-slate-200 rounded-lg overflow-auto max-h-[70vh]">
                <table className="border-collapse w-full text-[12.5px]">
                  <thead>
                    <tr>
                      {gorunurKolonlar.map((k) => (
                        <th key={k.alan} className="sticky top-0 z-[2] text-left font-medium p-0 whitespace-nowrap" style={{ backgroundColor: NAVY, color: '#fff' }}>
                          <div className="flex items-center gap-1.5 px-2 py-1.5">
                            <button type="button" className="flex-1 text-left cursor-pointer hover:underline" onClick={() => siralaTikla(k.alan)}>
                              {baslik(k.alan)}{gorunum.siralama?.alan === k.alan ? (gorunum.siralama.yon === 1 ? ' ▲' : ' ▼') : ''}
                            </button>
                            {tipler[k.alan] === 'sayi' && (
                              <button type="button" onClick={() => toplamDondur(k)} title="Toplam / Ortalama / Sayı / Min / Max" className={`text-[11px] rounded px-1.5 border ${k.toplam ? 'font-semibold' : 'opacity-70 border-white/40'}`} style={k.toplam ? { backgroundColor: CYAN, color: '#06222C', borderColor: CYAN } : undefined}>
                                {k.toplam ? TOPLAM_SIMGE[k.toplam] : 'Σ'}
                              </button>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {gorunurKolonlar.map((k) => (
                        <th key={k.alan} className="sticky top-[32px] z-[2] bg-[#F4F7FA] px-1.5 py-1 font-normal">
                          {secenekler[k.alan] ? (
                            <NativeSelect className="h-7 text-[11.5px] py-0 px-1.5" value={gorunum.filtreler[k.alan] ?? ''} onChange={(e) => filtreYaz(k.alan, e.target.value)}>
                              <option value="">Tümü</option>{secenekler[k.alan].map((v) => <option key={v} value={v}>{degerEtiketleri[k.alan]?.[v] ?? v}</option>)}
                            </NativeSelect>
                          ) : (
                            <input className="w-full h-7 text-[11.5px] px-1.5 rounded border border-slate-300 bg-white" value={gorunum.filtreler[k.alan] ?? ''} placeholder={tipler[k.alan] === 'sayi' ? '< 90' : 'süz…'} onChange={(e) => filtreYaz(k.alan, e.target.value)} />
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gorunurKolonlar.length === 0 && <tr><td className="p-4 text-sm text-slate-500">Görünür kolon yok — soldan işaretleyin.</td></tr>}
                    {sonuc.gruplar.length ? sonuc.gruplar.map(grupSatirlari) : detaySatirlari(sonuc.satirlar, 'duz')}
                    {sonuc.satirlar.length === 0 && gorunurKolonlar.length > 0 && <tr><td colSpan={gorunurKolonlar.length} className="p-4 text-sm text-slate-500 text-center">Süzgeçle eşleşen satır yok.</td></tr>}
                    {toplamVar && sonuc.satirlar.length > 0 && toplamSatiri('Genel toplam', sonuc.genelToplam, 'font-bold bg-[#F4F7FA] border-t-2 border-[#1B4F72]', 'genel')}
                  </tbody>
                </table>
              </div>
            </main>
          </div>
          <DragOverlay dropAnimation={null}>{surukleAlan && <div className="rounded-full bg-[#DCEDF5] border border-[#2AA5C7] px-2.5 py-0.5 text-xs shadow-lg opacity-90">{baslik(surukleAlan)}</div>}</DragOverlay>
        </DndContext>
      )}
    </div>
  )
}

