'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart, Bar, LabelList,
} from 'recharts'
import { Loader2, PlusCircle, Target, Pencil, Trash2 } from 'lucide-react'

const NAVY = '#1B4F72'
const YESIL = '#16a34a'
const KIRMIZI = '#dc2626'
const AY_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
const AY_ADI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

interface Olcum {
  id: string
  year: number
  month: number
  target: number | null
  actual: number | null
}

interface Aksiyon {
  id: string
  reason: string | null
  action: string | null
  completionPercent: number | null
  status: string
  responsibleId: string | null
  sorumluPersonelId: string | null
  responsibleName: string | null
  startDate: string | null
  endDate: string | null
}

interface Baseline {
  year: number
  average: number
}

interface Kpi {
  id: string
  name: string
  unit: string | null
  direction: string
  measurements: Olcum[]
  baselines: Baseline[]
  actions: Aksiyon[]
}

// Yıl → ortalama haritası. Aylık ölçümü olan yıllarda KENDİSİ hesaplanır;
// aylık kırılımı olmayan eski yıllarda (2020-2023 gibi) Excel'den/elle
// girilmiş KPIYearlyBaseline değeri kullanılır. Grafik ve tablo aynı
// fonksiyonu kullanır ki ikisi hep tutarlı olsun.
function hesaplaOrtYillar(kpi: Kpi): [number, number][] {
  const yillarKumesi = new Set<number>([...kpi.measurements.map(m => m.year), ...kpi.baselines.map(b => b.year)])
  const hesaplanan = new Map<number, number>()
  for (const yil of yillarKumesi) {
    const degerler = kpi.measurements.filter(m => m.year === yil && m.actual != null).map(m => m.actual as number)
    if (degerler.length > 0) hesaplanan.set(yil, degerler.reduce((a, b) => a + b, 0) / degerler.length)
  }
  for (const b of kpi.baselines) {
    if (!hesaplanan.has(b.year)) hesaplanan.set(b.year, b.average)
  }
  return Array.from(hesaplanan.entries()).sort(([a], [b]) => a - b)
}

function YeniKpiDialog({ orgUnitId, onCreated }: { orgUnitId: string; onCreated: () => void }) {
  const [acik, setAcik] = useState(false)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [direction, setDirection] = useState('higher_is_better')
  const [hedef, setHedef] = useState('')
  const [kaydediliyor, setKaydediliyor] = useState(false)

  async function kaydet() {
    if (!name.trim()) return
    setKaydediliyor(true)
    try {
      const res = await fetch('/api/yonetim/kpi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, unit, direction, orgUnitId }),
      })
      if (res.ok) {
        const { kpi } = await res.json()
        // Hedef girildiyse bu yılın 12 ayına tek seferde uygula — tek tek girmeye gerek kalmasın.
        if (hedef.trim() && !Number.isNaN(Number(hedef))) {
          const yil = new Date().getFullYear()
          await Promise.all(
            Array.from({ length: 12 }, (_, i) =>
              fetch(`/api/yonetim/kpi/${kpi.id}/olcum`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ year: yil, month: i + 1, target: Number(hedef), actual: null }),
              }),
            ),
          )
        }
        setName(''); setUnit(''); setDirection('higher_is_better'); setHedef('')
        setAcik(false)
        onCreated()
      }
    } finally {
      setKaydediliyor(false)
    }
  }

  return (
    <Dialog open={acik} onOpenChange={setAcik}>
      <DialogTrigger asChild>
        <Button size="sm" style={{ backgroundColor: NAVY }}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Yeni KPI Ekle
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni KPI Ekle</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>KPI Adı</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Örn: Devir Hızı" />
          </div>
          <div>
            <Label>Birim (opsiyonel)</Label>
            <Input value={unit} onChange={e => setUnit(e.target.value)} placeholder="%, Adet, Saat..." />
          </div>
          <div>
            <Label>Yön</Label>
            <Select value={direction} onValueChange={setDirection}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="higher_is_better">Yüksek değer iyi</SelectItem>
                <SelectItem value="lower_is_better">Düşük değer iyi</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Hedef (opsiyonel)</Label>
            <Input
              type="number"
              value={hedef}
              onChange={e => setHedef(e.target.value)}
              placeholder="Girilirse bu yılın 12 ayına otomatik uygulanır"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={kaydet} disabled={kaydediliyor || !name.trim()} style={{ backgroundColor: NAVY }}>
            {kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface SorumluAday {
  id: string
  displayName: string
  positionTitle: string | null
}

function tarihGirdi(v: string | null): string {
  if (!v) return ''
  return v.slice(0, 10)
}

function AksiyonFormDialog({
  kpiId, mevcut, onSaved,
}: { kpiId: string; mevcut?: Aksiyon; onSaved: () => void }) {
  const duzenlemeModu = !!mevcut
  const [acik, setAcik] = useState(false)
  const [reason, setReason] = useState(mevcut?.reason ?? '')
  const [action, setAction] = useState(mevcut?.action ?? '')
  const [sorumluPersonelId, setSorumluPersonelId] = useState(mevcut?.sorumluPersonelId ?? '')
  const [startDate, setStartDate] = useState(tarihGirdi(mevcut?.startDate ?? null))
  const [endDate, setEndDate] = useState(tarihGirdi(mevcut?.endDate ?? null))
  const [completionPercent, setCompletionPercent] = useState(String(mevcut?.completionPercent ?? 0))
  const [adaylar, setAdaylar] = useState<SorumluAday[]>([])
  const [kaydediliyor, setKaydediliyor] = useState(false)

  useEffect(() => {
    if (!acik) return
    fetch(`/api/yonetim/kpi/${kpiId}/aksiyon`)
      .then(res => res.json())
      .then(d => setAdaylar(d.sorumluAdaylari ?? []))
      .catch(() => setAdaylar([]))
  }, [acik, kpiId])

  async function kaydet() {
    if (!action.trim()) return
    setKaydediliyor(true)
    try {
      const url = duzenlemeModu
        ? `/api/yonetim/kpi/${kpiId}/aksiyon/${mevcut!.id}`
        : `/api/yonetim/kpi/${kpiId}/aksiyon`
      const res = await fetch(url, {
        method: duzenlemeModu ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          action,
          sorumluPersonelId: sorumluPersonelId || null,
          startDate: startDate || null,
          endDate: endDate || null,
          completionPercent: completionPercent === '' ? 0 : Number(completionPercent),
        }),
      })
      if (res.ok) {
        if (!duzenlemeModu) {
          setReason(''); setAction(''); setSorumluPersonelId(''); setStartDate(''); setEndDate(''); setCompletionPercent('0')
        }
        setAcik(false)
        onSaved()
      }
    } finally {
      setKaydediliyor(false)
    }
  }

  return (
    <Dialog open={acik} onOpenChange={setAcik}>
      <DialogTrigger asChild>
        {duzenlemeModu ? (
          <Button size="icon" variant="ghost" className="h-7 w-7">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="sm" variant="outline">
            <PlusCircle className="h-4 w-4 mr-2" />
            Aksiyon Ekle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{duzenlemeModu ? 'Aksiyonu Düzenle' : 'Yeni Aksiyon Ekle'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Neden (opsiyonel)</Label>
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Örn: Anket katılımı düşük" />
          </div>
          <div>
            <Label>Aksiyon</Label>
            <Input value={action} onChange={e => setAction(e.target.value)} placeholder="Yapılacak iş" />
          </div>
          <div>
            <Label>Sorumlu</Label>
            <Select value={sorumluPersonelId} onValueChange={setSorumluPersonelId}>
              <SelectTrigger><SelectValue placeholder="Kişi seç (departmandan)" /></SelectTrigger>
              <SelectContent>
                {adaylar.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">Bu departmanda kayıtlı kişi yok</div>
                ) : (
                  adaylar.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.displayName}{a.positionTitle ? ` — ${a.positionTitle}` : ''}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label>Başlangıç Tarihi</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="flex-1">
              <Label>Bitiş Tarihi</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Tamamlanma Yüzdesi</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={completionPercent}
              onChange={e => setCompletionPercent(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={kaydet} disabled={kaydediliyor || !action.trim()} style={{ backgroundColor: NAVY }}>
            {kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function hedefTutuldu(kpi: Kpi, target: number | null, actual: number | null): boolean | null {
  if (target == null || actual == null) return null
  return kpi.direction === 'lower_is_better' ? actual <= target : actual >= target
}

function sayiFormat(n: number | null): string {
  if (n == null) return ''
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
}

// Sütun ve üstündeki çizgi aynı yılın aynı değerini taşıyor — tooltip'te iki kere
// yazmasın diye aynı dataKey'e sahip girdilerden sadece ilkini gösteriyoruz.
function GrafikTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { dataKey?: string | number; name?: string; value?: number; color?: string }[]
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  const gorulen = new Set<string | number | undefined>()
  const satirlar = payload.filter(p => {
    if (gorulen.has(p.dataKey)) return false
    gorulen.add(p.dataKey)
    return true
  })
  return (
    <div className="bg-white border border-slate-200 rounded-md shadow-md p-2 text-xs">
      <p className="font-semibold mb-1">{label}</p>
      {satirlar.map(p => (
        <div key={String(p.dataKey)} style={{ color: p.color }}>
          {p.name}: {sayiFormat(p.value ?? null)}
        </div>
      ))}
    </div>
  )
}

function DuzenlenebilirHucre({
  deger, onKaydet, className, style,
}: { deger: number | null; onKaydet: (v: number | null) => void; className?: string; style?: React.CSSProperties }) {
  const [duzenleniyor, setDuzenleniyor] = useState(false)
  const [taslak, setTaslak] = useState(deger == null ? '' : String(deger))

  useEffect(() => { setTaslak(deger == null ? '' : String(deger)) }, [deger])

  function bitir() {
    setDuzenleniyor(false)
    const sayi = taslak.trim() === '' ? null : Number(taslak.replace(',', '.'))
    if (sayi !== deger && !(sayi == null && deger == null)) onKaydet(Number.isNaN(sayi) ? null : sayi)
  }

  if (duzenleniyor) {
    return (
      <td className={className} style={style}>
        <input
          autoFocus
          className="w-16 text-center bg-white border border-blue-400 rounded outline-none"
          value={taslak}
          onChange={e => setTaslak(e.target.value)}
          onBlur={bitir}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        />
      </td>
    )
  }
  return (
    <td
      className={`${className} cursor-pointer hover:ring-1 hover:ring-blue-300`}
      style={style}
      onClick={() => setDuzenleniyor(true)}
    >
      {sayiFormat(deger) || <span className="text-muted-foreground">·</span>}
    </td>
  )
}

function KpiVeriTablosu({
  kpi, yillar, onChanged, aktifYil, onAktifYilChange,
}: { kpi: Kpi; yillar: number[]; onChanged: () => void; aktifYil: number | null; onAktifYilChange: (y: number) => void }) {
  const [ekstraYillar, setEkstraYillar] = useState<number[]>([])
  const [donemYilGirdi, setDonemYilGirdi] = useState('')
  const tumYillar = useMemo(
    () => Array.from(new Set([...yillar, ...ekstraYillar])).sort((a, b) => b - a),
    [yillar, ekstraYillar],
  )

  // Aktif dönem: aynı anda sadece İKİ yıl (aktif + bir önceki) karşılaştırılır,
  // geçmiş tüm yıllar alt alta gösterilmez — yukarıdaki düğmelerle dönem değiştirilir.
  // (aktifYil üst bileşende tutulur ki Aksiyonlar listesi de aynı döneme göre filtrelenebilsin.)
  useEffect(() => {
    if (aktifYil == null && tumYillar.length > 0) onAktifYilChange(tumYillar[0])
  }, [aktifYil, tumYillar, onAktifYilChange])
  const gosterilenYillar = aktifYil == null ? [] : [aktifYil, aktifYil - 1]

  // Ortalama sütunu: aylık verisi olan yıllar için KENDİSİ hesaplanır (elle
  // ayrı bir "ortalama ekle" adımına gerek yok); aylık kırılımı olmayan eski
  // yıllar (2020-2023 gibi) için elle girilen/Excel'den gelen değer kullanılır.
  // Ayrıca hangi yıllar "Dönem Karşılaştır" ile eklendiyse onlar için de otomatik
  // (başta boş/düzenlenebilir) bir Ort. sütunu açılır — ayrı bir ekleme adımı yok.
  const yillarIleOlcum = useMemo(() => new Set(kpi.measurements.filter(m => m.actual != null).map(m => m.year)), [kpi])
  const ortYillar = useMemo((): [number, number | null][] => {
    const hesap = new Map<number, number | null>(hesaplaOrtYillar(kpi))
    for (const y of tumYillar) if (!hesap.has(y)) hesap.set(y, null)
    return Array.from(hesap.entries()).sort(([a], [b]) => a - b)
  }, [kpi, tumYillar])

  async function ortalamaKaydet(yil: number, deger: number | null) {
    await fetch(`/api/yonetim/kpi/${kpi.id}/ortalama`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: yil, average: deger }),
    })
    onChanged()
  }

  async function hucreKaydet(yil: number, ay: number, alan: 'target' | 'actual', deger: number | null) {
    const res = await fetch(`/api/yonetim/kpi/${kpi.id}/olcum`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: yil,
        month: ay,
        target: alan === 'target' ? deger : kpi.measurements.find(m => m.year === yil && m.month === ay)?.target ?? null,
        actual: alan === 'actual' ? deger : kpi.measurements.find(m => m.year === yil && m.month === ay)?.actual ?? null,
      }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      alert(d.error ?? 'Kaydedilemedi')
      return
    }
    onChanged()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div className="flex flex-wrap gap-1">
          {tumYillar.map(y => (
            <Button
              key={y}
              size="sm"
              variant={y === aktifYil ? 'default' : 'outline'}
              className="h-7 text-xs"
              style={y === aktifYil ? { backgroundColor: NAVY } : undefined}
              onClick={() => onAktifYilChange(y)}
            >
              {y} vs {y - 1}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            placeholder="Yıl"
            className="w-20 h-7 text-xs"
            value={donemYilGirdi}
            onChange={e => setDonemYilGirdi(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={!donemYilGirdi.trim()}
            onClick={() => {
              const yil = Number(donemYilGirdi)
              if (Number.isNaN(yil)) return
              if (!tumYillar.includes(yil)) setEkstraYillar(prev => [...prev, yil])
              onAktifYilChange(yil)
              setDonemYilGirdi('')
            }}
          >
            <PlusCircle className="h-3 w-3 mr-1" />
            Dönem Karşılaştır
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-md border border-slate-300">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left sticky left-0 z-10" style={{ backgroundColor: NAVY, color: 'white' }}></th>
              {ortYillar.map(([y]) => (
                <th key={y} className="p-2 text-center font-semibold whitespace-nowrap border-l border-white/20" style={{ backgroundColor: NAVY, color: 'white' }}>{y} Ort.</th>
              ))}
              {AY_ADI.map(ad => (
                <th key={ad} className="p-2 text-center font-semibold whitespace-nowrap border-l border-white/20" style={{ backgroundColor: NAVY, color: 'white' }}>{ad}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gosterilenYillar.map((yil, yilIdx) => {
              const ilkYil = yilIdx === 0
              const aylikVeri = Array.from({ length: 12 }, (_, i) => {
                const m = kpi.measurements.find(x => x.year === yil && x.month === i + 1)
                return { target: m?.target ?? null, actual: m?.actual ?? null }
              })
              return (
                <Fragment key={yil}>
                  <tr className="border-t-2 border-slate-400">
                    <td className="p-2 font-semibold whitespace-nowrap bg-slate-50 sticky left-0 border-r border-slate-300">{yil} · Gerçekleşen</td>
                    {ilkYil
                      ? ortYillar.map(([y, ort]) =>
                          yillarIleOlcum.has(y) ? (
                            <td key={y} className="p-2 text-center font-medium bg-sky-100 text-sky-900 border-l border-slate-200">{sayiFormat(ort)}</td>
                          ) : (
                            <DuzenlenebilirHucre
                              key={y}
                              deger={ort}
                              onKaydet={(d) => ortalamaKaydet(y, d)}
                              className="p-2 text-center font-medium bg-sky-100 text-sky-900 border-l border-slate-200"
                            />
                          ),
                        )
                      : ortYillar.map(([y]) => <td key={y} className="p-2 bg-slate-50 border-l border-slate-200" />)}
                    {aylikVeri.map((v, i) => {
                      const tutuldu = hedefTutuldu(kpi, v.target, v.actual)
                      return (
                        <DuzenlenebilirHucre
                          key={i}
                          deger={v.actual}
                          onKaydet={(d) => hucreKaydet(yil, i + 1, 'actual', d)}
                          className="p-2 text-center font-semibold border-l border-slate-200"
                          style={{
                            backgroundColor: tutuldu == null ? '#f8fafc' : tutuldu ? '#bbf7d0' : '#fecaca',
                            color: tutuldu == null ? '#475569' : tutuldu ? '#14532d' : '#7f1d1d',
                          }}
                        />
                      )
                    })}
                  </tr>
                  <tr>
                    <td className="p-2 text-slate-600 font-medium whitespace-nowrap bg-slate-50 sticky left-0 border-r border-slate-300">Hedef</td>
                    {ortYillar.map(([y]) => <td key={y} className="p-2 bg-slate-50 border-l border-slate-200" />)}
                    {aylikVeri.map((v, i) => (
                      <DuzenlenebilirHucre
                        key={i}
                        deger={v.target}
                        onKaydet={(d) => hucreKaydet(yil, i + 1, 'target', d)}
                        className="p-2 text-center font-medium bg-slate-200 text-slate-800 border-l border-slate-300"
                      />
                    ))}
                  </tr>
                  <tr className="border-b-2 border-slate-400">
                    <td className="p-2 text-slate-600 font-medium whitespace-nowrap bg-slate-50 sticky left-0 border-r border-slate-300">G/H Oran</td>
                    {ortYillar.map(([y]) => <td key={y} className="p-2 bg-slate-50 border-l border-slate-200" />)}
                    {aylikVeri.map((v, i) => {
                      const oran = v.target && v.actual != null ? Math.round((v.actual / v.target) * 100) : null
                      return (
                        <td key={i} className="p-2 text-center font-semibold bg-sky-50 text-sky-900 border-l border-slate-200">
                          {oran == null ? '' : `%${oran}`}
                        </td>
                      )
                    })}
                  </tr>
              </Fragment>
            )
          })}
        </tbody>
      </table>
      </div>
    </div>
  )
}

const IK_ORG_UNIT_ID = 'cmrzg1kr600037jpe4ge6rxe0'

interface Departman {
  id: string
  name: string
}


export default function KpiClient() {
  const [departmanlar, setDepartmanlar] = useState<Departman[]>([])
  const [secilenDepartmanId, setSecilenDepartmanId] = useState<string>(IK_ORG_UNIT_ID)
  const [kpiler, setKpiler] = useState<Kpi[] | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [seciliId, setSeciliId] = useState<string | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    fetch('/api/yonetim/kpi/departmanlar')
      .then(res => res.json())
      .then(d => setDepartmanlar(d.departmanlar ?? []))
      .catch(() => {})
  }, [])

  // KPI Özet sayfasından "şu departmana git" linkiyle gelindiyse onu seç
  useEffect(() => {
    const departman = searchParams.get('departman')
    if (departman) setSecilenDepartmanId(departman)
  }, [searchParams])

  function yukle() {
    fetch(`/api/yonetim/kpi?orgUnitId=${secilenDepartmanId}`)
      .then(res => res.json())
      .then(d => {
        setKpiler(d.kpiler)
        const istenenKpi = searchParams.get('kpi')
        setSeciliId(prev => {
          if (istenenKpi && d.kpiler.some((k: Kpi) => k.id === istenenKpi)) return istenenKpi
          return prev && d.kpiler.some((k: Kpi) => k.id === prev) ? prev : d.kpiler[0]?.id ?? null
        })
      })
      .catch(() => setHata('Veri yüklenemedi'))
  }

  useEffect(() => {
    setKpiler(null)
    setSeciliId(null)
    yukle()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secilenDepartmanId])

  const secili = useMemo(() => kpiler?.find(k => k.id === seciliId) ?? null, [kpiler, seciliId])

  const yillar = useMemo(() => {
    if (!secili) return []
    return Array.from(new Set(secili.measurements.map(m => m.year))).sort((a, b) => b - a)
  }, [secili])

  // Aksiyonlar listesinin de tablo ile aynı aktif döneme göre filtrelenebilmesi
  // için aktif yıl burada (üst bileşende) tutuluyor.
  const [aktifYil, setAktifYil] = useState<number | null>(null)
  useEffect(() => { setAktifYil(null) }, [secili?.id])
  const gosterilenYillar = aktifYil == null ? [] : [aktifYil, aktifYil - 1]
  const donemAksiyonlari = useMemo(() => {
    if (!secili) return []
    if (aktifYil == null) return secili.actions
    return secili.actions.filter(a => {
      if (!a.startDate) return true
      const yil = new Date(a.startDate).getFullYear()
      return gosterilenYillar.includes(yil)
    })
  }, [secili, aktifYil, gosterilenYillar])

// Tek grafik: solda geçmiş yılların ortalaması (Ort. sütunları), sağında
  // en güncel iki yılın ay-ay karşılaştırması (sütun) + hedef çizgisi — hepsi
  // aynı x ekseninde yan yana (Excel'deki orijinal grafik gibi).
  const birlesikGrafikVerisi = useMemo(() => {
    if (!secili) return { veri: [] as Record<string, string | number | null>[], yilA: null as number | null, yilB: null as number | null }
    const [yilA, yilB] = yillar // en yeni, bir öncesi
    const bul = (yil: number | undefined, ay: number) =>
      yil != null ? secili.measurements.find(m => m.year === yil && m.month === ay)?.actual ?? null : null
    const hedefBul = (ay: number) =>
      secili.measurements.find(m => m.year === yilA && m.month === ay)?.target ?? null

    const ortalamaSatirlari = hesaplaOrtYillar(secili)
      .filter(([, ort]) => ort != null)
      .map(([y, ort]) => ({ ad: `${y} Ort.`, Ortalama: ort as number }))
    const aySatirlari = AY_KISA.map((ad, i) => ({
      ad,
      [String(yilA)]: bul(yilA, i + 1),
      [String(yilB)]: bul(yilB, i + 1),
      Hedef: hedefBul(i + 1),
    }))
    return { veri: [...ortalamaSatirlari, ...aySatirlari], yilA: yilA ?? null, yilB: yilB ?? null }
  }, [secili, yillar])

  const guncelYilOrtalamasi = useMemo(() => {
    if (!secili || birlesikGrafikVerisi.yilA == null) return null
    return hesaplaOrtYillar(secili).find(([y]) => y === birlesikGrafikVerisi.yilA)?.[1] ?? null
  }, [secili, birlesikGrafikVerisi.yilA])

  const secilenDepartman = departmanlar.find(d => d.id === secilenDepartmanId)

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-xs text-muted-foreground">Departman</Label>
        <Select value={secilenDepartmanId} onValueChange={setSecilenDepartmanId}>
          <SelectTrigger className="w-full sm:w-80 mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {departmanlar.map(d => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Target className="h-6 w-6 lg:h-7 lg:w-7" style={{ color: NAVY }} />
            {secilenDepartman?.name ?? '...'} — KPI
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Aylık hedef/gerçekleşen takibi ve aksiyon planı</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/yonetim/kpi-ozet">
            <Button size="sm" variant="outline">KPI Özet →</Button>
          </Link>
          <YeniKpiDialog orgUnitId={secilenDepartmanId} onCreated={yukle} />
        </div>
      </div>

      {hata ? (
        <p className="text-sm text-muted-foreground">{hata}</p>
      ) : !kpiler ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : kpiler.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Henüz KPI yok — &quot;Yeni KPI Ekle&quot; ile başla.
        </p>
      ) : (
        <>
          <Tabs value={seciliId ?? undefined} onValueChange={setSeciliId}>
            <TabsList className="flex-wrap h-auto gap-1 bg-muted/70 p-1">
              {kpiler.map(k => (
                <TabsTrigger key={k.id} value={k.id} className="text-sm">
                  {k.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {secili && (
            <>
              <Card>
                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {secili.name}
                      <Badge variant="secondary" className="font-normal">
                        {secili.direction === 'lower_is_better' ? 'Düşük iyi' : 'Yüksek iyi'}
                      </Badge>
                      {secili.unit && <span className="text-xs font-normal text-muted-foreground">{secili.unit}</span>}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Solda geçmiş yılların ortalaması, sağda {birlesikGrafikVerisi.yilB ?? '—'} vs {birlesikGrafikVerisi.yilA ?? '—'} aylık karşılaştırma — tek grafikte
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>&quot;{secili.name}&quot; KPI&apos;sı silinsin mi?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Bu KPI'a ait tüm ölçümler, yıllık ortalamalar ve aksiyonlar birlikte silinir. Bu işlem geri alınamaz.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700"
                          onClick={async () => {
                            await fetch(`/api/yonetim/kpi/${secili.id}`, { method: 'DELETE' })
                            setSeciliId(null)
                            yukle()
                          }}
                        >
                          Sil
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardHeader>
                <CardContent>
                  {birlesikGrafikVerisi.veri.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-10 text-center">Veri yok</p>
                  ) : (
                    <div className="relative">
                      {guncelYilOrtalamasi != null && birlesikGrafikVerisi.yilA != null && (
                        <div className="absolute top-0 right-0 text-right z-10">
                          <div className="text-[11px] text-muted-foreground">{birlesikGrafikVerisi.yilA} Ortalaması</div>
                          <div className="text-lg font-bold" style={{ color: NAVY }}>{sayiFormat(guncelYilOrtalamasi)}</div>
                        </div>
                      )}
                      <ResponsiveContainer width="100%" height={320}>
                        <ComposedChart data={birlesikGrafikVerisi.veri} margin={{ left: 4, right: 8, top: 20, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="ad" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip content={<GrafikTooltip />} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="Ortalama" fill="#f0a875" radius={[3, 3, 0, 0]}>
                            <LabelList dataKey="Ortalama" position="top" style={{ fontSize: 10, fill: '#78350f' }} formatter={(v: number) => sayiFormat(v)} />
                          </Bar>
                          {birlesikGrafikVerisi.yilB != null && (
                            <Bar dataKey={String(birlesikGrafikVerisi.yilB)} fill="#94a3b8" radius={[3, 3, 0, 0]}>
                              <LabelList dataKey={String(birlesikGrafikVerisi.yilB)} position="top" style={{ fontSize: 10, fill: '#475569' }} formatter={(v: number) => sayiFormat(v)} />
                            </Bar>
                          )}
                          {birlesikGrafikVerisi.yilA != null && (
                            <Bar dataKey={String(birlesikGrafikVerisi.yilA)} fill={NAVY} radius={[3, 3, 0, 0]}>
                              <LabelList dataKey={String(birlesikGrafikVerisi.yilA)} position="top" style={{ fontSize: 10, fill: NAVY }} formatter={(v: number) => sayiFormat(v)} />
                            </Bar>
                          )}
                          <Line type="monotone" dataKey="Hedef" stroke={KIRMIZI} strokeDasharray="4 4" dot={false} connectNulls />
                          {birlesikGrafikVerisi.yilB != null && (
                            <Line
                              type="monotone"
                              dataKey={String(birlesikGrafikVerisi.yilB)}
                              name={`${birlesikGrafikVerisi.yilB} Gerçekleşen (çizgi)`}
                              stroke="#64748b"
                              strokeWidth={2}
                              dot={{ r: 3 }}
                            />
                          )}
                          {birlesikGrafikVerisi.yilA != null && (
                            <Line
                              type="monotone"
                              dataKey={String(birlesikGrafikVerisi.yilA)}
                              name={`${birlesikGrafikVerisi.yilA} Gerçekleşen (çizgi)`}
                              stroke={YESIL}
                              strokeWidth={2}
                              dot={{ r: 3 }}
                            />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Hücreye tıklayıp değeri düzenleyebilirsin</p>
                    <KpiVeriTablosu
                      key={secili.id}
                      kpi={secili}
                      yillar={yillar}
                      onChanged={yukle}
                      aktifYil={aktifYil}
                      onAktifYilChange={setAktifYil}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Aksiyonlar</CardTitle>
                    {aktifYil != null && (
                      <p className="text-xs text-muted-foreground mt-0.5">{aktifYil} vs {aktifYil - 1} dönemine ait</p>
                    )}
                  </div>
                  <AksiyonFormDialog kpiId={secili.id} onSaved={yukle} />
                </CardHeader>
                <CardContent>
                  {donemAksiyonlari.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">Bu dönem için aksiyon kaydı yok</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-muted-foreground border-b">
                            <th className="pb-2 pr-4">Neden</th>
                            <th className="pb-2 pr-4">Aksiyon</th>
                            <th className="pb-2 pr-4">Sorumlu</th>
                            <th className="pb-2 pr-4">Başlangıç</th>
                            <th className="pb-2 pr-4">Bitiş</th>
                            <th className="pb-2 pr-4">Tamamlanma</th>
                            <th className="pb-2 pr-4 w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {donemAksiyonlari.map(a => (
                            <tr key={a.id} className="border-b last:border-0">
                              <td className="py-2 pr-4">{a.reason ?? '—'}</td>
                              <td className="py-2 pr-4">{a.action ?? '—'}</td>
                              <td className="py-2 pr-4">{a.responsibleName ?? '—'}</td>
                              <td className="py-2 pr-4">{a.startDate ? new Date(a.startDate).toLocaleDateString('tr-TR') : '—'}</td>
                              <td className="py-2 pr-4">{a.endDate ? new Date(a.endDate).toLocaleDateString('tr-TR') : '—'}</td>
                              <td className="py-2 pr-4">%{a.completionPercent ?? 0}</td>
                              <td className="py-2">
                                <AksiyonFormDialog kpiId={secili.id} mevcut={a} onSaved={yukle} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  )
}
