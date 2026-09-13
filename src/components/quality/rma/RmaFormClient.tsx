'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, ArrowLeft, Save, ChevronDown, Copy, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { MusteriSecici, type MusteriOption } from './MusteriSecici'
import { RmaFotoPanel, type RmaFotoOzet } from './RmaFotoPanel'
import {
  RMA_TIP_OPTIONS, RMA_IADE_TURU_OPTIONS, RMA_KARAR_OPTIONS, RMA_KARAR_LABELS, RMA_DURUM_OPTIONS,
} from '@/lib/quality/rma-labels'
// TYPE-ONLY: rma-access sunucu tarafı (prisma) çeker; `import type` derlemede silinir.
import type { RmaMod } from '@/lib/quality/rma-access'

// ── Tipler ──
interface SatirState {
  key: string
  /** DB satır id'si — sorumlu kipinde PATCH hedefi. Yeni (kaydedilmemiş) satırda null. */
  id: string | null
  urunKodu: string
  lotNo: string
  iadeMiktari: string
  musteriIadeSebebi: string
  ilkIncelemeSonucu: string
  karar: string
  kararAciklama: string
  hurdaAdedi: string
  reworkAdedi: string
  musteriIadeAdedi: string
  kokNeden: string
  aksiyon: string
}

export interface RmaDetay {
  id: string
  no: number
  tip: string
  urunGelisTarihi: string | null
  irsaliyeTarihi: string | null
  irsaliyeNo: string | null
  musteri: { id: string; code: string; name: string } | null
  iadeTuru: string | null
  sorumluId: string | null
  sorumlu?: { adSoyad: string; sicilNo: string | null } | null
  termin: string | null
  kapanisTarihi: string | null
  durum: string
  maliyet: string | number | null
  satirlar: Array<{
    id: string
    siraNo: number; urunKodu: string; lotNo: string | null; iadeMiktari: number
    musteriIadeSebebi: string; ilkIncelemeSonucu: string | null; karar: string | null
    kararAciklama: string | null; hurdaAdedi: number | null; reworkAdedi: number | null; musteriIadeAdedi: number | null
    kokNeden: string | null; aksiyon: string | null
  }>
  fotolar: RmaFotoOzet[]
}

interface Props {
  initial: RmaDetay | null // null = yeni
  /**
   * Yazma kipi (sunucuda rmaMod ile hesaplanır — lib/quality/rma-access.ts):
   *   full    → tüm alanlar
   *   sorumlu → YALNIZ kök neden + aksiyon (kayda sorumlu atanmış kişi, kayıt AÇIK)
   *   ro      → salt okunur
   */
  mod: RmaMod
}

const isoToDateInput = (v: string | null): string => (v ? v.slice(0, 10) : '')
let keySeq = 0
const yeniSatir = (): SatirState => ({
  key: `s${keySeq++}`, id: null, urunKodu: '', lotNo: '', iadeMiktari: '', musteriIadeSebebi: '',
  ilkIncelemeSonucu: '', karar: '', kararAciklama: '', hurdaAdedi: '', reworkAdedi: '', musteriIadeAdedi: '', kokNeden: '', aksiyon: '',
})

// Karar rozeti tint'leri — portalın mevcut badge tint paleti (bkz. RmaListTable Açık/Kapalı).
const KARAR_BADGE: Record<string, string> = {
  HURDA: 'bg-red-100 text-red-800 border-red-200',
  TAMIR: 'bg-teal-100 text-teal-800 border-teal-200',
  REWORK: 'bg-amber-100 text-amber-800 border-amber-200',
  TEDARIKCIYE_IADE: 'bg-pink-100 text-pink-800 border-pink-200',
  MUSTERIYE_IADE: 'bg-pink-100 text-pink-800 border-pink-200',
  DEPOYA_KABUL: 'bg-blue-100 text-blue-800 border-blue-200',
  URUN_BIZE_AIT_DEGIL: 'bg-slate-100 text-slate-600 border-slate-200',
}
const KARAR_LABELS = RMA_KARAR_LABELS as Record<string, string>

export function RmaFormClient({ initial, mod }: Props) {
  const router = useRouter()
  const ro = mod === 'ro' // hiçbir alan yazılamaz
  // Başlık ve tüm satır alanları YALNIZ full kipinde açık; sorumlu kipinde
  // yalnız kök neden + aksiyon yazılabilir (disabled={ro} olan iki alan).
  const duzenlenebilir = mod === 'full'

  const [tip, setTip] = useState(initial?.tip ?? 'RMA')
  const [urunGelisTarihi, setUgt] = useState(isoToDateInput(initial?.urunGelisTarihi ?? null))
  const [irsaliyeTarihi, setIt] = useState(isoToDateInput(initial?.irsaliyeTarihi ?? null))
  const [irsaliyeNo, setIno] = useState(initial?.irsaliyeNo ?? '')
  const [musteri, setMusteri] = useState<MusteriOption | null>(initial?.musteri ?? null)
  // Yeni kayıt → varsayılan GIRIS_KALITE; mevcut kayıt → değeri (geçmiş boşsa '' = seçilmemiş, "—")
  const [iadeTuru, setIadeTuru] = useState(initial ? (initial.iadeTuru ?? '') : 'GIRIS_KALITE')
  const [sorumlu, setSorumlu] = useState<MusteriOption | null>(
    initial?.sorumluId && initial.sorumlu
      ? { id: initial.sorumluId, code: initial.sorumlu.sicilNo ?? '—', name: initial.sorumlu.adSoyad }
      : null,
  )
  const [termin, setTermin] = useState(isoToDateInput(initial?.termin ?? null))
  const [kapanisTarihi, setKt] = useState(isoToDateInput(initial?.kapanisTarihi ?? null))
  // Durum ELLE seçilir; kapanisTarihi'nden TÜRETİLMEZ (eski davranış kaldırıldı).
  const [durum, setDurum] = useState(initial?.durum ?? 'ACIK')
  const [maliyet, setMaliyet] = useState(initial?.maliyet != null ? String(initial.maliyet) : '')

  const [satirlar, setSatirlar] = useState<SatirState[]>(
    initial && initial.satirlar.length
      ? initial.satirlar.map((s) => ({
          key: `s${keySeq++}`, id: s.id, urunKodu: s.urunKodu, lotNo: s.lotNo ?? '',
          iadeMiktari: String(s.iadeMiktari), musteriIadeSebebi: s.musteriIadeSebebi,
          ilkIncelemeSonucu: s.ilkIncelemeSonucu ?? '', karar: s.karar ?? '',
          kararAciklama: s.kararAciklama ?? '', hurdaAdedi: s.hurdaAdedi != null ? String(s.hurdaAdedi) : '',
          reworkAdedi: s.reworkAdedi != null ? String(s.reworkAdedi) : '', musteriIadeAdedi: s.musteriIadeAdedi != null ? String(s.musteriIadeAdedi) : '', kokNeden: s.kokNeden ?? '', aksiyon: s.aksiyon ?? '',
        }))
      : [yeniSatir()],
  )
  const [saving, setSaving] = useState(false)
  const [triedSave, setTriedSave] = useState(false)

  // Accordion açık kart anahtarları — yeni kayıtta tek satır açık; mevcut kayıtta hepsi kapalı.
  const [openKeys, setOpenKeys] = useState<Set<string>>(
    () => (initial && initial.satirlar.length ? new Set<string>() : new Set(satirlar.map((s) => s.key))),
  )

  // Yeni/kopyalanan satırda ürün koduna odaklanmak için.
  const inputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map())
  const focusKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (focusKeyRef.current) {
      inputRefs.current.get(focusKeyRef.current)?.focus()
      focusKeyRef.current = null
    }
  })

  // ── Kaydedilmemiş değişiklik (beforeunload) — üst blok setter'larına dokunmadan
  //    tüm form durumunu ilk anlık görüntüyle karşılaştırarak türetilir. ──
  // satır key'leri mount'ta stabildir (alan düzenlemesi key'i değiştirmez); doğrudan dahil.
  const snapshot = JSON.stringify({
    tip, urunGelisTarihi, irsaliyeTarihi, irsaliyeNo, musteriId: musteri?.id ?? null, iadeTuru,
    sorumluId: sorumlu?.id ?? null, termin, kapanisTarihi, durum, maliyet, satirlar,
  })
  const ilkSnapshot = useRef<string | null>(null)
  if (ilkSnapshot.current === null) ilkSnapshot.current = snapshot
  const dirty = !saving && snapshot !== ilkSnapshot.current
  useEffect(() => {
    if (!dirty) return
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const kapali = durum === 'KAPALI'

  function updSatir(i: number, patch: Partial<SatirState>) {
    setSatirlar((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }
  function satirHatasi(s: SatirState): string | null {
    const iade = Number(s.iadeMiktari)
    const h = Number(s.hurdaAdedi || 0)
    const r = Number(s.reworkAdedi || 0)
    const m = Number(s.musteriIadeAdedi || 0)
    if (s.iadeMiktari && iade >= 1 && h + r + m > iade) return `hurda+rework+müşteri iade (${h + r + m}) > iade (${iade})`
    return null
  }
  // Zorunlu-alan + çelişki: kapalı kartta hata göstergesi + kaydette otomatik-açma için.
  function satirGecersizMi(s: SatirState): boolean {
    if (!s.urunKodu.trim()) return true
    if (!s.iadeMiktari || Number(s.iadeMiktari) < 1) return true
    if (!s.musteriIadeSebebi.trim()) return true
    if (satirHatasi(s)) return true
    return false
  }
  // Kapalı kart kırmızı: hurda/rework çelişkisi HER ZAMAN; zorunlu-alan eksikliği yalnız kaydet denemesinden sonra.
  function kartHataliMi(s: SatirState): boolean {
    if (satirHatasi(s)) return true
    if (triedSave && satirGecersizMi(s)) return true
    return false
  }

  function toggleOpen(key: string) {
    setOpenKeys((prev) => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }
  function satirEkle() {
    const ns = yeniSatir()
    setSatirlar((p) => [...p, ns])
    setOpenKeys((prev) => new Set(prev).add(ns.key))
    focusKeyRef.current = ns.key
  }
  function sonSatiriKopyala() {
    const son = satirlar[satirlar.length - 1]
    if (!son) return
    const ns: SatirState = { ...son, key: `s${keySeq++}` }
    setSatirlar((p) => [...p, ns])
    setOpenKeys((prev) => new Set(prev).add(ns.key))
    focusKeyRef.current = ns.key
  }
  function satirSil(i: number) {
    const key = satirlar[i].key
    setSatirlar((p) => p.filter((_, idx) => idx !== i))
    setOpenKeys((prev) => { const n = new Set(prev); n.delete(key); return n })
  }

  /**
   * Sorumlu kipi kaydı — YALNIZ kök neden + aksiyon.
   * Başlık doğrulamaları (müşteri/iade türü/satır zorunluları) ÇALIŞMAZ; o alanlar
   * gönderilmiyor ve API şeması (.strict()) fazlasını reddediyor.
   */
  async function sorumluKaydet() {
    if (!initial) return
    if (satirlar.some((s) => !s.id)) {
      toast.error('Satır kimliği çözülemedi — sayfayı yenileyip tekrar deneyin')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/quality/rma/${initial.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          satirlar: satirlar.map((s) => ({
            id: s.id,
            kokNeden: s.kokNeden.trim() || null,
            aksiyon: s.aksiyon.trim() || null,
          })),
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e?.error ?? `Kaydedilemedi (HTTP ${res.status})`)
      }
      toast.success('Kök neden ve aksiyon güncellendi')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hata')
    } finally {
      setSaving(false)
    }
  }

  async function kaydet() {
    if (mod === 'sorumlu') return sorumluKaydet()

    // Hatalı satırları otomatik aç + hata göstergesini etkinleştir (kaydet mantığı değişmez).
    setTriedSave(true)
    const hataliKeys = satirlar.filter(satirGecersizMi).map((s) => s.key)
    if (hataliKeys.length) setOpenKeys((prev) => new Set([...prev, ...hataliKeys]))

    // Client ön-kontrol
    if (!musteri) { toast.error('Müşteri seçin'); return }
    if (!iadeTuru) { toast.error('İade türü seçin'); return } // DB opsiyonel ama yeni/güncel kayıtta zorunlu
    if (satirlar.length === 0) { toast.error('En az bir ürün satırı gerekli'); return }
    for (let i = 0; i < satirlar.length; i++) {
      const s = satirlar[i]
      if (!s.urunKodu.trim()) { toast.error(`Satır ${i + 1}: ürün kodu zorunlu`); return }
      if (!s.iadeMiktari || Number(s.iadeMiktari) < 1) { toast.error(`Satır ${i + 1}: iade miktarı ≥ 1`); return }
      if (!s.musteriIadeSebebi.trim()) { toast.error(`Satır ${i + 1}: müşteri iade sebebi zorunlu`); return }
      const he = satirHatasi(s)
      if (he) { toast.error(`Satır ${i + 1}: ${he}`); return }
    }
    const payload = {
      tip, iadeTuru,
      urunGelisTarihi: urunGelisTarihi || null,
      irsaliyeTarihi: irsaliyeTarihi || null,
      irsaliyeNo: irsaliyeNo.trim() || null,
      musteriId: musteri.id,
      sorumluId: sorumlu?.id ?? null,
      termin: termin || null,
      kapanisTarihi: kapanisTarihi || null,
      durum,
      maliyet: maliyet.trim() ? Number(maliyet) : null,
      satirlar: satirlar.map((s, i) => ({
        siraNo: i + 1,
        urunKodu: s.urunKodu.trim(),
        lotNo: s.lotNo.trim() || null,
        iadeMiktari: Number(s.iadeMiktari),
        musteriIadeSebebi: s.musteriIadeSebebi.trim(),
        ilkIncelemeSonucu: s.ilkIncelemeSonucu.trim() || null,
        karar: s.karar || null,
        kararAciklama: s.kararAciklama.trim() || null,
        hurdaAdedi: s.hurdaAdedi.trim() ? Number(s.hurdaAdedi) : null,
        reworkAdedi: s.reworkAdedi.trim() ? Number(s.reworkAdedi) : null,
        musteriIadeAdedi: s.musteriIadeAdedi.trim() ? Number(s.musteriIadeAdedi) : null,
        kokNeden: s.kokNeden.trim() || null,
        aksiyon: s.aksiyon.trim() || null,
      })),
    }
    setSaving(true)
    try {
      const url = initial ? `/api/quality/rma/${initial.id}` : '/api/quality/rma'
      const res = await fetch(url, {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e?.error ?? `Kaydedilemedi (HTTP ${res.status})`)
      }
      const saved = await res.json()
      toast.success(initial ? 'Kayıt güncellendi' : `Kayıt oluşturuldu (No: ${saved.no})`)
      router.push(`/kalite/rma/${saved.id}`)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hata')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'h-9'
  const kartLabel = 'text-xs text-slate-600'
  const bolumBaslik = 'text-xs font-semibold uppercase tracking-wide text-slate-500'
  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm"><Link href="/kalite/rma"><ArrowLeft className="h-4 w-4 mr-1" />Liste</Link></Button>
          <h1 className="text-xl font-bold text-[#1B4F72]">
            {initial ? `RMA/SMA Kaydı — No ${initial.no}` : 'Yeni RMA/SMA Kaydı'}
          </h1>
          {kapali && <span className="rounded-full bg-green-100 text-green-800 px-2 py-0.5 text-xs font-semibold">KAPALI</span>}
          {initial && !kapali && <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-semibold">AÇIK</span>}
        </div>
        {ro && <span className="text-xs text-slate-500">Salt-okunur (düzenleme yetkiniz yok)</span>}
        {mod === 'sorumlu' && (
          <span className="text-xs text-amber-700 text-right">
            Bu kaydın sorumlusu olarak yalnız <strong>Kök Neden</strong> ve <strong>Aksiyon</strong> alanlarını düzenleyebilirsiniz
          </span>
        )}
      </div>

      {/* Üst blok */}
      <div className="rounded-md border bg-white p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs text-slate-600">Tip</Label>
          <Select value={tip} onValueChange={setTip} disabled={!duzenlenebilir}>
            <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{RMA_TIP_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-slate-600">No</Label>
          <Input value={initial ? String(initial.no) : 'kaydedince otomatik atanacak'} disabled readOnly className="mt-1 h-9 bg-slate-50" />
        </div>
        <div>
          <Label className="text-xs text-slate-600">İade Türü</Label>
          <Select value={iadeTuru || undefined} onValueChange={setIadeTuru} disabled={!duzenlenebilir}>
            <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{RMA_IADE_TURU_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs text-slate-600">Müşteri *</Label>
          <div className="mt-1"><MusteriSecici value={musteri} onChange={setMusteri} disabled={!duzenlenebilir} /></div>
        </div>
        <div>
          <Label className="text-xs text-slate-600">Sorumlu</Label>
          <div className="mt-1"><MusteriSecici value={sorumlu} onChange={setSorumlu} disabled={!duzenlenebilir} searchUrl="/api/quality/rma/sorumlu-ara" placeholder="Personel ara…" /></div>
        </div>
        <div><Label className="text-xs text-slate-600">Ürün Geliş Tarihi</Label><Input type="date" value={urunGelisTarihi} onChange={(e) => setUgt(e.target.value)} disabled={!duzenlenebilir} className={`mt-1 ${inputCls}`} /></div>
        <div><Label className="text-xs text-slate-600">İrsaliye Tarihi</Label><Input type="date" value={irsaliyeTarihi} onChange={(e) => setIt(e.target.value)} disabled={!duzenlenebilir} className={`mt-1 ${inputCls}`} /></div>
        <div><Label className="text-xs text-slate-600">İrsaliye No</Label><Input value={irsaliyeNo} onChange={(e) => setIno(e.target.value)} disabled={!duzenlenebilir} className={`mt-1 ${inputCls}`} /></div>
        <div><Label className="text-xs text-slate-600">Termin</Label><Input type="date" value={termin} onChange={(e) => setTermin(e.target.value)} disabled={!duzenlenebilir} className={`mt-1 ${inputCls}`} /></div>
        <div><Label className="text-xs text-slate-600">Kapanış Tarihi</Label><Input type="date" value={kapanisTarihi} onChange={(e) => setKt(e.target.value)} disabled={!duzenlenebilir} className={`mt-1 ${inputCls}`} /></div>
        <div>
          <Label className="text-xs text-slate-600">Durum</Label>
          <Select value={durum} onValueChange={setDurum} disabled={!duzenlenebilir}>
            <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{RMA_DURUM_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs text-slate-600">Maliyet</Label><Input type="number" step="0.01" min="0" value={maliyet} onChange={(e) => setMaliyet(e.target.value)} disabled={!duzenlenebilir} className={`mt-1 ${inputCls}`} /></div>
      </div>

      {/* Ürün satırları — kart listesi */}
      <div className="rounded-md border bg-white p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-700">Ürün Satırları ({satirlar.length})</h2>
          {duzenlenebilir && (
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={sonSatiriKopyala} disabled={satirlar.length === 0}>
                <Copy className="h-4 w-4 mr-1" />Son satırı kopyala
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={satirEkle}>
                <Plus className="h-4 w-4 mr-1" />Satır Ekle
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          {satirlar.map((s, i) => {
            const acik = openKeys.has(s.key)
            const hatali = kartHataliMi(s)
            const he = satirHatasi(s)
            const kararLabel = s.karar ? KARAR_LABELS[s.karar] : null
            return (
              <div key={s.key} className={`rounded-md border overflow-hidden ${hatali ? 'border-red-300' : 'border-slate-200'}`}>
                {/* Kapalı başlık — tıklanınca aç/kapa */}
                <button
                  type="button"
                  onClick={() => toggleOpen(s.key)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50"
                  aria-expanded={acik}
                >
                  <span className="tabular-nums text-slate-400 text-sm w-6 shrink-0">{i + 1}</span>
                  <span className="font-mono text-sm text-slate-800 shrink-0 truncate max-w-[8rem]">{s.urunKodu || '—'}</span>
                  <span className="text-sm text-slate-600 shrink-0 tabular-nums">{s.iadeMiktari ? `${s.iadeMiktari} adet` : '— adet'}</span>
                  <span className="text-sm text-slate-500 truncate min-w-0 flex-1">{s.musteriIadeSebebi || '—'}</span>
                  {hatali ? (
                    <Badge variant="outline" className="shrink-0 gap-1 bg-red-100 text-red-800 border-red-200">
                      <AlertTriangle className="h-3 w-3" />Hata
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className={`shrink-0 ${kararLabel ? KARAR_BADGE[s.karar] : 'bg-slate-100 text-slate-500 border-slate-200'}`}
                    >
                      {kararLabel ?? 'Karar bekliyor'}
                    </Badge>
                  )}
                  <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${acik ? 'rotate-180' : ''}`} />
                </button>

                {/* Açık içerik */}
                {acik && (
                  <div className="border-t border-slate-200 px-3 py-3 space-y-4">
                    {/* Giriş bilgileri */}
                    <div className="space-y-3">
                      <h3 className={bolumBaslik}>Giriş bilgileri</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <Label className={kartLabel}>Ürün Kodu *</Label>
                          <Input
                            ref={(el) => { if (el) inputRefs.current.set(s.key, el); else inputRefs.current.delete(s.key) }}
                            value={s.urunKodu} onChange={(e) => updSatir(i, { urunKodu: e.target.value })}
                            disabled={!duzenlenebilir} className="mt-1 h-9 font-mono"
                          />
                        </div>
                        <div>
                          <Label className={kartLabel}>Lot No</Label>
                          <Input value={s.lotNo} onChange={(e) => updSatir(i, { lotNo: e.target.value })} disabled={!duzenlenebilir} className="mt-1 h-9" />
                        </div>
                        <div>
                          <Label className={kartLabel}>İade Miktarı *</Label>
                          <Input type="number" min="1" value={s.iadeMiktari} onChange={(e) => updSatir(i, { iadeMiktari: e.target.value })} disabled={!duzenlenebilir} className={`mt-1 h-9 ${he ? 'border-red-400' : ''}`} />
                        </div>
                      </div>
                      <div>
                        <Label className={kartLabel}>Müşteri İade Sebebi *</Label>
                        <Textarea value={s.musteriIadeSebebi} onChange={(e) => updSatir(i, { musteriIadeSebebi: e.target.value })} disabled={!duzenlenebilir} rows={2} className="mt-1" />
                      </div>
                      {/* Kalite talebi: İlk İnceleme Sonucu, Müşteri İade Sebebi'nin HEMEN ALTINDA
                          (eskiden "İnceleme sonucu" bölümündeydi). */}
                      <div>
                        <Label className={kartLabel}>İlk İnceleme Sonucu</Label>
                        <Textarea value={s.ilkIncelemeSonucu} onChange={(e) => updSatir(i, { ilkIncelemeSonucu: e.target.value })} disabled={!duzenlenebilir} rows={2} className="mt-1" />
                      </div>
                    </div>

                    {/* İnceleme sonucu */}
                    <div className="space-y-3 border-t border-slate-200 pt-3">
                      <h3 className={bolumBaslik}>İnceleme sonucu</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div>
                          <Label className={kartLabel}>Karar</Label>
                          <Select value={s.karar || 'none'} onValueChange={(v) => updSatir(i, { karar: v === 'none' ? '' : v })} disabled={!duzenlenebilir}>
                            <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">—</SelectItem>
                              {RMA_KARAR_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className={kartLabel}>Hurda Adedi</Label>
                          <Input type="number" min="0" value={s.hurdaAdedi} onChange={(e) => updSatir(i, { hurdaAdedi: e.target.value })} disabled={!duzenlenebilir} className={`mt-1 h-9 ${he ? 'border-red-400' : ''}`} />
                        </div>
                        <div>
                          <Label className={kartLabel}>Rework Adedi</Label>
                          <Input type="number" min="0" value={s.reworkAdedi} onChange={(e) => updSatir(i, { reworkAdedi: e.target.value })} disabled={!duzenlenebilir} className={`mt-1 h-9 ${he ? 'border-red-400' : ''}`} />
                        </div>
                        <div>
                          <Label className={kartLabel}>Müşteri İade Adedi</Label>
                          <Input type="number" min="0" value={s.musteriIadeAdedi} onChange={(e) => updSatir(i, { musteriIadeAdedi: e.target.value })} disabled={!duzenlenebilir} className={`mt-1 h-9 ${he ? 'border-red-400' : ''}`} />
                        </div>
                      </div>
                      {he && <p className="text-xs text-red-600">{he} — kaydetmeden düzeltin.</p>}
                      <div>
                        <Label className={kartLabel}>Karar Açıklaması</Label>
                        <Textarea value={s.kararAciklama} onChange={(e) => updSatir(i, { kararAciklama: e.target.value })} disabled={!duzenlenebilir} rows={2} className="mt-1" />
                      </div>
                      <div>
                        <Label className={kartLabel}>Kök Neden</Label>
                        <Textarea value={s.kokNeden} onChange={(e) => updSatir(i, { kokNeden: e.target.value })} disabled={ro} rows={2} className="mt-1" />
                      </div>
                      <div>
                        <Label className={kartLabel}>Aksiyon</Label>
                        <Textarea value={s.aksiyon} onChange={(e) => updSatir(i, { aksiyon: e.target.value })} disabled={ro} rows={2} className="mt-1" />
                      </div>
                    </div>

                    {/* Alt: sil (sol) · kapat (sağ) */}
                    <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                      {duzenlenebilir ? (
                        <Button
                          type="button" variant="ghost" size="sm" onClick={() => satirSil(i)}
                          disabled={satirlar.length <= 1}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />Satırı sil
                        </Button>
                      ) : <span />}
                      <Button type="button" variant="outline" size="sm" onClick={() => toggleOpen(s.key)}>Kapat</Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {initial ? (
        <RmaFotoPanel rmaKayitId={initial.id} initial={initial.fotolar} canManage={duzenlenebilir} />
      ) : (
        <div className="rounded-md border bg-white p-4 text-sm text-slate-500">
          Fotoğraf eklemek için önce kaydedin.
        </div>
      )}

      {!ro && (
        <div className="flex justify-end gap-2">
          <Button asChild variant="outline"><Link href="/kalite/rma">İptal</Link></Button>
          <Button onClick={kaydet} disabled={saving} className="bg-[#1B4F72] hover:bg-[#1B4F72]/90">
            {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Kaydediliyor…</> : <><Save className="h-4 w-4 mr-1" />Kaydet</>}
          </Button>
        </div>
      )}
    </div>
  )
}
