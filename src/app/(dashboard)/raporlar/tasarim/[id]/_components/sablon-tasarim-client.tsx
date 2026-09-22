'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, pointerWithin, useDraggable, useDroppable, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { NativeSelect } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DateField } from '@/components/ui/date-field'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArrowDown, ArrowUp, Columns3, FileBarChart2, GripVertical, Loader2, Maximize2, Play, Plus, Save, Sigma, Trash2 } from 'lucide-react'
import { ifadeDogrula } from '@/lib/rapor/ifade'
import { BICIMLER, veriSetiParametreleri } from '@/lib/rapor/sablon-dogrula'
import type { AltToplamFn, Bicim, GrupTanim, HesaplananAlan, Kolon, KosulluBicim, SablonIcerik, SablonParametre, VeriSetiTanim } from '@/lib/rapor/tipler'
import { GeriRozet } from '../../../_components/rozet-link'

const NAVY = '#1B4F72'

interface Props {
  veriSetleri: { id: string; ad: string }[]
  kategoriler?: string[]
  mevcut?: { id: string; kod: string; ad: string; aciklama: string; veriSetiId: string; durum: 'TASLAK' | 'YAYINDA' | 'ARSIV'; surum: number; izinAnahtari: string; icerik: SablonIcerik }
}

interface VeriSetiAlan { ad: string; yol: string; veriTipi: string }

const ALT_TOPLAMLAR: { v: AltToplamFn; e: string }[] = [
  { v: 'yok', e: 'Yok' }, { v: 'topla', e: 'Toplam' }, { v: 'ortalama', e: 'Ortalama' }, { v: 'say', e: 'Sayı' },
  { v: 'enbuyuk', e: 'En büyük' }, { v: 'enkucuk', e: 'En küçük' }, { v: 'orani', e: 'Oran (pay/payda)' },
]
const TIP_BICIM: Record<string, Bicim | undefined> = { sayi: '#.##0', tarih: 'gg.aa.yyyy' }

const hataSinifi = (d: ReturnType<typeof ifadeDogrula> | null) => !d ? '' : !d.gecerli ? 'text-red-700' : d.hata ? 'text-amber-700' : 'text-green-700'

// ── Sürükle-bırak yardımcıları (desen: akademi AdminPackageCoursesPicker — dnd-kit core/sortable/utilities) ──
// Kaynaklar: sol panel alanları (id "alan:<ad>"). Hedefler: "drop:kolonlar", "drop:gruplar".
// Sıralama: kolon satırları "kolon:<alan>", grup satırları "grup:<index>".

type SurukleVeri = { tip: 'alan'; alan: string } | { tip: 'kolon'; alan: string } | { tip: 'grup'; index: number }

/** Sol panel alan satırı — hem tıklanır hem sürüklenir (PointerSensor distance:6 ile tıklama bozulmaz). */
function SurukleAlan({ alan, children, className }: { alan: string; children: React.ReactNode; className?: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `alan:${alan}`, data: { tip: 'alan', alan } satisfies SurukleVeri })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={`touch-manipulation ${isDragging ? 'opacity-40' : ''} ${className ?? ''}`}>
      {children}
    </div>
  )
}

/** Bırakma alanı: geçerli → mavi çerçeve, geçersiz → kırmızı. */
function BirakmaAlani({ id, gecerlilik, children, className }: { id: string; gecerlilik: (alan: string) => string | null; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver, active } = useDroppable({ id })
  const veri = active?.data.current as SurukleVeri | undefined
  const uzerinde = isOver && veri?.tip === 'alan'
  const hata = uzerinde && veri?.tip === 'alan' ? gecerlilik(veri.alan) : null
  return (
    <div ref={setNodeRef} data-birak={id} className={`rounded-md transition-shadow ${uzerinde ? (hata ? 'ring-2 ring-red-500 bg-red-50/40' : 'ring-2 ring-[#1B4F72] bg-blue-50/40') : ''} ${className ?? ''}`}>
      {children}
      {uzerinde && <div className={`px-2 pb-1 text-[11px] ${hata ? 'text-red-700' : 'text-[#1B4F72]'}`}>{hata ?? 'Bırakın'}</div>}
    </div>
  )
}

/** Sıralanabilir satır sarmalayıcı — tutamaç (GripVertical) ile sürüklenir. */
function SiralanabilirSatir({ id, veri, className, children, onClick }: { id: string; veri: SurukleVeri; className?: string; children: (tutamac: React.ReactNode) => React.ReactNode; onClick?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, data: veri })
  const tutamac = (
    <button type="button" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-manipulation px-0.5" title="Sürükleyerek sırala" onClick={(e) => e.stopPropagation()}>
      <GripVertical className="h-4 w-4" />
    </button>
  )
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }} className={className} onClick={onClick}>
      {children(tutamac)}
    </div>
  )
}

/** İfade kutusu + altında canlı doğrulama (ifadeDogrula). */
function IfadeKutusu({ deger, onChange, alanlar, placeholder, rows = 2 }: { deger: string; onChange: (v: string) => void; alanlar: string[]; placeholder?: string; rows?: number }) {
  const d = deger.trim() ? ifadeDogrula(deger, alanlar) : null
  return (
    <div className="space-y-1">
      <textarea className="w-full rounded-md border border-input bg-background px-2 py-1.5 font-mono text-xs" rows={rows} value={deger} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {d && <div className={`text-[11px] ${hataSinifi(d)}`}>{!d.gecerli ? d.hata : d.hata ?? `Geçerli · alanlar: ${d.kullanilanAlanlar.join(', ') || '—'}`}</div>}
    </div>
  )
}

export default function SablonTasarimClient({ veriSetleri, kategoriler = [], mevcut }: Props) {
  const router = useRouter()
  const ic = mevcut?.icerik

  // Üst
  const [kod, setKod] = useState(mevcut?.kod ?? '')
  const [ad, setAd] = useState(mevcut?.ad ?? '')
  const [aciklama, setAciklama] = useState(mevcut?.aciklama ?? '')
  const [veriSetiId, setVeriSetiId] = useState(mevcut?.veriSetiId ?? '')
  const [durum, setDurum] = useState<'TASLAK' | 'YAYINDA'>(mevcut?.durum === 'YAYINDA' ? 'YAYINDA' : 'TASLAK')
  const [altBaslik, setAltBaslik] = useState(ic?.altBaslik ?? '')
  const [kategori, setKategori] = useState(ic?.kategori ?? '')
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [kayitHata, setKayitHata] = useState<string | null>(null)
  const [kayitHatalari, setKayitHatalari] = useState<string[]>([])
  const [kayitMesaj, setKayitMesaj] = useState<string | null>(null)

  // İçerik
  const [parametreler, setParametreler] = useState<SablonParametre[]>(ic?.parametreler ?? [])
  const [hesaplananlar, setHesaplananlar] = useState<HesaplananAlan[]>(ic?.hesaplananAlanlar ?? [])
  const [gruplar, setGruplar] = useState<GrupTanim[]>(ic?.gruplar ?? [])
  const [kolonlar, setKolonlar] = useState<Kolon[]>(ic?.kolonlar ?? [])
  const [genelToplam, setGenelToplam] = useState(ic?.genelToplam ?? true)
  const [sayfaAltiSol, setSayfaAltiSol] = useState(ic?.sayfaAlti?.sol ?? '')
  const [sayfaAltiSag, setSayfaAltiSag] = useState(ic?.sayfaAlti?.sag ?? '')
  const [seciliKolon, setSeciliKolon] = useState<number | null>(null)
  const [sagSekme, setSagSekme] = useState<'kolon' | 'onizleme'>('kolon')

  // Veri seti alanları
  const [vsAlanlar, setVsAlanlar] = useState<VeriSetiAlan[]>([])
  const [vsTanim, setVsTanim] = useState<VeriSetiTanim | null>(null)
  const [vsHata, setVsHata] = useState<string | null>(null)

  // Önizleme
  const [onizParam, setOnizParam] = useState<Record<string, string>>({})
  const [onizHtml, setOnizHtml] = useState<string | null>(null)
  const [onizBilgi, setOnizBilgi] = useState<string | null>(null)
  const [onizHata, setOnizHata] = useState<string | null>(null)
  const [onizleniyor, setOnizleniyor] = useState(false)
  const [onizBuyuk, setOnizBuyuk] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!veriSetiId) { setVsAlanlar([]); setVsTanim(null); return }
    fetch(`/api/raporlar/veri-setleri/${veriSetiId}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`); setVsAlanlar(d.alanlar ?? []); setVsTanim(d.veriSeti?.tanim ?? null); setVsHata(null) })
      .catch((e: Error) => { setVsHata(e.message); setVsAlanlar([]); setVsTanim(null) })
  }, [veriSetiId])

  const vsAlanAdlari = useMemo(() => vsAlanlar.map((a) => a.ad), [vsAlanlar])
  /** İfadelerde geçerli alanlar: veri seti + hesaplananlar. */
  const tumAlanlar = useMemo(() => [...vsAlanAdlari, ...hesaplananlar.map((h) => h.ad).filter(Boolean)], [vsAlanAdlari, hesaplananlar])
  const alanTipi = (alan: string) => vsAlanlar.find((a) => a.ad === alan)?.veriTipi ?? (hesaplananlar.some((h) => h.ad === alan) ? 'hesaplanan' : '?')
  const onerilenParametreler = useMemo(() => veriSetiParametreleri(vsTanim).filter((p) => !parametreler.some((x) => x.ad === p)), [vsTanim, parametreler])

  const icerik = useMemo<SablonIcerik>(() => ({
    baslik: ad.trim() || 'Rapor',
    altBaslik: altBaslik.trim() || undefined,
    kategori: kategori.trim() || undefined,
    parametreler,
    hesaplananAlanlar: hesaplananlar,
    gruplar,
    kolonlar,
    genelToplam,
    sayfaAlti: sayfaAltiSol || sayfaAltiSag ? { sol: sayfaAltiSol || undefined, sag: sayfaAltiSag || undefined } : undefined,
  }), [ad, altBaslik, kategori, parametreler, hesaplananlar, gruplar, kolonlar, genelToplam, sayfaAltiSol, sayfaAltiSag])

  // ── Kolon işlemleri ───────────────────────────────────────────────────
  function kolonEkle(alan: string) {
    if (kolonlar.some((k) => k.alan === alan)) { setSeciliKolon(kolonlar.findIndex((k) => k.alan === alan)); setSagSekme('kolon'); return }
    const tip = alanTipi(alan)
    const hb = hesaplananlar.find((h) => h.ad === alan)?.bicim
    setKolonlar((l) => [...l, { alan, baslik: alan, bicim: hb ?? TIP_BICIM[tip] }])
    setSeciliKolon(kolonlar.length)
    setSagSekme('kolon')
  }
  const kolonGuncelle = (i: number, d: Partial<Kolon>) => setKolonlar((l) => l.map((k, j) => (j === i ? { ...k, ...d } : k)))
  function kolonTasi(i: number, yon: -1 | 1) {
    const j = i + yon
    if (j < 0 || j >= kolonlar.length) return
    setKolonlar((l) => { const c = [...l]; [c[i], c[j]] = [c[j], c[i]]; return c })
    if (seciliKolon === i) setSeciliKolon(j)
  }
  function kolonSil(i: number) {
    setKolonlar((l) => l.filter((_, j) => j !== i))
    setSeciliKolon((s) => (s === null ? null : s === i ? null : s > i ? s - 1 : s))
  }

  // ── Kaydet / önizle ───────────────────────────────────────────────────
  async function kaydet() {
    setKaydediliyor(true); setKayitHata(null); setKayitHatalari([]); setKayitMesaj(null)
    try {
      const r = await fetch(mevcut ? `/api/raporlar/sablonlar/${mevcut.id}` : '/api/raporlar/sablonlar', {
        method: mevcut ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kod, ad, aciklama, veriSetiId, icerik, durum, izinAnahtari: mevcut?.izinAnahtari || null }),
      })
      const d = await r.json()
      if (!r.ok) { setKayitHata(d.error ?? `HTTP ${r.status}`); setKayitHatalari(d.hatalar ?? []); return }
      setKayitMesaj(mevcut ? `Kaydedildi (sürüm ${d.sablon.surum})` : 'Oluşturuldu')
      if (!mevcut) router.replace(`/raporlar/tasarim/${d.sablon.id}`)
    } catch (e) { setKayitHata(e instanceof Error ? e.message : String(e)) }
    finally { setKaydediliyor(false) }
  }

  async function onizle() {
    setOnizleniyor(true); setOnizHata(null)
    try {
      const r = await fetch(`/api/raporlar/sablonlar/${mevcut?.id ?? 'yeni'}/onizle`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parametreler: onizParam, icerik, veriSetiId }),
      })
      const d = await r.json()
      if (!r.ok) { setOnizHtml(null); setOnizHata([d.error, ...(d.hatalar ?? [])].filter(Boolean).join(' · ')); return }
      setOnizHtml(d.html)
      setOnizBilgi(`${d.satirSayisi}/${d.toplamSatir} satır · ${d.sureMs} ms`)
    } catch (e) { setOnizHtml(null); setOnizHata(e instanceof Error ? e.message : String(e)) }
    finally { setOnizleniyor(false) }
  }

  const sk = seciliKolon !== null ? kolonlar[seciliKolon] : null

  // ── Sürükle-bırak ─────────────────────────────────────────────────────
  const [surukleAktif, setSurukleAktif] = useState<SurukleVeri | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), // tıklama korunur
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }), // tablet: basılı tut
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  /** Alan sürüklenirken bırakma alanlarına, sıralama sürüklenirken satırlara göre çarpışma. */
  const carpisma: CollisionDetection = (args) => {
    const veri = args.active.data.current as SurukleVeri | undefined
    if (veri?.tip === 'alan') return pointerWithin({ ...args, droppableContainers: args.droppableContainers.filter((c) => String(c.id).startsWith('drop:')) })
    const onek = veri?.tip === 'kolon' ? 'kolon:' : 'grup:'
    return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => String(c.id).startsWith(onek)) })
  }
  const kolonGecerlilik = (alan: string) => (kolonlar.some((k) => k.alan === alan) ? `'${alan}' zaten kolon` : null)
  const grupGecerlilik = (alan: string) => (gruplar.length >= 3 ? 'En fazla 3 grup seviyesi' : gruplar.some((g) => g.alan === alan) ? `'${alan}' zaten grup` : null)
  function grupEkle(alan: string) { setGruplar((l) => [...l, { alan }]) }
  const onDragStart = (e: DragStartEvent) => setSurukleAktif((e.active.data.current as SurukleVeri) ?? null)
  const onDragEnd = (e: DragEndEvent) => {
    setSurukleAktif(null)
    const { active, over } = e
    if (!over) return
    const veri = active.data.current as SurukleVeri | undefined
    if (!veri) return
    if (veri.tip === 'alan') {
      if (over.id === 'drop:kolonlar') { const h = kolonGecerlilik(veri.alan); if (h) toast.warning(h); else kolonEkle(veri.alan) }
      else if (over.id === 'drop:gruplar') { const h = grupGecerlilik(veri.alan); if (h) toast.warning(h); else grupEkle(veri.alan) }
      return
    }
    if (active.id === over.id) return
    if (veri.tip === 'kolon') {
      const eski = kolonlar.findIndex((k) => `kolon:${k.alan}` === active.id), yeni = kolonlar.findIndex((k) => `kolon:${k.alan}` === over.id)
      if (eski < 0 || yeni < 0) return
      setKolonlar((l) => arrayMove(l, eski, yeni))
      setSeciliKolon((sc) => (sc === null ? null : sc === eski ? yeni : sc > eski && sc <= yeni ? sc - 1 : sc < eski && sc >= yeni ? sc + 1 : sc))
    } else if (veri.tip === 'grup') {
      const eski = Number(String(active.id).slice(5)), yeni = Number(String(over.id).slice(5))
      if (Number.isNaN(eski) || Number.isNaN(yeni)) return
      setGruplar((l) => arrayMove(l, eski, yeni))
    }
  }

  return (
    <div className="space-y-4">
      {/* ÜST */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <GeriRozet href="/raporlar">Raporlar</GeriRozet>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight flex items-center gap-3">
            <FileBarChart2 className="h-6 w-6" style={{ color: NAVY }} />
            {mevcut ? 'Şablon Düzenle' : 'Yeni Rapor Şablonu'}
            {mevcut && <Badge variant="outline">sürüm {mevcut.surum}</Badge>}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {kayitMesaj && <span className="text-sm text-green-700">{kayitMesaj}</span>}
          <Button onClick={kaydet} disabled={kaydediliyor || !kod.trim() || !ad.trim() || !veriSetiId || kolonlar.length === 0} style={{ backgroundColor: NAVY }}>
            {kaydediliyor ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Kaydet
          </Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
          <div className="space-y-1.5"><Label htmlFor="s-kod">Kod <span className="text-red-600">*</span></Label><Input id="s-kod" className="font-mono" value={kod} onChange={(e) => setKod(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))} placeholder="URT-002" /></div>
          <div className="space-y-1.5 xl:col-span-2"><Label htmlFor="s-ad">Ad (rapor başlığı) <span className="text-red-600">*</span></Label><Input id="s-ad" value={ad} onChange={(e) => setAd(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="s-vs">Veri seti <span className="text-red-600">*</span></Label>
            <NativeSelect id="s-vs" value={veriSetiId} onChange={(e) => setVeriSetiId(e.target.value)}>
              <option value="">Seçin…</option>{veriSetleri.map((v) => <option key={v.id} value={v.id}>{v.ad}</option>)}
            </NativeSelect>
          </div>
          <div className="space-y-1.5"><Label htmlFor="s-durum">Durum</Label>
            <NativeSelect id="s-durum" value={durum} onChange={(e) => setDurum(e.target.value as 'TASLAK' | 'YAYINDA')}><option value="TASLAK">Taslak</option><option value="YAYINDA">Yayında</option></NativeSelect>
          </div>
          <div className="space-y-1.5"><Label htmlFor="s-alt">Alt başlık</Label><Input id="s-alt" value={altBaslik} onChange={(e) => setAltBaslik(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="s-kat">Kategori</Label><Input id="s-kat" list="kategori-onerileri" value={kategori} onChange={(e) => setKategori(e.target.value)} placeholder="Üretim" /><datalist id="kategori-onerileri">{kategoriler.map((k) => <option key={k} value={k} />)}</datalist></div>
          <div className="space-y-1.5 sm:col-span-2 xl:col-span-7"><Label htmlFor="s-aciklama">Açıklama (listede görünür)</Label><Input id="s-aciklama" value={aciklama} onChange={(e) => setAciklama(e.target.value)} /></div>
        </CardContent>
      </Card>
      {(kayitHata || kayitHatalari.length > 0) && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="font-medium">{kayitHata}</div>
          {kayitHatalari.length > 0 && <ul className="list-disc ml-5 mt-1">{kayitHatalari.map((h, i) => <li key={i}>{h}</li>)}</ul>}
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={carpisma} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setSurukleAktif(null)}>
      <div className="grid gap-4 xl:grid-cols-[280px_1fr_400px]">
        {/* SOL — Kullanılabilir alanlar */}
        <Card className="xl:sticky xl:top-4 self-start max-h-[calc(100vh-6rem)] flex flex-col">
          <CardHeader className="pb-2"><CardTitle className="text-base">Kullanılabilir alanlar</CardTitle></CardHeader>
          <CardContent className="space-y-3 overflow-y-auto text-sm">
            {!veriSetiId ? <p className="text-xs text-muted-foreground">Önce veri seti seçin.</p> : vsHata ? <p className="text-xs text-red-700">{vsHata}</p> : (
              <div className="border rounded">
                {vsAlanlar.map((a) => (
                  <SurukleAlan key={a.ad} alan={a.ad} className="border-b last:border-b-0">
                    <button className="w-full text-left px-2 py-1 flex items-center gap-2 hover:bg-muted cursor-grab active:cursor-grabbing" onClick={() => kolonEkle(a.ad)} title={`${a.yol} — tıkla: kolon ekle · sürükle: Kolonlar/Gruplar`}>
                      <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                      <span className="flex-1 font-mono text-xs truncate">{a.ad}</span>
                      <span className="text-[10px] text-muted-foreground">{a.veriTipi}</span>
                      {kolonlar.some((k) => k.alan === a.ad) && <Columns3 className="h-3 w-3 text-muted-foreground" />}
                    </button>
                  </SurukleAlan>
                ))}
                {vsAlanlar.length === 0 && <div className="p-2 text-xs text-muted-foreground">Veri setinde çıktı alanı yok.</div>}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="font-medium text-sm flex items-center gap-1"><Sigma className="h-3.5 w-3.5" />Hesaplanan alanlar</span>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setHesaplananlar((l) => [...l, { ad: `hesap${l.length + 1}`, ifade: '' }])}><Plus className="h-3 w-3 mr-1" />Ekle</Button>
            </div>
            {hesaplananlar.map((h, i) => (
              <div key={i} className="border rounded p-2 space-y-1.5">
                <div className="flex items-center gap-1">
                  {h.ad && <SurukleAlan alan={h.ad} className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-foreground" ><span title="Sürükle: Kolonlar/Gruplar"><GripVertical className="h-4 w-4" /></span></SurukleAlan>}
                  <Input className="h-7 font-mono text-xs" value={h.ad} onChange={(e) => setHesaplananlar((l) => l.map((x, j) => (j === i ? { ...x, ad: e.target.value.replace(/[^A-Za-z0-9_]/g, '') } : x)))} placeholder="ad" />
                  <NativeSelect className="h-7 w-28 text-xs" value={h.bicim ?? ''} onChange={(e) => setHesaplananlar((l) => l.map((x, j) => (j === i ? { ...x, bicim: (e.target.value || undefined) as Bicim | undefined } : x)))}>
                    <option value="">biçim</option>{BICIMLER.map((b) => <option key={b} value={b}>{b}</option>)}
                  </NativeSelect>
                  <Button variant="ghost" size="sm" className="h-7 px-1.5 text-red-600" onClick={() => setHesaplananlar((l) => l.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
                <IfadeKutusu deger={h.ifade} onChange={(v) => setHesaplananlar((l) => l.map((x, j) => (j === i ? { ...x, ifade: v } : x)))} alanlar={[...vsAlanAdlari, ...hesaplananlar.slice(0, i).map((x) => x.ad)]} placeholder="{ifsTamam} / {planlanan} * 100" />
                <Button size="sm" variant="outline" className="h-6 text-[11px] w-full" disabled={!h.ad} onClick={() => kolonEkle(h.ad)}><Plus className="h-3 w-3 mr-1" />Kolon olarak ekle</Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ORTA — Rapor yapısı */}
        <div className="space-y-4 min-w-0">
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Parametreler <span className="text-muted-foreground font-normal text-sm">({parametreler.length})</span></CardTitle>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setParametreler((l) => [...l, { ad: '', tip: 'metin', etiket: '', zorunlu: false }])}><Plus className="h-3 w-3 mr-1" />Ekle</Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {onerilenParametreler.length > 0 && (
                <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-1">
                  Veri setinde geçiyor:
                  {onerilenParametreler.map((p) => (
                    <button key={p} className="rounded border px-1.5 py-0.5 font-mono hover:bg-muted" onClick={() => setParametreler((l) => [...l, { ad: p, tip: /tarih|baslangic|bitis|date/i.test(p) ? 'tarih' : 'metin', etiket: p, zorunlu: true }])}>+ {p}</button>
                  ))}
                </div>
              )}
              {parametreler.map((p, i) => (
                <div key={i} className="grid grid-cols-[1fr_100px_1fr_auto_auto] gap-2 items-center">
                  <Input className="h-8 font-mono text-xs" value={p.ad} placeholder="ad" onChange={(e) => setParametreler((l) => l.map((x, j) => (j === i ? { ...x, ad: e.target.value.replace(/[^A-Za-z0-9_]/g, '') } : x)))} />
                  <NativeSelect className="h-8 text-xs" value={p.tip} onChange={(e) => setParametreler((l) => l.map((x, j) => (j === i ? { ...x, tip: e.target.value as SablonParametre['tip'] } : x)))}>
                    <option value="metin">metin</option><option value="sayi">sayı</option><option value="tarih">tarih</option><option value="liste">liste</option>
                  </NativeSelect>
                  <Input className="h-8 text-xs" value={p.etiket} placeholder="Etiket" onChange={(e) => setParametreler((l) => l.map((x, j) => (j === i ? { ...x, etiket: e.target.value } : x)))} />
                  <label className="flex items-center gap-1 text-xs"><Checkbox checked={!!p.zorunlu} onCheckedChange={(v) => setParametreler((l) => l.map((x, j) => (j === i ? { ...x, zorunlu: v === true } : x)))} />zorunlu</label>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-red-600" onClick={() => setParametreler((l) => l.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
              {parametreler.length === 0 && onerilenParametreler.length === 0 && <p className="text-sm text-muted-foreground">Parametre yok.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Gruplar <span className="text-muted-foreground font-normal text-sm">({gruplar.length}/3)</span></CardTitle>
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={gruplar.length >= 3} onClick={() => setGruplar((l) => [...l, { alan: '' }])}><Plus className="h-3 w-3 mr-1" />Seviye</Button>
            </CardHeader>
            <BirakmaAlani id="drop:gruplar" gecerlilik={grupGecerlilik}>
            <CardContent className="space-y-2 min-h-[3.5rem]">
              {gruplar.length === 0 && <p className="text-sm text-muted-foreground">Gruplama yok — satırlar düz listelenir. Sol panelden alan sürükleyip bırakabilirsiniz.</p>}
              <SortableContext items={gruplar.map((_, i) => `grup:${i}`)} strategy={verticalListSortingStrategy}>
              {gruplar.map((g, i) => (
                <SiralanabilirSatir key={i} id={`grup:${i}`} veri={{ tip: 'grup', index: i }} className="border rounded p-2 space-y-1.5 bg-background">
                  {(tutamac) => (<>
                  <div className="grid grid-cols-[auto_auto_1fr_auto_auto] gap-2 items-center">
                    {tutamac}
                    <span className="text-xs text-muted-foreground">Seviye {i + 1}</span>
                    <NativeSelect className="h-8 text-xs font-mono" value={g.alan} onChange={(e) => setGruplar((l) => l.map((x, j) => (j === i ? { ...x, alan: e.target.value } : x)))}>
                      <option value="">alan…</option>{tumAlanlar.map((a) => <option key={a} value={a}>{a}</option>)}
                    </NativeSelect>
                    <label className="flex items-center gap-1 text-xs whitespace-nowrap"><Checkbox checked={!!g.yeniSayfa} onCheckedChange={(v) => setGruplar((l) => l.map((x, j) => (j === i ? { ...x, yeniSayfa: v === true } : x)))} />yeni sayfa</label>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-red-600" onClick={() => setGruplar((l) => l.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                  <Label className="text-[11px]">Başlık ifadesi (opsiyonel; boşsa alanın değeri)</Label>
                  <IfadeKutusu deger={g.baslik ?? ''} onChange={(v) => setGruplar((l) => l.map((x, j) => (j === i ? { ...x, baslik: v || undefined } : x)))} alanlar={tumAlanlar} rows={1} placeholder={`birlestir('Tezgah ', {${g.alan || 'alan'}})`} />
                  </>)}
                </SiralanabilirSatir>
              ))}
              </SortableContext>
            </CardContent>
            </BirakmaAlani>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Kolonlar <span className="text-muted-foreground font-normal text-sm">({kolonlar.length})</span></CardTitle></CardHeader>
            <BirakmaAlani id="drop:kolonlar" gecerlilik={kolonGecerlilik}>
            <CardContent className="space-y-1 min-h-[3.5rem]">
              {kolonlar.length === 0 && <p className="text-sm text-muted-foreground">Sol panelden alana tıklayın ya da buraya sürükleyip bırakın.</p>}
              <SortableContext items={kolonlar.map((k) => `kolon:${k.alan}`)} strategy={verticalListSortingStrategy}>
              {kolonlar.map((k, i) => (
                <SiralanabilirSatir key={k.alan} id={`kolon:${k.alan}`} veri={{ tip: 'kolon', alan: k.alan }} className={`rounded px-2 py-1.5 border cursor-pointer space-y-1 bg-background ${seciliKolon === i ? 'border-[#1B4F72] bg-blue-50/50' : 'border-transparent hover:bg-muted'}`} onClick={() => { setSeciliKolon(i); setSagSekme('kolon') }}>
                  {(tutamac) => (<>
                  <div className="grid grid-cols-[auto_130px_1fr_auto] gap-2 items-center">
                    {tutamac}
                    <span className="font-mono text-xs truncate" title={k.alan}>{i + 1}. {k.alan}</span>
                    <Input className="h-7 text-xs" value={k.baslik} onClick={(e) => e.stopPropagation()} onChange={(e) => kolonGuncelle(i, { baslik: e.target.value })} placeholder="Başlık" />
                    <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-7 px-1" disabled={i === 0} onClick={() => kolonTasi(i, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-7 px-1" disabled={i === kolonlar.length - 1} onClick={() => kolonTasi(i, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-7 px-1 text-red-600" onClick={() => kolonSil(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-[80px_90px_1fr_1fr] gap-2 items-center" onClick={(e) => e.stopPropagation()}>
                    <Input className="h-7 text-xs" type="number" value={k.genislik ?? ''} onChange={(e) => kolonGuncelle(i, { genislik: e.target.value ? Number(e.target.value) : undefined })} placeholder="gen. %" title="Genişlik %" />
                    <NativeSelect className="h-7 text-xs" value={k.hiza ?? ''} onChange={(e) => kolonGuncelle(i, { hiza: (e.target.value || undefined) as Kolon['hiza'] })} title="Hizalama"><option value="">hiza: oto</option><option value="sol">sol</option><option value="sag">sağ</option><option value="orta">orta</option></NativeSelect>
                    <NativeSelect className="h-7 text-xs" value={k.bicim ?? ''} onChange={(e) => kolonGuncelle(i, { bicim: (e.target.value || undefined) as Bicim | undefined })} title="Biçim"><option value="">biçim: oto</option>{BICIMLER.map((b) => <option key={b} value={b}>{b}</option>)}</NativeSelect>
                    <NativeSelect className="h-7 text-xs" value={k.altToplam ?? 'yok'} onChange={(e) => kolonGuncelle(i, { altToplam: e.target.value as AltToplamFn })} title="Alt toplam">{ALT_TOPLAMLAR.map((a) => <option key={a.v} value={a.v}>{a.v === 'yok' ? 'alt toplam: yok' : a.e}</option>)}</NativeSelect>
                  </div>
                  </>)}
                </SiralanabilirSatir>
              ))}
              </SortableContext>
            </CardContent>
            </BirakmaAlani>
          </Card>

          <Card>
            <CardContent className="p-4 grid gap-3 sm:grid-cols-[auto_1fr_1fr] items-end">
              <label className="flex items-center gap-2 text-sm pb-2"><Checkbox checked={genelToplam} onCheckedChange={(v) => setGenelToplam(v === true)} />Genel toplam satırı</label>
              <div className="space-y-1"><Label className="text-xs">Sayfa altı — sol</Label><Input className="h-8" value={sayfaAltiSol} onChange={(e) => setSayfaAltiSol(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Sayfa altı — sağ</Label><Input className="h-8" value={sayfaAltiSag} onChange={(e) => setSayfaAltiSag(e.target.value)} /></div>
            </CardContent>
          </Card>
        </div>

        {/* SAĞ — Kolon ayarları / Önizleme */}
        <Card className="xl:sticky xl:top-4 self-start max-h-[calc(100vh-6rem)] flex flex-col min-w-0">
          <Tabs value={sagSekme} onValueChange={(v) => setSagSekme(v as 'kolon' | 'onizleme')} className="flex flex-col min-h-0">
            <CardHeader className="pb-2"><TabsList className="w-full"><TabsTrigger value="kolon" className="flex-1">Kolon ayarları</TabsTrigger><TabsTrigger value="onizleme" className="flex-1">Önizleme</TabsTrigger></TabsList></CardHeader>
            <CardContent className="overflow-y-auto text-sm">
              <TabsContent value="kolon" className="space-y-3 mt-0">
                {!sk || seciliKolon === null ? <p className="text-xs text-muted-foreground">Ortadan bir kolon seçin.</p> : (
                  <>
                    <div className="font-mono text-xs text-muted-foreground">{sk.alan} · {alanTipi(sk.alan)}</div>
                    <div className="space-y-1"><Label className="text-xs">Başlık</Label><Input className="h-8" value={sk.baslik} onChange={(e) => kolonGuncelle(seciliKolon, { baslik: e.target.value })} /></div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1"><Label className="text-xs">Biçim</Label><NativeSelect className="h-8 text-xs" value={sk.bicim ?? ''} onChange={(e) => kolonGuncelle(seciliKolon, { bicim: (e.target.value || undefined) as Bicim | undefined })}><option value="">oto</option>{BICIMLER.map((b) => <option key={b} value={b}>{b}</option>)}</NativeSelect></div>
                      <div className="space-y-1"><Label className="text-xs">Hizalama</Label><NativeSelect className="h-8 text-xs" value={sk.hiza ?? ''} onChange={(e) => kolonGuncelle(seciliKolon, { hiza: (e.target.value || undefined) as Kolon['hiza'] })}><option value="">oto</option><option value="sol">sol</option><option value="sag">sağ</option><option value="orta">orta</option></NativeSelect></div>
                      <div className="space-y-1"><Label className="text-xs">Genişlik %</Label><Input className="h-8" type="number" value={sk.genislik ?? ''} onChange={(e) => kolonGuncelle(seciliKolon, { genislik: e.target.value ? Number(e.target.value) : undefined })} /></div>
                    </div>
                    <div className="space-y-1"><Label className="text-xs">Alt toplam</Label>
                      <NativeSelect className="h-8 text-xs" value={sk.altToplam ?? 'yok'} onChange={(e) => kolonGuncelle(seciliKolon, { altToplam: e.target.value as AltToplamFn })}>{ALT_TOPLAMLAR.map((a) => <option key={a.v} value={a.v}>{a.e}</option>)}</NativeSelect>
                    </div>
                    {sk.altToplam === 'orani' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1"><Label className="text-xs">Pay</Label><NativeSelect className="h-8 text-xs font-mono" value={sk.oraniPay ?? ''} onChange={(e) => kolonGuncelle(seciliKolon, { oraniPay: e.target.value || undefined })}><option value="">alan…</option>{tumAlanlar.map((a) => <option key={a} value={a}>{a}</option>)}</NativeSelect></div>
                        <div className="space-y-1"><Label className="text-xs">Payda</Label><NativeSelect className="h-8 text-xs font-mono" value={sk.oraniPayda ?? ''} onChange={(e) => kolonGuncelle(seciliKolon, { oraniPayda: e.target.value || undefined })}><option value="">alan…</option>{tumAlanlar.map((a) => <option key={a} value={a}>{a}</option>)}</NativeSelect></div>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <Label className="text-xs">Koşullu biçim</Label>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => kolonGuncelle(seciliKolon, { kosulluBicim: [...(sk.kosulluBicim ?? []), { kosul: '', renk: 'kritik' }] })}><Plus className="h-3 w-3 mr-1" />Kural</Button>
                    </div>
                    {(sk.kosulluBicim ?? []).map((kb, i) => {
                      const guncelle = (d: Partial<KosulluBicim>) => kolonGuncelle(seciliKolon, { kosulluBicim: (sk.kosulluBicim ?? []).map((x, j) => (j === i ? { ...x, ...d } : x)) })
                      return (
                        <div key={i} className="border rounded p-2 space-y-1.5">
                          <IfadeKutusu deger={kb.kosul} onChange={(v) => guncelle({ kosul: v })} alanlar={tumAlanlar} rows={1} placeholder={`{${sk.alan}} < 90`} />
                          <div className="flex items-center gap-2">
                            <NativeSelect className="h-7 text-xs w-28" value={kb.renk ?? ''} onChange={(e) => guncelle({ renk: (e.target.value || undefined) as KosulluBicim['renk'] })}><option value="">renk yok</option><option value="kritik">kritik (kırmızı)</option><option value="uyari">uyarı (sarı)</option><option value="iyi">iyi (yeşil)</option></NativeSelect>
                            <label className="flex items-center gap-1 text-xs"><Checkbox checked={!!kb.kalin} onCheckedChange={(v) => guncelle({ kalin: v === true })} />kalın</label>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-red-600 ml-auto" onClick={() => kolonGuncelle(seciliKolon, { kosulluBicim: (sk.kosulluBicim ?? []).filter((_, j) => j !== i) })}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}
              </TabsContent>
              <TabsContent value="onizleme" className="space-y-3 mt-0">
                {parametreler.length > 0 ? parametreler.map((p) => (
                  <div key={p.ad} className="space-y-1">
                    <Label className="text-xs">{p.etiket || p.ad}{p.zorunlu && <span className="text-red-600"> *</span>}</Label>
                    {p.tip === 'tarih'
                      ? <DateField id={`oz-${p.ad}`} value={onizParam[p.ad] ?? ''} onChange={(v) => setOnizParam((m) => ({ ...m, [p.ad]: v }))} takvim />
                      : <Input className="h-8" type={p.tip === 'sayi' ? 'number' : 'text'} value={onizParam[p.ad] ?? ''} onChange={(e) => setOnizParam((m) => ({ ...m, [p.ad]: e.target.value }))} />}
                  </div>
                )) : <p className="text-xs text-muted-foreground">Parametre yok.</p>}
                <Button onClick={onizle} disabled={onizleniyor || !veriSetiId || kolonlar.length === 0} className="w-full" style={{ backgroundColor: NAVY }}>
                  {onizleniyor ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}Önizle (ilk 50 satır)
                </Button>
                {onizHata && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 break-words">{onizHata}</div>}
                {onizHtml && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{onizBilgi}</span>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setOnizBuyuk(true)}><Maximize2 className="h-3.5 w-3.5 mr-1" />Büyüt</Button>
                    </div>
                    <iframe ref={iframeRef} title="Önizleme" srcDoc={onizHtml} sandbox="allow-same-origin allow-modals" className="w-full bg-white border rounded" style={{ height: '60vh' }} />
                    <Dialog open={onizBuyuk} onOpenChange={setOnizBuyuk}>
                      <DialogContent className="max-w-[96vw] w-[96vw] h-[92vh] flex flex-col p-4 gap-3">
                        <DialogHeader className="shrink-0"><DialogTitle className="text-base">Rapor önizlemesi — {onizBilgi}</DialogTitle></DialogHeader>
                        <iframe title="Önizleme (büyük)" srcDoc={onizHtml} sandbox="allow-same-origin allow-modals" className="flex-1 min-h-0 w-full bg-white border rounded" />
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
      <DragOverlay dropAnimation={null}>
        {surukleAktif?.tip === 'alan' && (
          <div className="rounded border bg-white/90 px-2 py-1 font-mono text-xs shadow-lg opacity-80 flex items-center gap-1"><GripVertical className="h-3 w-3 text-muted-foreground" />{surukleAktif.alan}</div>
        )}
      </DragOverlay>
      </DndContext>
    </div>
  )
}
