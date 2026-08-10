'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MusteriSecici, type MusteriOption } from '@/components/quality/rma/MusteriSecici'
import { HataKoduSecici, type HataKoduSecenek } from './HataKoduSecici'
import {
  UYGUNSUZLUK_KARAR_OPTIONS,
  redOrani,
  formatOran,
} from '@/lib/quality/uygunsuzluk-labels'

// ── Tipler ──
interface SatirState {
  key: string
  yariMamulKodu: string
  malzemeAdi: string
  redAdeti: string
  reworkAdedi: string
  olusanBolumId: string | null
  hataKoduId: string | null
  hataDetayi: string
  karar: string
}

export interface UygunsuzlukDetay {
  id: string
  no: number
  tarih: string
  mamulUrunKodu: string
  isEmriNo: string
  isEmriAdeti: number | null
  tespitEdenBolumId: string | null
  kokNeden: string | null
  duzelticiFaaliyet: string | null
  sorumluId: string | null
  sorumlu?: { adSoyad: string; sicilNo: string | null } | null
  termin: string | null
  kapanisTarihi: string | null
  satirlar: {
    siraNo: number
    yariMamulKodu: string | null
    malzemeAdi: string | null
    redAdeti: number
    reworkAdedi: number | null
    olusanBolumId: string | null
    hataKoduId: string | null
    hataDetayi: string | null
    karar: string | null
  }[]
}

let keySeq = 0
const yeniSatir = (): SatirState => ({
  key: `s${keySeq++}`,
  yariMamulKodu: '',
  malzemeAdi: '',
  redAdeti: '',
  reworkAdedi: '',
  olusanBolumId: null,
  hataKoduId: null,
  hataDetayi: '',
  karar: '',
})

/** ISO → yyyy-MM-dd (date input için) */
function isoToDate(v: string | null): string {
  if (!v) return ''
  return new Date(v).toISOString().slice(0, 10)
}

/**
 * Uygunsuzluk formu (KAL-KYT-15 Bölüm 2).
 *
 * RmaFormClient deseni: elle kontrollü `useState` + shadcn primitifleri.
 * react-hook-form / SurveyRenderer KULLANILMIYOR (portalda RMA da öyle).
 * Etiketler `uygunsuzluk-labels.ts` — tek kaynak.
 */
export function UygunsuzlukFormClient({
  initial,
  canManage,
}: {
  initial: UygunsuzlukDetay | null
  canManage: boolean
}) {
  const router = useRouter()
  const ro = !canManage

  const [kodlar, setKodlar] = useState<HataKoduSecenek[]>([])

  const [tarih, setTarih] = useState(initial ? isoToDate(initial.tarih) : '')
  const [mamulUrunKodu, setMamulUrunKodu] = useState(initial?.mamulUrunKodu ?? '')
  const [isEmriNo, setIsEmriNo] = useState(initial?.isEmriNo ?? '')
  const [isEmriAdeti, setIsEmriAdeti] = useState(
    initial?.isEmriAdeti != null ? String(initial.isEmriAdeti) : '',
  )
  const [tespitEdenBolumId, setTespitEdenBolumId] = useState<string | null>(
    initial?.tespitEdenBolumId ?? null,
  )
  const [kokNeden, setKokNeden] = useState(initial?.kokNeden ?? '')
  const [duzelticiFaaliyet, setDuzelticiFaaliyet] = useState(initial?.duzelticiFaaliyet ?? '')
  const [sorumlu, setSorumlu] = useState<MusteriOption | null>(
    initial?.sorumluId && initial.sorumlu
      ? {
          id: initial.sorumluId,
          code: initial.sorumlu.sicilNo ?? '',
          name: initial.sorumlu.adSoyad,
        }
      : null,
  )
  const [termin, setTermin] = useState(initial ? isoToDate(initial.termin) : '')
  const [kapanisTarihi, setKapanisTarihi] = useState(initial ? isoToDate(initial.kapanisTarihi) : '')

  const [satirlar, setSatirlar] = useState<SatirState[]>(
    initial && initial.satirlar.length
      ? initial.satirlar.map((s) => ({
          key: `s${keySeq++}`,
          yariMamulKodu: s.yariMamulKodu ?? '',
          malzemeAdi: s.malzemeAdi ?? '',
          redAdeti: String(s.redAdeti),
          reworkAdedi: s.reworkAdedi != null ? String(s.reworkAdedi) : '',
          olusanBolumId: s.olusanBolumId,
          hataKoduId: s.hataKoduId,
          hataDetayi: s.hataDetayi ?? '',
          karar: s.karar ?? '',
        }))
      : [yeniSatir()],
  )
  const [kaydediliyor, setKaydediliyor] = useState(false)

  // Seçiciler için hata kodu listesi — tek istek, tip'e göre burada süzülür.
  useEffect(() => {
    fetch('/api/quality/hata-kodu?duz=1')
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j) => setKodlar(j.items ?? []))
      .catch(() => setKodlar([]))
  }, [])

  const bolumSecenekleri = kodlar.filter((k) => k.tip === 'BOLUM')
  const kodSecenekleri = kodlar.filter((k) => k.tip === 'KOD')
  /** Hata kodu satırında ait olduğu bölümü göster (dünkü düz liste mantığı). */
  const kodBolumEtiketi = (s: HataKoduSecenek) => {
    if (!s.ustKodId) return 'Genel'
    const p = kodlar.find((k) => k.id === s.ustKodId)
    return p ? `${p.kod} ${p.ad}` : 'Genel'
  }

  function updSatir(i: number, patch: Partial<SatirState>) {
    setSatirlar((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }

  const toplamRed = satirlar.reduce((t, s) => t + (Number(s.redAdeti) || 0), 0)
  const oran = redOrani(toplamRed, Number(isEmriAdeti) || null)

  async function kaydet() {
    if (kaydediliyor) return
    if (!tarih) return void toast.error('Tarih zorunlu')
    if (!mamulUrunKodu.trim()) return void toast.error('Mamul ürün kodu zorunlu')
    if (!isEmriNo.trim()) return void toast.error('İş emri no zorunlu')
    if (satirlar.length === 0) return void toast.error('En az bir ürün satırı gerekli')

    for (let i = 0; i < satirlar.length; i++) {
      const s = satirlar[i]
      const red = Number(s.redAdeti)
      if (!s.redAdeti || !Number.isInteger(red) || red < 1) {
        return void toast.error(`Satır ${i + 1}: red adeti ≥ 1 olmalı`)
      }
      const rework = s.reworkAdedi ? Number(s.reworkAdedi) : 0
      if (rework > red) {
        return void toast.error(`Satır ${i + 1}: rework (${rework}), red adetini (${red}) aşamaz`)
      }
    }

    setKaydediliyor(true)
    try {
      const body = {
        tarih,
        mamulUrunKodu: mamulUrunKodu.trim(),
        isEmriNo: isEmriNo.trim(),
        isEmriAdeti: isEmriAdeti ? Number(isEmriAdeti) : null,
        tespitEdenBolumId,
        kokNeden: kokNeden.trim() || null,
        duzelticiFaaliyet: duzelticiFaaliyet.trim() || null,
        sorumluId: sorumlu?.id ?? null,
        termin: termin || null,
        kapanisTarihi: kapanisTarihi || null,
        satirlar: satirlar.map((s, i) => ({
          siraNo: i + 1,
          yariMamulKodu: s.yariMamulKodu.trim() || null,
          malzemeAdi: s.malzemeAdi.trim() || null,
          redAdeti: Number(s.redAdeti),
          reworkAdedi: s.reworkAdedi ? Number(s.reworkAdedi) : null,
          olusanBolumId: s.olusanBolumId,
          hataKoduId: s.hataKoduId,
          hataDetayi: s.hataDetayi.trim() || null,
          karar: s.karar || null,
        })),
      }

      const res = await fetch(
        initial ? `/api/quality/uygunsuzluk/${initial.id}` : '/api/quality/uygunsuzluk',
        {
          method: initial ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      const saved = await res.json().catch(() => null)
      // API hata metni OLDUĞU GİBİ gösterilir (referans kısıtı mesajları dahil).
      if (!res.ok) throw new Error(saved?.error || 'Kayıt başarısız')

      toast.success(initial ? 'Kayıt güncellendi' : `Kayıt oluşturuldu (No: ${saved.no})`)
      router.push(`/kalite/uygunsuzluk/${saved.id}`)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hata')
    } finally {
      setKaydediliyor(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
            <Link href="/kalite/uygunsuzluk">
              <ArrowLeft className="h-4 w-4 mr-1" /> Listeye dön
            </Link>
          </Button>
          <h1 className="text-2xl font-bold text-[#1B4F72]">
            {initial ? `Uygunsuzluk No: ${initial.no}` : 'Yeni Uygunsuzluk'}
          </h1>
        </div>
        {canManage && (
          <Button
            onClick={kaydet}
            disabled={kaydediliyor}
            className="bg-[#1B4F72] hover:bg-[#1B4F72]/90 shrink-0"
          >
            {kaydediliyor ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Kaydet
          </Button>
        )}
      </div>

      {/* ── Başlık ── */}
      <div className="rounded-md border bg-white p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs text-slate-600">Tarih *</Label>
          <Input type="date" value={tarih} disabled={ro} onChange={(e) => setTarih(e.target.value)} className="mt-1 h-9" />
        </div>
        <div>
          <Label className="text-xs text-slate-600">Mamul ürün kodu *</Label>
          <Input value={mamulUrunKodu} disabled={ro} onChange={(e) => setMamulUrunKodu(e.target.value)} className="mt-1 h-9" />
        </div>
        <div>
          <Label className="text-xs text-slate-600">İş emri no *</Label>
          <Input value={isEmriNo} disabled={ro} onChange={(e) => setIsEmriNo(e.target.value)} className="mt-1 h-9 font-quality-mono" />
        </div>
        <div>
          <Label className="text-xs text-slate-600">İş emri adeti</Label>
          <Input type="number" min={1} value={isEmriAdeti} disabled={ro} onChange={(e) => setIsEmriAdeti(e.target.value)} className="mt-1 h-9" />
          <p className="mt-1 text-[11px] text-slate-400">Red oranı bu değere göre hesaplanır</p>
        </div>
        <div className="lg:col-span-2">
          <Label className="text-xs text-slate-600">Tespit eden bölüm</Label>
          <div className="mt-1">
            <HataKoduSecici
              value={tespitEdenBolumId}
              onChange={setTespitEdenBolumId}
              secenekler={bolumSecenekleri}
              placeholder="Bölüm ara…"
              disabled={ro}
            />
          </div>
        </div>
        <div>
          <Label className="text-xs text-slate-600">Sorumlu</Label>
          <div className="mt-1">
            <MusteriSecici
              value={sorumlu}
              onChange={setSorumlu}
              disabled={ro}
              searchUrl="/api/quality/rma/sorumlu-ara"
              placeholder="Personel ara…"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs text-slate-600">Termin</Label>
          <Input type="date" value={termin} disabled={ro} onChange={(e) => setTermin(e.target.value)} className="mt-1 h-9" />
        </div>
        <div>
          <Label className="text-xs text-slate-600">Kapanış tarihi</Label>
          <Input type="date" value={kapanisTarihi} disabled={ro} onChange={(e) => setKapanisTarihi(e.target.value)} className="mt-1 h-9" />
        </div>
        <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-slate-600">Kök neden</Label>
            <Textarea value={kokNeden} disabled={ro} onChange={(e) => setKokNeden(e.target.value)} rows={3} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-slate-600">Düzeltici faaliyet</Label>
            <Textarea value={duzelticiFaaliyet} disabled={ro} onChange={(e) => setDuzelticiFaaliyet(e.target.value)} rows={3} className="mt-1" />
          </div>
        </div>
      </div>

      {/* ── Özet ── */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
          {satirlar.length} satır
        </Badge>
        <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
          Toplam red: <span className="tabular-nums ml-1">{toplamRed}</span>
        </Badge>
        {/* Red oranı: iş emri adeti boş/0 ise HİÇBİR ŞEY gösterilmez */}
        {oran !== null && (
          <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">
            Red oranı: {formatOran(oran)}
          </Badge>
        )}
      </div>

      {/* ── Satırlar ── */}
      <div className="space-y-3">
        {satirlar.map((s, i) => (
          <div key={s.key} className="rounded-md border bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Satır {i + 1}
              </span>
              {canManage && satirlar.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSatirlar((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  title="Satırı sil"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs text-slate-600">Yarı mamul kodu</Label>
                <Input value={s.yariMamulKodu} disabled={ro} onChange={(e) => updSatir(i, { yariMamulKodu: e.target.value })} className="mt-1 h-9" />
              </div>
              <div>
                <Label className="text-xs text-slate-600">Malzeme adı</Label>
                <Input value={s.malzemeAdi} disabled={ro} onChange={(e) => updSatir(i, { malzemeAdi: e.target.value })} className="mt-1 h-9" />
              </div>
              <div>
                <Label className="text-xs text-slate-600">Red adeti *</Label>
                <Input type="number" min={1} value={s.redAdeti} disabled={ro} onChange={(e) => updSatir(i, { redAdeti: e.target.value })} className="mt-1 h-9" />
              </div>
              <div>
                <Label className="text-xs text-slate-600">Rework adedi</Label>
                <Input type="number" min={0} value={s.reworkAdedi} disabled={ro} onChange={(e) => updSatir(i, { reworkAdedi: e.target.value })} className="mt-1 h-9" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-slate-600">Oluşan bölüm</Label>
                <div className="mt-1">
                  <HataKoduSecici
                    value={s.olusanBolumId}
                    onChange={(id) => updSatir(i, { olusanBolumId: id })}
                    secenekler={bolumSecenekleri}
                    placeholder="Bölüm ara…"
                    disabled={ro}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-slate-600">Hata kodu</Label>
                <div className="mt-1">
                  <HataKoduSecici
                    value={s.hataKoduId}
                    onChange={(id) => updSatir(i, { hataKoduId: id })}
                    secenekler={kodSecenekleri}
                    bolumEtiketi={kodBolumEtiketi}
                    placeholder="Hata kodu ara…"
                    disabled={ro}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-slate-600">Karar</Label>
                <Select
                  value={s.karar || 'yok'}
                  onValueChange={(v) => updSatir(i, { karar: v === 'yok' ? '' : v })}
                  disabled={ro}
                >
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yok">Seçilmedi</SelectItem>
                    {UYGUNSUZLUK_KARAR_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs text-slate-600">Hata detayı</Label>
              <Textarea value={s.hataDetayi} disabled={ro} onChange={(e) => updSatir(i, { hataDetayi: e.target.value })} rows={2} className="mt-1" />
            </div>
          </div>
        ))}

        {canManage && (
          <Button variant="outline" onClick={() => setSatirlar((prev) => [...prev, yeniSatir()])}>
            <Plus className="h-4 w-4 mr-1" /> Satır ekle
          </Button>
        )}
      </div>
    </div>
  )
}
