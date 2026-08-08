'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { MusteriSecici, type MusteriOption } from './MusteriSecici'
import { RMA_TIP_OPTIONS, RMA_IADE_TURU_OPTIONS, RMA_KARAR_OPTIONS } from '@/lib/quality/rma-labels'

// ── Tipler ──
interface SatirState {
  key: string
  urunKodu: string
  lotNo: string
  iadeMiktari: string
  musteriIadeSebebi: string
  ilkIncelemeSonucu: string
  karar: string
  kararAciklama: string
  hurdaAdedi: string
  reworkAdedi: string
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
  maliyet: string | number | null
  satirlar: Array<{
    siraNo: number; urunKodu: string; lotNo: string | null; iadeMiktari: number
    musteriIadeSebebi: string; ilkIncelemeSonucu: string | null; karar: string | null
    kararAciklama: string | null; hurdaAdedi: number | null; reworkAdedi: number | null
    kokNeden: string | null; aksiyon: string | null
  }>
}

interface Props {
  initial: RmaDetay | null // null = yeni
  canManage: boolean
}

const isoToDateInput = (v: string | null): string => (v ? v.slice(0, 10) : '')
let keySeq = 0
const yeniSatir = (): SatirState => ({
  key: `s${keySeq++}`, urunKodu: '', lotNo: '', iadeMiktari: '', musteriIadeSebebi: '',
  ilkIncelemeSonucu: '', karar: '', kararAciklama: '', hurdaAdedi: '', reworkAdedi: '', kokNeden: '', aksiyon: '',
})

export function RmaFormClient({ initial, canManage }: Props) {
  const router = useRouter()
  const ro = !canManage // read-only

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
  const [maliyet, setMaliyet] = useState(initial?.maliyet != null ? String(initial.maliyet) : '')

  const [satirlar, setSatirlar] = useState<SatirState[]>(
    initial && initial.satirlar.length
      ? initial.satirlar.map((s) => ({
          key: `s${keySeq++}`, urunKodu: s.urunKodu, lotNo: s.lotNo ?? '',
          iadeMiktari: String(s.iadeMiktari), musteriIadeSebebi: s.musteriIadeSebebi,
          ilkIncelemeSonucu: s.ilkIncelemeSonucu ?? '', karar: s.karar ?? '',
          kararAciklama: s.kararAciklama ?? '', hurdaAdedi: s.hurdaAdedi != null ? String(s.hurdaAdedi) : '',
          reworkAdedi: s.reworkAdedi != null ? String(s.reworkAdedi) : '', kokNeden: s.kokNeden ?? '', aksiyon: s.aksiyon ?? '',
        }))
      : [yeniSatir()],
  )
  const [saving, setSaving] = useState(false)

  const kapali = kapanisTarihi !== ''

  function updSatir(i: number, patch: Partial<SatirState>) {
    setSatirlar((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }
  function satirHatasi(s: SatirState): string | null {
    const iade = Number(s.iadeMiktari)
    const h = Number(s.hurdaAdedi || 0)
    const r = Number(s.reworkAdedi || 0)
    if (s.iadeMiktari && iade >= 1 && h + r > iade) return `hurda+rework (${h + r}) > iade (${iade})`
    return null
  }

  async function kaydet() {
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
      </div>

      {/* Üst blok */}
      <div className="rounded-md border bg-white p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs text-slate-600">Tip</Label>
          <Select value={tip} onValueChange={setTip} disabled={ro}>
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
          <Select value={iadeTuru || undefined} onValueChange={setIadeTuru} disabled={ro}>
            <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{RMA_IADE_TURU_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs text-slate-600">Müşteri *</Label>
          <div className="mt-1"><MusteriSecici value={musteri} onChange={setMusteri} disabled={ro} /></div>
        </div>
        <div>
          <Label className="text-xs text-slate-600">Sorumlu</Label>
          <div className="mt-1"><MusteriSecici value={sorumlu} onChange={setSorumlu} disabled={ro} searchUrl="/api/quality/rma/sorumlu-ara" placeholder="Personel ara…" /></div>
        </div>
        <div><Label className="text-xs text-slate-600">Ürün Geliş Tarihi</Label><Input type="date" value={urunGelisTarihi} onChange={(e) => setUgt(e.target.value)} disabled={ro} className={`mt-1 ${inputCls}`} /></div>
        <div><Label className="text-xs text-slate-600">İrsaliye Tarihi</Label><Input type="date" value={irsaliyeTarihi} onChange={(e) => setIt(e.target.value)} disabled={ro} className={`mt-1 ${inputCls}`} /></div>
        <div><Label className="text-xs text-slate-600">İrsaliye No</Label><Input value={irsaliyeNo} onChange={(e) => setIno(e.target.value)} disabled={ro} className={`mt-1 ${inputCls}`} /></div>
        <div><Label className="text-xs text-slate-600">Termin</Label><Input type="date" value={termin} onChange={(e) => setTermin(e.target.value)} disabled={ro} className={`mt-1 ${inputCls}`} /></div>
        <div><Label className="text-xs text-slate-600">Kapanış Tarihi</Label><Input type="date" value={kapanisTarihi} onChange={(e) => setKt(e.target.value)} disabled={ro} className={`mt-1 ${inputCls}`} /></div>
        <div><Label className="text-xs text-slate-600">Maliyet</Label><Input type="number" step="0.01" min="0" value={maliyet} onChange={(e) => setMaliyet(e.target.value)} disabled={ro} className={`mt-1 ${inputCls}`} /></div>
      </div>

      {/* Ürün satırları */}
      <div className="rounded-md border bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">Ürün Satırları ({satirlar.length})</h2>
          {!ro && <Button type="button" variant="outline" size="sm" onClick={() => setSatirlar((p) => [...p, yeniSatir()])}><Plus className="h-4 w-4 mr-1" />Satır Ekle</Button>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[1400px]">
            <thead className="bg-slate-50">
              <tr>
                {['#', 'Ürün Kodu *', 'Lot No', 'İade Mik. *', 'Müşteri İade Sebebi *', 'İlk İnceleme', 'Karar', 'Karar Açıklaması', 'Hurda', 'Rework', 'Kök Neden', 'Aksiyon', ''].map((h, i) => (
                  <th key={i} className="px-2 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {satirlar.map((s, i) => {
                const he = satirHatasi(s)
                return (
                  <tr key={s.key} className="border-t border-slate-100 align-top">
                    <td className="px-2 py-2 tabular-nums text-slate-500">{i + 1}</td>
                    <td className="px-2 py-2"><Input value={s.urunKodu} onChange={(e) => updSatir(i, { urunKodu: e.target.value })} disabled={ro} className="h-8 w-28 font-mono" /></td>
                    <td className="px-2 py-2"><Input value={s.lotNo} onChange={(e) => updSatir(i, { lotNo: e.target.value })} disabled={ro} className="h-8 w-24" /></td>
                    <td className="px-2 py-2"><Input type="number" min="1" value={s.iadeMiktari} onChange={(e) => updSatir(i, { iadeMiktari: e.target.value })} disabled={ro} className={`h-8 w-20 ${he ? 'border-red-400' : ''}`} /></td>
                    <td className="px-2 py-2"><textarea value={s.musteriIadeSebebi} onChange={(e) => updSatir(i, { musteriIadeSebebi: e.target.value })} disabled={ro} rows={2} className="w-48 rounded border px-2 py-1 text-sm disabled:bg-slate-50" /></td>
                    <td className="px-2 py-2"><textarea value={s.ilkIncelemeSonucu} onChange={(e) => updSatir(i, { ilkIncelemeSonucu: e.target.value })} disabled={ro} rows={2} className="w-48 rounded border px-2 py-1 text-sm disabled:bg-slate-50" /></td>
                    <td className="px-2 py-2">
                      <Select value={s.karar || 'none'} onValueChange={(v) => updSatir(i, { karar: v === 'none' ? '' : v })} disabled={ro}>
                        <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {RMA_KARAR_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-2"><textarea value={s.kararAciklama} onChange={(e) => updSatir(i, { kararAciklama: e.target.value })} disabled={ro} rows={2} className="w-48 rounded border px-2 py-1 text-sm disabled:bg-slate-50" /></td>
                    <td className="px-2 py-2"><Input type="number" min="0" value={s.hurdaAdedi} onChange={(e) => updSatir(i, { hurdaAdedi: e.target.value })} disabled={ro} className={`h-8 w-20 ${he ? 'border-red-400' : ''}`} /></td>
                    <td className="px-2 py-2"><Input type="number" min="0" value={s.reworkAdedi} onChange={(e) => updSatir(i, { reworkAdedi: e.target.value })} disabled={ro} className={`h-8 w-20 ${he ? 'border-red-400' : ''}`} /></td>
                    <td className="px-2 py-2"><textarea value={s.kokNeden} onChange={(e) => updSatir(i, { kokNeden: e.target.value })} disabled={ro} rows={2} className="w-48 rounded border px-2 py-1 text-sm disabled:bg-slate-50" /></td>
                    <td className="px-2 py-2"><textarea value={s.aksiyon} onChange={(e) => updSatir(i, { aksiyon: e.target.value })} disabled={ro} rows={2} className="w-48 rounded border px-2 py-1 text-sm disabled:bg-slate-50" /></td>
                    <td className="px-2 py-2">
                      {!ro && satirlar.length > 1 && (
                        <button type="button" onClick={() => setSatirlar((p) => p.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-600" aria-label="Satırı sil"><Trash2 className="h-4 w-4" /></button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {satirlar.some((s) => satirHatasi(s)) && (
          <p className="text-xs text-red-600">Kırmızı satırlarda hurda+rework iade miktarını aşıyor — kaydetmeden düzeltin.</p>
        )}
      </div>

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
